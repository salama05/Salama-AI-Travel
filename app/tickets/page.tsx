import React from 'react';
import Navbar from '@/components/navbar';
import { createTicket, getUserTickets } from '@/actions/travel';
import { getUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import { Ticket, Send, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export default async function TicketsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth');
  }

  const tickets = await getUserTickets();

  const handleCreateTicketAction = async (formData: FormData) => {
    'use server';
    const subject = formData.get('subject') as string;
    const description = formData.get('description') as string;

    if (!subject || !description) return;

    try {
      await createTicket(subject, description);
      revalidatePath('/tickets');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-foreground flex flex-col">
      <Navbar userEmail={user.email} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-2 border-b border-cyber-cyan/10 pb-4">
            <h1 className="text-2xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-purple uppercase">
              NEW_TICKET_PORTAL
            </h1>
            <p className="text-xs font-mono text-foreground/50 uppercase tracking-widest">
              Report system anomalies or route conflicts
            </p>
          </div>

          <div className="cyber-panel p-6 rounded-lg border-t-2 border-t-cyber-pink shadow-[0_0_20px_rgba(255,0,127,0.05)]">
            <form action={handleCreateTicketAction} className="space-y-5">
              <div>
                <label className="block text-xs font-mono text-cyber-pink uppercase tracking-widest mb-2">
                  Subject / Topic
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  placeholder="e.g. Booking confirmation mismatch"
                  className="w-full px-4 py-2.5 bg-cyber-black/60 border border-cyber-pink/20 focus:border-cyber-pink focus:ring-1 focus:ring-cyber-pink/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-cyber-pink uppercase tracking-widest mb-2">
                  Detailed Description
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="Provide precise details of the flight anomaly or ticket query..."
                  className="w-full px-4 py-2.5 bg-cyber-black/60 border border-cyber-pink/20 focus:border-cyber-pink focus:ring-1 focus:ring-cyber-pink/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-cyber-pink/15 hover:bg-cyber-pink/35 text-cyber-pink border border-cyber-pink font-mono font-bold tracking-widest text-xs rounded transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer uppercase shadow-[0_0_15px_rgba(255,0,127,0.1)]"
              >
                <Send className="w-4 h-4" />
                TRANSMIT_TICKET
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Tickets */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-mono font-bold tracking-widest text-foreground/80 uppercase">
            ACTIVE_TICKET_REGISTRY ({tickets.length})
          </h2>

          <div className="space-y-4">
            {tickets.length === 0 ? (
              <div className="cyber-panel p-12 text-center rounded-lg border border-dashed border-cyber-purple/20">
                <p className="font-mono text-sm text-foreground/45 uppercase tracking-widest">
                  No active support transmissions detected in logs.
                </p>
              </div>
            ) : (
              tickets.map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="cyber-panel p-6 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-all duration-300 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-cyber-cyan/15 pb-2">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-cyber-cyan" />
                      <span className="font-mono font-bold text-sm text-foreground">
                        {ticket.subject}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        ticket.status === 'open'
                          ? 'text-cyber-cyan bg-cyber-cyan/5 border-cyber-cyan/30'
                          : 'text-cyber-green bg-cyber-green/5 border-cyber-green/30'
                      }`}
                    >
                      {ticket.status === 'open' ? (
                        <>
                          <ShieldAlert className="w-3 h-3" />
                          PENDING
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          RESOLVED
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-sm font-sans text-foreground/75 leading-relaxed">
                    {ticket.description}
                  </p>

                  <div className="text-[10px] font-mono text-foreground/40">
                    TRANSMITTED_AT: {new Date(ticket.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
