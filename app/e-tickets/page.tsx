import { getUserETickets } from '@/actions/travel';
import { BoardingPass } from '@/components/boarding-pass';
import { mapETicket } from '@/lib/entities';
import { Ticket, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function ETicketsPage() {
  const rawTickets = await getUserETickets();
  const tickets = rawTickets.map((t: any) => 
    mapETicket(t, t.bookings, t.bookings?.flights)
  );

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <Ticket className="text-primary" size={36} />
            My Boarding Passes
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Present these QR codes at the gate for scanning.
          </p>
        </div>
        <Link href="/bookings" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-primary/50 text-primary hover:bg-primary/10 h-10 px-4 py-2">
          <ArrowLeft className="mr-2" size={16} />
          Back to Bookings
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white/5 border-2 border-dashed border-white/10 rounded-xl text-center">
          <Ticket size={48} className="text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-2xl font-bold text-white mb-2">No Boarding Passes Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            You don't have any generated boarding passes. Book a flight to see your tickets here.
          </p>
          <Link href="/flights" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Search Flights
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
          {tickets.map((ticket) => (
            <BoardingPass key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
