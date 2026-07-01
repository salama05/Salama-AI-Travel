/**
 * /verify/ticket/[id] — Automated QR Code Verification Page
 *
 * This is a pure Server Component. It runs verifyTicket() automatically
 * the moment the page is loaded — no buttons, no client-side JavaScript.
 *
 * Flow:
 *  1. QR code is scanned → browser opens this URL
 *  2. Next.js renders this page server-side
 *  3. verifyTicket() fires → Supabase status transitions to 'boarded'
 *  4. Page renders the result (success / already used / invalid)
 */

import { verifyTicket } from '@/actions/verify';
import { CheckCircle2, XCircle, AlertTriangle, Plane, User, Armchair } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VerifyTicketPage({ params }: PageProps) {
  const { id } = await params;
  const result = await verifyTicket(id);

  // ─── ALREADY SCANNED ─────────────────────────────────────────────────────────
  if (result.outcome === 'already_scanned') {
    return (
      <VerifyLayout>
        <StatusCard
          icon={<AlertTriangle className="w-16 h-16 text-amber-400" />}
          title="Already Boarded"
          subtitle="This ticket has already been scanned."
          borderColor="border-amber-400/30"
          bgColor="bg-amber-400/5"
        >
          <InfoRow label="Booking Reference" value={result.bookingReference} />
          <div className="mt-6 text-center text-sm text-muted-foreground">
            If this is an error, please contact airport staff immediately.
          </div>
        </StatusCard>
      </VerifyLayout>
    );
  }

  // ─── INVALID ─────────────────────────────────────────────────────────────────
  if (result.outcome === 'invalid') {
    return (
      <VerifyLayout>
        <StatusCard
          icon={<XCircle className="w-16 h-16 text-red-500" />}
          title="Ticket Invalid"
          subtitle={result.reason}
          borderColor="border-red-500/30"
          bgColor="bg-red-500/5"
        >
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Deny boarding and contact supervisor.
          </div>
        </StatusCard>
      </VerifyLayout>
    );
  }

  // ─── BOARDED ─────────────────────────────────────────────────────────────────
  return (
    <VerifyLayout>
      <StatusCard
        icon={<CheckCircle2 className="w-16 h-16 text-emerald-400" />}
        title="Boarding Confirmed"
        subtitle="Ticket verified successfully. Passenger may board."
        borderColor="border-emerald-400/30"
        bgColor="bg-emerald-400/5"
      >
        <div className="grid grid-cols-2 gap-3 mt-4">
          <InfoRow label="Booking Ref" value={result.bookingReference} />
          <InfoRow label="Flight" value={result.flightNumber} />
          <InfoRow label="Route" value={`${result.departure} → ${result.arrival}`} />
          <InfoRow label="Seat" value={result.seatNumber ?? 'Unassigned'} accent />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
          <Plane className="w-4 h-4" />
          <span>Status updated to BOARDED</span>
        </div>
      </StatusCard>
    </VerifyLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-black p-4">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <span className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink">
            SALAMA_AI_TRAVEL
          </span>
          <p className="text-xs font-mono text-muted-foreground mt-1 tracking-widest uppercase">
            Gate Verification System
          </p>
        </div>
        {children}
        <div className="text-center mt-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-primary font-mono transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  subtitle,
  borderColor,
  bgColor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  borderColor: string;
  bgColor: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} backdrop-blur-md p-8`}>
      <div className="flex flex-col items-center text-center mb-6">
        {icon}
        <h1 className="text-2xl font-black text-white mt-4">{title}</h1>
        <p className="text-muted-foreground text-sm mt-2">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-black/30 rounded-lg p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-mono font-bold text-sm ${accent ? 'text-primary' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
