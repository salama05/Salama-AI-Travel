'use client';

import { useState, useTransition } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plane, Calendar, Clock, MapPin, CheckCircle,
  Ticket, Lock, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { performCheckIn } from '@/actions/travel';
import type { ETicketEntity } from '@/lib/entities';

// ─── Time window helpers ───────────────────────────────────────────────────────
const CHECKIN_WINDOW_MS = 24 * 60 * 60 * 1000;

function getCheckInState(departureTime: string, status: ETicketEntity['status']) {
  const now = Date.now();
  const departure = new Date(departureTime).getTime();
  const msUntil = departure - now;
  const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60));
  const minutesUntil = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));

  if (status === 'boarded') return { case: 'boarded' as const };
  if (status === 'active')  return { case: 'checked_in' as const };
  if (msUntil <= 0)         return { case: 'departed' as const };
  if (msUntil <= CHECKIN_WINDOW_MS) return { case: 'open' as const };
  return { case: 'too_early' as const, hoursUntil, minutesUntil };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function BoardingPass({ ticket }: { ticket: ETicketEntity }) {
  if (!ticket.flight) return null;

  const { flight, bookingReference, seatNumber } = ticket;
  const departureDate = new Date(flight.departureTime);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const checkInState = getCheckInState(flight.departureTime, ticket.status);

  const handleCheckIn = () => {
    setError(null);
    startTransition(async () => {
      const result = await performCheckIn(ticket.id);
      if (!result.success) {
        setError(result.error);
      }
      // On success, revalidatePath('/e-tickets') in the action refreshes the page
    });
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // ─── Status badge ─────────────────────────────────────────────────────────
  const statusBadge = (() => {
    switch (ticket.status) {
      case 'boarded':
        return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider">✓ BOARDED</span>;
      case 'active':
        return <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/50 text-sky-400 bg-sky-400/10 px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider">✓ CHECKED IN</span>;
      case 'invalid':
        return <span className="inline-flex items-center gap-1 rounded-full border border-red-500/50 text-red-400 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider">INVALID</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 text-primary bg-primary/5 px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider">VALID</span>;
    }
  })();

  return (
    <div className="rounded-xl overflow-hidden border-2 border-primary/20 bg-black/60 backdrop-blur-md shadow-2xl transition-all hover:border-primary/40 group max-w-2xl mx-auto w-full">
      <div className="flex flex-col md:flex-row">

        {/* ── Main ticket body ─────────────────────────────────────────────── */}
        <div className="flex-1 p-6 border-b-2 md:border-b-0 md:border-r-2 border-dashed border-primary/30 relative overflow-hidden">
          {/* Decorative background plane */}
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Plane size={200} className="text-primary rotate-45 transform translate-x-1/4 -translate-y-1/4" />
          </div>

          {/* Header row */}
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-sm mb-1 uppercase">
                <Ticket size={16} />
                Boarding Pass
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{flight.airline}</h3>
              <p className="text-muted-foreground font-mono text-sm">Flight: {flight.flightNumber}</p>
            </div>
            {statusBadge}
          </div>

          {/* Route display */}
          <div className="grid grid-cols-3 gap-4 items-center mb-8 relative z-10">
            <div className="text-center md:text-left">
              <p className="text-4xl font-black text-white">{flight.departure}</p>
              <div className="flex items-center justify-center md:justify-start gap-1 text-muted-foreground mt-1 text-sm">
                <MapPin size={14} /><span>Origin</span>
              </div>
            </div>
            <div className="flex flex-col items-center px-2">
              <div className="w-full flex items-center justify-center mb-2">
                <div className="h-px bg-primary/30 w-full" />
                <Plane size={24} className="text-primary mx-2" />
                <div className="h-px bg-primary/30 w-full" />
              </div>
              <span className="rounded-full border border-transparent bg-white/10 text-white/60 px-2.5 py-0.5 text-xs font-semibold">Direct</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-4xl font-black text-white">{flight.arrival}</p>
              <div className="flex items-center justify-center md:justify-end gap-1 text-muted-foreground mt-1 text-sm">
                <MapPin size={14} /><span>Destination</span>
              </div>
            </div>
          </div>

          {/* Flight detail grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-primary/5 rounded-xl p-4 relative z-10">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar size={12} /> Date</p>
              <p className="font-semibold text-white text-sm">{formatDate(departureDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock size={12} /> Departs</p>
              <p className="font-semibold text-white text-sm">{formatTime(departureDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gate</p>
              <p className="font-semibold text-white text-sm">TBD</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Seat</p>
              <p className="font-semibold text-primary text-lg">{seatNumber || 'N/A'}</p>
            </div>
          </div>

          {/* ── Check-in action area ──────────────────────────────────────── */}
          <div className="mt-5 relative z-10">

            {/* CASE C: Boarded — show terminal state, no button */}
            {checkInState.case === 'boarded' && (
              <div className="flex items-center gap-3 bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-4">
                <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
                <div>
                  <p className="text-emerald-400 font-semibold text-sm">Boarding Complete</p>
                  <p className="text-muted-foreground text-xs mt-0.5">This ticket has been scanned at the gate. Safe travels!</p>
                </div>
              </div>
            )}

            {/* CASE B: Checked in — show confirmation, no button */}
            {checkInState.case === 'checked_in' && (
              <div className="flex items-center gap-3 bg-sky-400/10 border border-sky-400/20 rounded-xl p-4">
                <CheckCircle className="text-sky-400 shrink-0" size={20} />
                <div>
                  <p className="text-sky-400 font-semibold text-sm">Online Check-in Complete</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Present your QR code at the gate. Boarding starts 30 min before departure.</p>
                </div>
              </div>
            )}

            {/* CASE A: Too early — disabled button with countdown */}
            {checkInState.case === 'too_early' && (
              <div className="space-y-3">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/30 text-sm font-semibold font-mono cursor-not-allowed"
                >
                  <Lock size={15} />
                  Perform Online Check-in
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Online check-in opens{' '}
                  <span className="text-amber-400 font-semibold">
                    24 hours before departure
                  </span>
                  {' '}— opens in{' '}
                  <span className="text-white font-mono">
                    {checkInState.hoursUntil}h {checkInState.minutesUntil}m
                  </span>
                </p>
              </div>
            )}

            {/* CASE B: Window open — active check-in button */}
            {checkInState.case === 'open' && (
              <div className="space-y-3">
                <button
                  onClick={handleCheckIn}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold font-mono tracking-wider hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <><Loader2 size={15} className="animate-spin" /> Processing…</>
                  ) : (
                    <><CheckCircle size={15} /> Perform Online Check-in</>
                  )}
                </button>
                {error && (
                  <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Flight departed */}
            {checkInState.case === 'departed' && (
              <p className="text-center text-xs text-muted-foreground py-2">
                This flight has already departed. Check-in is closed.
              </p>
            )}
          </div>
        </div>

        {/* ── Ticket stub — QR code (only shown when checked in or boarded) ── */}
        <div className="w-full md:w-64 bg-primary/10 p-6 flex flex-col items-center justify-center relative">
          <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-background rounded-full hidden md:block" />

          {/* CASE C: boarded or active → show QR */}
          {(ticket.status === 'active' || ticket.status === 'boarded') ? (
            <>
              <div className="bg-white p-3 rounded-xl mb-4 group-hover:scale-105 transition-transform duration-300">
                <QRCodeSVG
                  value={ticket.qrData}
                  size={120}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="text-center w-full">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Booking Ref</p>
                <p className="font-mono text-base font-bold text-white tracking-widest bg-black/40 py-1 px-2 rounded-md">{bookingReference}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle size={14} />
                <span>{ticket.status === 'boarded' ? 'Boarding Complete' : 'Ready to Board'}</span>
              </div>
            </>
          ) : (
            /* CASE A: not yet checked in → show locked placeholder */
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-28 h-28 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5">
                <Lock size={36} className="text-white/20" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">QR Code</p>
                <p className="text-xs text-white/40 font-mono">Unlocks after check-in</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
