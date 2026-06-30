/**
 * actions/admin.ts
 *
 * Server actions for the admin support dashboard.
 *
 * SECURITY MODEL:
 * Every exported function begins with an admin guard:
 *   1. We call auth.getUser() on the SESSION-based server client (verifies the
 *      caller is authenticated and their JWT is valid).
 *   2. We read app_metadata.role from the verified JWT — this field is set
 *      server-side by Supabase and cannot be forged by the user.
 *   3. If not admin, we throw immediately before touching any data.
 *
 * REDIS SYNC:
 * After every status update we call indexTicket() which re-embeds the ticket
 * text (including the new status) and upserts it into idx:support_tickets.
 * The AI agent's semantic search will naturally reflect the resolved status.
 */

'use server';

import { createClientServer, createServiceRoleClient } from '@/lib/supabase';
import { mapTicket, SupportTicketEntity, TicketStatus, TICKET_STATUSES } from '@/lib/entities';
import { ensureTicketIndex, indexTicket } from '@/lib/vector-search';
import { revalidatePath } from 'next/cache';

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

/**
 * Verifies the calling user is authenticated and has the admin role.
 * Throws a descriptive error if either check fails.
 * Returns the verified userId so callers can audit actions.
 */
async function requireAdmin(): Promise<string> {
  // Use the session-based client to get the authenticated user.
  // This validates the JWT and reads the trusted server-side app_metadata.
  const supabase = await createClientServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('[admin] Unauthorized: no authenticated session.');
  }

  // app_metadata is set server-side and cannot be manipulated by the client.
  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== 'admin') {
    throw new Error('[admin] Forbidden: caller does not have the admin role.');
  }

  return user.id;
}

// ─── Fetch All Tickets (Admin) ────────────────────────────────────────────────

/**
 * Returns all support tickets across all users, ordered by newest first.
 * Joins profiles to include the submitting user's email.
 * Uses the service-role client to bypass RLS.
 */
export async function getAllTickets(): Promise<SupportTicketEntity[]> {
  await requireAdmin();

  const db = createServiceRoleClient();

  const { data, error } = await db
    .from('support_tickets')
    .select(`
      id,
      user_id,
      subject,
      description,
      status,
      created_at,
      profiles ( email )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`[admin] Failed to fetch tickets: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    // Supabase returns the joined profiles relation as an array (one-to-many shape).
    // We cast via unknown first, then safely extract the first element.
    const profilesRaw = row.profiles as unknown as { email: string }[] | null;
    const profileData = Array.isArray(profilesRaw) ? profilesRaw[0] : null;
    return mapTicket({
      ...row,
      userEmail: profileData?.email ?? null,
    });
  });
}

// ─── Update Ticket Status ─────────────────────────────────────────────────────

export interface UpdateTicketResult {
  success: boolean;
  error?: string;
  ticket?: SupportTicketEntity;
}

/**
 * Updates a ticket's status in Supabase and syncs the Redis vector index.
 *
 * @param ticketId - UUID of the ticket to update
 * @param newStatus - Target status ('open' | 'resolved' | 'closed')
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus
): Promise<UpdateTicketResult> {
  try {
    // 1. Guard — must be admin
    await requireAdmin();

    // 2. Validate the status value to prevent injection
    if (!TICKET_STATUSES.includes(newStatus)) {
      return { success: false, error: `Invalid status value: ${newStatus}` };
    }

    // 3. Validate the ticketId is a UUID (basic sanitisation)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(ticketId)) {
      return { success: false, error: 'Invalid ticket ID format.' };
    }

    // 4. Perform the update via service-role client (bypasses RLS)
    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('id', ticketId)
      .select(`
        id,
        user_id,
        subject,
        description,
        status,
        created_at
      `)
      .single();

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    const updatedTicket = mapTicket(data as Record<string, unknown>);

    // 5. Sync Redis vector index — re-embed with the new status text
    try {
      await ensureTicketIndex();
      await indexTicket(updatedTicket);
      console.log(
        `[admin] Ticket ${ticketId} status updated to '${newStatus}' and synced to Redis.`
      );
    } catch (redisErr) {
      // Redis sync failure is non-fatal — Supabase is the source of truth.
      // Log the error so it can be investigated, but return success to the UI.
      console.error('[admin] Redis sync failed (non-fatal):', redisErr);
    }

    // 6. Invalidate the admin page cache so the next render reflects the change
    revalidatePath('/admin/support');

    return { success: true, ticket: updatedTicket };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
