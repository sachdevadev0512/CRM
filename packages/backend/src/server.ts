import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Resolve the repo root's .env regardless of CWD or how this process is launched (npm workspace
// script, PM2, dev vs bundled prod). A path derived from import.meta.url would work in dev but
// esbuild empties it out once bundled to CJS -- so instead this walks up from CWD looking for a
// .env file, the same way tools like ESLint/Prettier find their config regardless of invocation.
function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile(process.cwd());
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  console.warn('[Server] No .env file found by walking up from', process.cwd());
}
import authRoutes from './routes/auth.js';
import publicFormRoutes from './routes/publicForm.js';
import startupsRoutes from './routes/startups.js';
import notesRoutes from './routes/notes.js';
import auditLogsRoutes from './routes/auditLogs.js';
import adminsRoutes from './routes/admins.js';
import adminInvitesRoutes from './routes/adminInvites.js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Trust proxy for secure headers and rate limiting behind Nginx/Cloud Run-style load balancers
  app.set('trust proxy', 1);

  // This backend now serves ONLY the /api/* surface -- both frontends (form + admin) are pure
  // static builds served directly by Nginx on a different domain, which is why CORS (below) is
  // required at all: this is a genuine cross-origin API, not a same-origin app server anymore.
  // FRONTEND_ORIGIN supports a comma-separated list: production only needs one
  // (https://crm.dealschool.in), but local dev runs form/admin as separate Vite dev servers on
  // different ports (different origins), so both need allow-listing there.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: false, // bearer tokens in the Authorization header, not cookies
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());

  // Security headers -- no CSP here, since this origin never serves HTML/JS to a browser
  // directly anymore (that's Nginx's job for the two static frontends).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicFormRoutes);
  app.use('/api/startups', startupsRoutes);
  app.use('/api', notesRoutes); // exposes /api/startups/:id/notes and /api/notes/:id
  app.use('/api', auditLogsRoutes); // exposes /api/audit-logs and /api/audit-logs/target/:id
  app.use('/api', adminsRoutes); // exposes /api/admins
  app.use('/api', adminInvitesRoutes); // exposes /api/admin-invites*

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start backend API server:', err);
});
