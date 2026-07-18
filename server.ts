import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Trust proxy for secure headers and rate limiting in production environments (such as behind Cloud Run load balancers)
  app.set('trust proxy', 1);

  // Lazy initialize Supabase clients for safety
  let publicSupabaseClient: any = null;
  let adminSupabaseClient: any = null;

  function getPublicSupabase() {
    if (!publicSupabaseClient) {
      const url = process.env.VITE_SUPABASE_URL;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        throw new Error('Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing.');
      }
      publicSupabaseClient = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
    return publicSupabaseClient;
  }

  function getAdminSupabase() {
    if (!adminSupabaseClient) {
      const url = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url) {
        throw new Error('VITE_SUPABASE_URL is required.');
      }
      if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Please set it in your AI Studio secrets/settings.');
      }
      adminSupabaseClient = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
    return adminSupabaseClient;
  }

  // Parse JSON bodies
  app.use(express.json());

  // Production security headers middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // To allow framing in AI Studio but enforce SAMEORIGIN elsewhere, we can conditionally set X-Frame-Options.
    const referer = req.headers.referer || '';
    const isFramedByGoogle = referer.includes('ai.studio') || referer.includes('.google.com') || referer.includes('.run.app');
    if (!isFramedByGoogle) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    // Strict Content-Security-Policy (CSP) allowing the AI Studio preview frame and Cloudflare Turnstile to load
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseHost = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '') : '';
    const connectSrc = [
      "'self'",
      supabaseUrl,
      supabaseHost ? `wss://${supabaseHost}` : '',
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://challenges.cloudflare.com"
    ].filter(Boolean).join(' ');

    const cspDirectives = [
      "default-src 'self'",
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      `connect-src ${connectSrc}`,
      "img-src 'self' data: https://*.supabase.co https://ai.google.dev https://google.dev https://ai.studio",
      "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app",
      "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);
    
    // Strict-Transport-Security only when HTTPS
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Basic in-memory rate limiter for admin creation with proactive eviction
  const adminRegisterLimiter = new Map<string, { count: number; resetAt: number }>();

  function checkRateLimit(ip: string): { allowed: boolean; resetAt?: number } {
    const now = Date.now();
    const timeframe = 15 * 60 * 1000; // 15 minutes
    const limit = 10;

    // Proactive eviction of expired entries to prevent memory growth
    for (const [key, val] of adminRegisterLimiter.entries()) {
      if (now > val.resetAt) {
        adminRegisterLimiter.delete(key);
      }
    }

    const record = adminRegisterLimiter.get(ip);
    if (!record) {
      adminRegisterLimiter.set(ip, { count: 1, resetAt: now + timeframe });
      return { allowed: true };
    }

    if (record.count >= limit) {
      return { allowed: false, resetAt: record.resetAt };
    }

    record.count += 1;
    return { allowed: true };
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Secure Admin creation route
  app.post('/api/crm-service/register-administrator', async (req, res) => {
    console.log('[Server API] Received request to /api/crm-service/register-administrator');
    try {
      // 0. Apply rate limit check
      const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const ip = rawIp.split(',')[0].trim();

      const limitCheck = checkRateLimit(ip);
      if (!limitCheck.allowed) {
        const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
        return res.status(429).json({
          error: `Too many administrator registration attempts from this IP. Please try again in ${minutesLeft} minutes.`
        });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[Server API] Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Unauthorized. Authorization token is missing.' });
      }

      const token = authHeader.substring(7);
      const pubClient = getPublicSupabase();

      // 1. Verify token with Supabase Auth
      const { data: { user }, error: authError } = await pubClient.auth.getUser(token);
      if (authError || !user) {
        console.warn('[Server API] Token verification failed:', authError?.message);
        return res.status(401).json({ error: 'Unauthorized. Invalid authentication session.' });
      }

      console.log('[Server API] Token verified successfully');

      // Initialize admin client securely to query public.admins (RLS-bypass)
      let adminClient;
      try {
        adminClient = getAdminSupabase();
      } catch (err: any) {
        console.error('[Server API] Failed to initialize admin client:', err.message);
        return res.status(500).json({ error: err.message });
      }

      // 2. Verify that the operating user exists in public.admins using service-role client
      const { data: adminRecord, error: adminQueryError } = await adminClient
        .from('admins')
        .select('id, email')
        .eq('id', user.id)
        .maybeSingle();

      if (adminQueryError || !adminRecord) {
        console.warn('[Server API] Requester is not an authorized administrator in public.admins. Error:', adminQueryError?.message);
        return res.status(403).json({ error: 'Forbidden. Only registered administrators can create new admin accounts.' });
      }

      console.log('[Server API] Requester confirmed as authorized administrator');

      // 3. Extract parameters
      const { email, password } = req.body;
      if (!email || !password) {
        console.warn('[Server API] Missing email or password in request body');
        return res.status(400).json({ error: 'Both email and password are required.' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      if (password.length < 6) {
        console.warn('[Server API] Password is too short');
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      console.log('[Server API] Initiating admin creation');


      // 5. Pre-emptively verify if email already registered in admins table
      const { data: existingAdmin } = await adminClient
        .from('admins')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (existingAdmin) {
        console.warn('[Server API] Admin email already registered in public.admins');
        return res.status(400).json({ error: `An administrator account with email "${trimmedEmail}" already exists.` });
      }

      // 6. Create user in Supabase Auth via official Admin API
      console.log('[Server API] Calling auth.admin.createUser');
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: trimmedEmail,
        password: password,
        email_confirm: true
      });

      if (createError || !newUser || !newUser.user) {
        console.error('[Server API] auth.admin.createUser failed:', createError?.message);
        return res.status(400).json({ error: createError?.message || 'Failed to create auth user.' });
      }

      const newUserId = newUser.user.id;
      console.log('[Server API] Auth user created successfully');

      // 7. Insert matching record into public.admins
      console.log('[Server API] Inserting record into public.admins');
      const { error: insertError } = await adminClient
        .from('admins')
        .upsert({
          id: newUserId,
          email: trimmedEmail
        });

      if (insertError) {
        console.error('[Server API] Inserting into public.admins failed:', insertError.message);
        // Roll back the auth user creation if public.admins registration fails
        console.log('[Server API] Rolling back auth user creation');
        await adminClient.auth.admin.deleteUser(newUserId);
        return res.status(500).json({ error: `Failed to insert user into public.admins table: ${insertError.message}` });
      }

      console.log('[Server API] Record inserted into public.admins successfully.');

      // 8. Record audit log entry
      const { error: logError } = await adminClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          user_email: adminRecord.email || user.email,
          action: 'Admin account created',
          target_id: newUserId,
          target_name: trimmedEmail,
          details: { created_by: user.id, email: trimmedEmail }
        });

      if (logError) {
        console.warn('Audit logging failed for admin creation:', logError.message);
      }

      console.log('[Server API] Admin creation transaction complete.');
      return res.json({
        success: true,
        user: {
          id: newUserId,
          email: trimmedEmail
        }
      });

    } catch (error: any) {
      console.error('Error in administrator creation:', error);
      return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
  });

  // Serve static assets or mount Vite dev server middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const publicPath = path.join(process.cwd(), 'dist', 'public');
    
    // Explicitly reject requests to server files, sourcemaps, or TS source files with a hard 404
    app.use((req, res, next) => {
      const ext = path.extname(req.path).toLowerCase();
      if (ext === '.cjs' || ext === '.map' || ext === '.ts' || req.path === '/server.cjs') {
        res.status(404).send('Not Found');
        return;
      }
      next();
    });

    app.use(express.static(publicPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
