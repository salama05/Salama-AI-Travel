import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ─── Browser client (uses anon key, respects RLS) ─────────────────────────────
export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// ─── Server client (uses anon key + session cookies, respects RLS) ────────────
export const createClientServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

// ─── Service-role client (bypasses RLS — NEVER import in client components) ───
// Used exclusively for admin server actions that need to read/mutate any row
// regardless of the authenticated user's identity.
export const createServiceRoleClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase.ts] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env.local (find it in Supabase → Project Settings → API).'
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      // Disable session persistence — this client acts as a trusted server agent,
      // not as a specific user. We verify the caller's identity separately.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
