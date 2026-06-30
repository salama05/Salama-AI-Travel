'use client';

/**
 * components/ticket-admin-table.tsx
 *
 * Interactive admin table for managing support tickets.
 * Uses optimistic UI: the status badge updates instantly on selection while
 * the server action runs in the background. If the action fails, the badge
 * reverts and an error toast is shown.
 */

import { useState, useTransition, useCallback } from 'react';
import { updateTicketStatus } from '@/actions/admin';
import { SupportTicketEntity, TicketStatus, TICKET_STATUSES } from '@/lib/entities';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  User,
  Calendar,
  Hash,
} from 'lucide-react';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; color: string; bg: string; border: string; Icon: React.ElementType }
> = {
  open: {
    label: 'OPEN',
    color: 'text-cyber-cyan',
    bg: 'bg-cyber-cyan/5',
    border: 'border-cyber-cyan/40',
    Icon: ShieldAlert,
  },
  resolved: {
    label: 'RESOLVED',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/5',
    border: 'border-emerald-400/40',
    Icon: CheckCircle2,
  },
  closed: {
    label: 'CLOSED',
    color: 'text-foreground/40',
    bg: 'bg-foreground/5',
    border: 'border-foreground/20',
    Icon: XCircle,
  },
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── TicketRow ────────────────────────────────────────────────────────────────

function TicketRow({ ticket: initial }: { ticket: SupportTicketEntity }) {
  const [status, setStatus] = useState<TicketStatus>(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = useCallback(
    (newStatus: TicketStatus) => {
      if (newStatus === status || isPending) return;
      const previous = status;
      // Optimistic update
      setStatus(newStatus);
      setError(null);

      startTransition(async () => {
        const result = await updateTicketStatus(initial.id, newStatus);
        if (!result.success) {
          // Revert on failure
          setStatus(previous);
          setError(result.error ?? 'Unknown error');
        }
      });
    },
    [status, isPending, initial.id]
  );

  return (
    <div
      className={`cyber-panel rounded-lg border transition-all duration-300 ${
        status === 'open'
          ? 'border-cyber-cyan/15 hover:border-cyber-cyan/30'
          : status === 'resolved'
          ? 'border-emerald-400/15 hover:border-emerald-400/30'
          : 'border-foreground/10 hover:border-foreground/20'
      } p-5 space-y-3`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-3.5 h-3.5 text-cyber-purple/60 shrink-0" />
            <span className="text-[10px] font-mono text-foreground/35 truncate">
              {initial.id}
            </span>
          </div>
          <h3 className="text-sm font-mono font-bold text-foreground truncate">
            {initial.subject}
          </h3>
        </div>

        {/* Status Selector */}
        <div className="shrink-0 flex items-center gap-2">
          {isPending && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyber-purple" />
          )}
          <div className="relative">
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              disabled={isPending}
              aria-label={`Change status for ticket: ${initial.subject}`}
              className="appearance-none pl-2.5 pr-7 py-1.5 rounded border text-[11px] font-mono font-bold bg-cyber-black border-cyber-purple/30 text-cyber-purple hover:border-cyber-purple/60 focus:border-cyber-purple focus:outline-none focus:ring-1 focus:ring-cyber-purple/50 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            {/* Custom dropdown arrow */}
            <RefreshCw className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyber-purple/60" />
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm font-sans text-foreground/65 leading-relaxed line-clamp-2">
        {initial.description}
      </p>

      {/* Footer Meta */}
      <div className="flex items-center gap-4 pt-1 border-t border-foreground/5">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/35">
          <User className="w-3 h-3" />
          {initial.userEmail ?? initial.userId}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/35">
          <Calendar className="w-3 h-3" />
          {new Date(initial.createdAt).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-red-400 bg-red-400/5 border border-red-400/20 rounded px-3 py-2">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>UPDATE_FAILED: {error}</span>
        </div>
      )}
    </div>
  );
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────

function StatsBar({ tickets }: { tickets: SupportTicketEntity[] }) {
  const counts = tickets.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TicketStatus, number>
  );

  const stats: { label: string; value: number; color: string }[] = [
    { label: 'TOTAL', value: tickets.length, color: 'text-foreground/60' },
    { label: 'OPEN', value: counts.open ?? 0, color: 'text-cyber-cyan' },
    { label: 'RESOLVED', value: counts.resolved ?? 0, color: 'text-emerald-400' },
    { label: 'CLOSED', value: counts.closed ?? 0, color: 'text-foreground/35' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map(({ label, value, color }) => (
        <div
          key={label}
          className="cyber-panel rounded-lg border border-cyber-cyan/10 p-4 text-center"
        >
          <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
          <p className="text-[10px] font-mono text-foreground/40 uppercase tracking-widest mt-0.5">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

type FilterStatus = 'all' | TicketStatus;

const FILTER_OPTIONS: { label: string; value: FilterStatus }[] = [
  { label: 'ALL', value: 'all' },
  { label: 'OPEN', value: 'open' },
  { label: 'RESOLVED', value: 'resolved' },
  { label: 'CLOSED', value: 'closed' },
];

// ─── Main Export: TicketAdminTable ────────────────────────────────────────────

export default function TicketAdminTable({
  tickets: initialTickets,
}: {
  tickets: SupportTicketEntity[];
}) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

  const filtered = initialTickets.filter((t) => {
    const matchesStatus = filter === 'all' || t.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.subject.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.userEmail ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsBar tickets={initialTickets} />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status Filters */}
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest rounded border transition-all duration-200 cursor-pointer ${
                filter === value
                  ? 'bg-cyber-purple/20 border-cyber-purple text-cyber-purple'
                  : 'bg-transparent border-foreground/15 text-foreground/40 hover:border-cyber-purple/40 hover:text-cyber-purple/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search tickets, users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-1.5 bg-cyber-black/60 border border-foreground/15 focus:border-cyber-purple focus:ring-1 focus:ring-cyber-purple/40 rounded text-sm font-mono placeholder-foreground/25 text-foreground transition-all duration-200 outline-none"
        />
      </div>

      {/* Ticket Count */}
      <p className="text-[11px] font-mono text-foreground/35 uppercase tracking-widest">
        Displaying {filtered.length} of {initialTickets.length} tickets
      </p>

      {/* Ticket List */}
      {filtered.length === 0 ? (
        <div className="cyber-panel p-16 text-center rounded-lg border border-dashed border-cyber-purple/20">
          <p className="font-mono text-sm text-foreground/35 uppercase tracking-widest">
            No tickets match the current filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
