import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazily initialize Supabase clients for safety
let publicSupabaseClient: SupabaseClient | null = null;
let adminSupabaseClient: SupabaseClient | null = null;

// Anon-key client with NO caller identity attached -- used only for stateless operations that
// don't need auth.uid() to resolve (verifying a bearer token via getUser(), signing in, the
// public form's anonymous insert).
export function getPublicSupabase(): SupabaseClient {
  if (!publicSupabaseClient) {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing.');
    }
    publicSupabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return publicSupabaseClient;
}

// Service-role client. Bypasses RLS entirely -- reserved for the handful of truly privileged
// operations that must bypass it (admin invite creation/deletion via the Auth Admin API).
// Never used for ordinary data operations; those go through getUserScopedClient() instead so
// RLS keeps enforcing exactly what it always has.
export function getAdminSupabase(): SupabaseClient {
  if (!adminSupabaseClient) {
    const url = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) {
      throw new Error('VITE_SUPABASE_URL is required.');
    }
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Please set it in your server environment.');
    }
    adminSupabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminSupabaseClient;
}

// Builds a Supabase client scoped to the CALLING USER's own JWT, so auth.uid() resolves exactly
// as it would if their browser called Supabase directly -- every existing RLS policy keeps
// enforcing unchanged. This is the client every ordinary data route (startups, notes, audit logs,
// admin list) should use; the backend is a relay, not a new authorization layer.
export function getUserScopedClient(accessToken: string): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing.');
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
