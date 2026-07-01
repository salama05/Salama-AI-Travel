/**
 * app/admin/support/page.tsx
 *
 * PROTECTED ADMIN ROUTE — /admin/support
 *
 * This is a React Server Component. It runs exclusively on the server, so:
 *  - The admin check happens before a single byte is sent to the browser.
 *  - The service-role Supabase key is never exposed to the client bundle.
 *  - Non-admins are redirected to '/' before any ticket data is fetched.
 */

import { redirect } from 'next/navigation';
import { createClientServer } from '@/lib/supabase';
import { getAllTickets } from '@/actions/admin';
import TicketAdminTable from '@/components/ticket-admin-table';
import Navbar from '@/components/navbar';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Admin — Support Dashboard | Salama AI Travel',
  description: 'Internal admin console for managing all support tickets.',
  // Instruct crawlers to never index this admin page
  robots: 'noindex, nofollow',
};

export default async function AdminSupportPage() {
  // ─── Auth & Role Guard ──────────────────────────────────────────────────────
  // We re-run the check here (not just in the server action) so that:
  //  a) unauthenticated users get a hard redirect before any data is fetched.
  //  b) the redirect is part of the rendered route, not inside an action.
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== 'admin') {
    redirect('/');
  }

  // ─── Data Fetch ─────────────────────────────────────────────────────────────
  let tickets: Awaited<ReturnType<typeof getAllTickets>> = [];
  let fetchError: string | null = null;

  try {
    tickets = await getAllTickets();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load tickets.';
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cyber-black text-foreground flex flex-col">
      <Navbar userEmail={user.email} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 space-y-10">

        {/* Page Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyber-purple/10 border border-cyber-purple/30">
              <ShieldCheck className="w-5 h-5 text-cyber-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-pink uppercase">
                ADMIN_SUPPORT_CONSOLE
              </h1>
              <p className="text-xs font-mono text-foreground/40 uppercase tracking-widest mt-0.5">
                Authenticated as&nbsp;
                <span className="text-cyber-purple">{user.email}</span>
                &nbsp;·&nbsp;Role:&nbsp;
                <span className="text-cyber-pink">ADMIN</span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-cyber-purple/40 via-cyber-cyan/20 to-transparent" />
        </div>

        {/* Error State */}
        {fetchError && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-mono font-bold text-red-400">
                DATA_FETCH_ERROR
              </p>
              <p className="text-xs font-mono text-foreground/50">{fetchError}</p>
            </div>
          </div>
        )}

        {/* Ticket Table */}
        {!fetchError && <TicketAdminTable tickets={tickets} />}

      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-cyan/10 py-4">
        <p className="text-center text-[10px] font-mono text-foreground/20 uppercase tracking-widest">
          SALAMA_AI_TRAVEL · ADMIN_CONSOLE · RESTRICTED_ACCESS
        </p>
      </footer>
    </div>
  );
}
