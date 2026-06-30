'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/navbar';
import { searchFlights, bookFlight } from '@/actions/travel';
import { getUser } from '@/actions/auth';
import { Search, PlaneTakeoff, PlaneLanding, Calendar, DollarSign, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Flight {
  id: string;
  flight_number: string;
  airline: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  status: string;
}

export default function FlightsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [bookingStatus, setBookingStatus] = useState<{ [key: string]: 'booking' | 'success' | 'error' | null }>({});
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const u = await getUser();
      setUser(u);
    }
    loadUser();
    handleSearch();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const results = await searchFlights(from, to);
      setFlights(results as Flight[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (flightId: string) => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setBookingStatus((prev) => ({ ...prev, [flightId]: 'booking' }));
    try {
      await bookFlight(flightId);
      setBookingStatus((prev) => ({ ...prev, [flightId]: 'success' }));
      setTimeout(() => {
        router.push('/bookings');
      }, 1500);
    } catch (err) {
      console.error(err);
      setBookingStatus((prev) => ({ ...prev, [flightId]: 'error' }));
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-foreground flex flex-col">
      <Navbar userEmail={user?.email} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-2 border-b border-cyber-cyan/10 pb-6">
          <h1 className="text-3xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-purple uppercase">
            FLIGHT_DIRECTORY_CORE
          </h1>
          <p className="text-xs font-mono text-foreground/50 uppercase tracking-widest">
            Search active aerospace transits and execute secure booking reservations
          </p>
        </div>

        {/* Search Panel */}
        <div className="cyber-panel p-6 rounded-lg border-l-2 border-l-cyber-cyan shadow-[0_0_20px_rgba(0,240,255,0.05)]">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-mono text-cyber-cyan uppercase tracking-widest mb-2">
                Origin Airport (From)
              </label>
              <div className="relative">
                <PlaneTakeoff className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input
                  type="text"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="e.g. LAX, JFK, DXB"
                  className="w-full pl-10 pr-4 py-2.5 bg-cyber-black/60 border border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-cyber-cyan uppercase tracking-widest mb-2">
                Destination Airport (To)
              </label>
              <div className="relative">
                <PlaneLanding className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="e.g. LHR, HND, SFO"
                  className="w-full pl-10 pr-4 py-2.5 bg-cyber-black/60 border border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 rounded text-sm font-mono placeholder-foreground/20 text-foreground transition-all duration-300 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyber-cyan/15 hover:bg-cyber-cyan/35 text-cyber-cyan border border-cyber-cyan font-mono font-bold tracking-widest text-xs rounded transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer uppercase shadow-[0_0_15px_rgba(0,240,255,0.1)]"
            >
              <Search className="w-4 h-4" />
              {loading ? 'QUERYING_SECTORS...' : 'SCAN_AEROSPACE'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <h2 className="text-lg font-mono font-bold tracking-widest text-foreground/80 uppercase">
            {flights.length} SECTOR_PATHS_DETECTED
          </h2>

          {flights.length === 0 ? (
            <div className="cyber-panel p-12 text-center rounded-lg border border-dashed border-cyber-purple/20">
              <p className="font-mono text-sm text-foreground/45 uppercase tracking-widest">
                No aerospace routes found. Try clearing filters to load all channels.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {flights.map((flight) => {
                const status = bookingStatus[flight.id];
                return (
                  <div
                    key={flight.id}
                    className="cyber-panel p-6 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/40 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                      <div>
                        <div className="text-xs font-mono text-cyber-purple tracking-widest uppercase">
                          {flight.airline}
                        </div>
                        <div className="text-lg font-black font-mono tracking-wider text-foreground">
                          {flight.flight_number}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 col-span-2">
                        <div className="text-left">
                          <span className="text-xs font-mono text-foreground/40 block">DEPART</span>
                          <span className="font-mono font-bold text-cyber-cyan text-lg">
                            {flight.departure_airport}
                          </span>
                          <span className="text-xs font-mono block text-foreground/60">
                            {new Date(flight.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <ArrowRight className="w-5 h-5 text-cyber-purple/50" />
                        <div className="text-left">
                          <span className="text-xs font-mono text-foreground/40 block">ARRIVE</span>
                          <span className="font-mono font-bold text-cyber-cyan text-lg">
                            {flight.arrival_airport}
                          </span>
                          <span className="text-xs font-mono block text-foreground/60">
                            {new Date(flight.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-mono text-foreground/40 block uppercase">TRANSIT_COST</span>
                        <span className="text-xl font-bold font-mono text-cyber-pink tracking-wider flex items-center">
                          <DollarSign className="w-4 h-4 text-cyber-pink/70" />
                          {flight.price}
                        </span>
                      </div>
                    </div>

                    <div className="w-full md:w-auto shrink-0">
                      <button
                        onClick={() => handleBook(flight.id)}
                        disabled={status === 'booking' || status === 'success'}
                        className={`w-full md:w-auto px-6 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
                          status === 'success'
                            ? 'bg-cyber-green/10 border border-cyber-green text-cyber-green shadow-[0_0_15px_rgba(57,255,20,0.2)]'
                            : status === 'booking'
                            ? 'bg-cyber-cyan/10 border border-cyber-cyan text-cyber-cyan animate-pulse'
                            : 'bg-cyber-pink/15 hover:bg-cyber-pink/35 border border-cyber-pink text-cyber-pink shadow-[0_0_15px_rgba(255,0,127,0.1)]'
                        }`}
                      >
                        {status === 'success' ? (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            CONFIRMED_OK
                          </>
                        ) : status === 'booking' ? (
                          'BOOKING...'
                        ) : (
                          <>
                            <Ticket className="w-4 h-4" />
                            EXECUTE_RESERVATION
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
