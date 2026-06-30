import React from 'react';
import Navbar from '@/components/navbar';
import { getUserBookings } from '@/actions/travel';
import { getUser } from '@/actions/auth';
import { redirect } from 'next/navigation';
import { ShieldCheck, Info, Plane, Calendar, QrCode } from 'lucide-react';

export default async function BookingsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth');
  }

  const bookings = await getUserBookings();

  return (
    <div className="min-h-screen bg-cyber-black text-foreground flex flex-col">
      <Navbar userEmail={user.email} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-2 border-b border-cyber-cyan/10 pb-6">
          <h1 className="text-3xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-purple uppercase">
            MY_BOOKINGS_REGISTRY
          </h1>
          <p className="text-xs font-mono text-foreground/50 uppercase tracking-widest">
            List and monitor verified aerospace ticket allocations
          </p>
        </div>

        {/* Info banner */}
        <div className="cyber-panel p-4 rounded border border-cyber-cyan/30 bg-cyber-cyan/5 flex items-start gap-3">
          <Info className="w-5 h-5 text-cyber-cyan shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-cyber-cyan uppercase leading-normal">
            <span className="font-bold">SYSTEM_BROADCAST:</span> Boarding passes are active. Always confirm flight schedule status prior to departure.
          </div>
        </div>

        {/* Registry list */}
        <div className="space-y-6">
          {bookings.length === 0 ? (
            <div className="cyber-panel p-12 text-center rounded-lg border border-dashed border-cyber-purple/20">
              <p className="font-mono text-sm text-foreground/45 uppercase tracking-widest">
                No active bookings found in profile registry.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {bookings.map((booking: any) => (
                <div
                  key={booking.id}
                  className="cyber-panel-pink p-6 rounded-lg border border-cyber-pink/20 hover:shadow-[0_0_20px_rgba(255,0,127,0.05)] transition-all duration-300 flex flex-col md:flex-row items-stretch gap-6"
                >
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between border-b border-cyber-pink/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1 bg-cyber-pink/10 rounded text-cyber-pink">
                          <Plane className="w-4 h-4" />
                        </span>
                        <span className="font-mono font-bold text-sm tracking-widest text-cyber-pink">
                          {booking.flights.flight_number}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-foreground/50">
                        BOOKED ON {new Date(booking.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[10px] font-mono text-foreground/40 block uppercase">SECTOR_FROM</span>
                        <span className="font-mono font-bold text-foreground text-sm">
                          {booking.flights.departure_airport}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-foreground/40 block uppercase">SECTOR_TO</span>
                        <span className="font-mono font-bold text-foreground text-sm">
                          {booking.flights.arrival_airport}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-foreground/40 block uppercase">ALLOCATED_SEAT</span>
                        <span className="font-mono font-bold text-cyber-cyan text-sm tracking-wider">
                          {booking.seat_number || 'PENDING'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-foreground/40 block uppercase">STATUS</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-cyber-green bg-cyber-green/5 border border-cyber-green/30 px-2 py-0.5 rounded">
                          <ShieldCheck className="w-3 h-3" />
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* High Tech Pass Barcode Mock */}
                  <div className="w-full md:w-48 border-t md:border-t-0 md:border-l border-cyber-pink/10 pt-6 md:pt-0 md:pl-6 flex flex-col items-center justify-center gap-2">
                    <QrCode className="w-16 h-16 text-cyber-pink/70" />
                    <span className="text-[10px] font-mono text-foreground/40 tracking-wider">REF_ID:</span>
                    <span className="text-xs font-mono font-bold tracking-widest text-foreground">
                      {booking.booking_reference}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
