import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabase, getAdminSupabase, getUserScopedClient } from './supabaseClients.js';

// Thrown by requireAdmin()/requireUser() below and translated into an HTTP response by each
// route's try/catch block (avoids relying on discriminated-union narrowing across call sites).
export class AdminAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AdminAuthError(401, 'Unauthorized. Authorization token is missing.');
  }
  return authHeader.substring(7);
}

// Verifies the caller has a valid Supabase session, WITHOUT requiring them to already be an
// admin. Used only by the invite-accept flow, where the whole point is that the caller isn't
// an admin yet -- authorization there comes from having a matching pending admin_invites row,
// checked separately in that route.
export async function requireUser(req: Request): Promise<{
  user: { id: string; email: string };
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
}> {
  const token = extractBearerToken(req);
  const pubClient = getPublicSupabase();

  const { data: { user }, error: authError } = await pubClient.auth.getUser(token);
  if (authError || !user) {
    throw new AdminAuthError(401, 'Unauthorized. Invalid authentication session.');
  }

  let adminClient: SupabaseClient;
  try {
    adminClient = getAdminSupabase();
  } catch (err: any) {
    throw new AdminAuthError(500, err.message);
  }

  return {
    user: { id: user.id, email: user.email || '' },
    userClient: getUserScopedClient(token),
    adminClient,
  };
}

// Verifies the caller is an authenticated, currently-registered administrator. Shared by every
// privileged route. Throws AdminAuthError (with an HTTP status) on any failure; resolves with
// the caller's identity plus BOTH a user-scoped client (RLS enforces exactly as it would for a
// direct browser call) and the service-role client (for the few operations that must bypass RLS).
export async function requireAdmin(req: Request): Promise<{
  user: { id: string; email: string };
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
}> {
  const { user, userClient, adminClient } = await requireUser(req);

  const { data: adminRecord, error: adminQueryError } = await adminClient
    .from('admins')
    .select('id, email')
    .eq('id', user.id)
    .maybeSingle();

  if (adminQueryError || !adminRecord) {
    throw new AdminAuthError(403, 'Forbidden. Only registered administrators can perform this action.');
  }

  return {
    user: { id: user.id, email: adminRecord.email || user.email },
    userClient,
    adminClient,
  };
}

// Shared audit-log writer. Supabase-js does NOT throw on a DB-level failure (RLS denial,
// constraint violation) -- it resolves with `{ error }` -- so this explicitly checks the
// resolved error (in addition to catching genuine thrown exceptions) and always logs a warning
// on failure, while never throwing itself: an audit-log hiccup must never block the primary
// action (status change, note, delete) it's describing.
export async function logAuditEvent(
  client: SupabaseClient,
  entry: {
    user_id: string;
    user_email: string;
    action: string;
    target_id: string;
    target_name: string;
    details?: any;
  }
): Promise<void> {
  try {
    const { error } = await client.from('audit_logs').insert(entry);
    if (error) {
      console.warn(`Failed to write audit log for action "${entry.action}":`, error);
    }
  } catch (e) {
    console.warn(`Failed to write audit log for action "${entry.action}":`, e);
  }
}
