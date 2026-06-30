'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Plane, Calendar, Clock, MapPin, CheckCircle, Ticket } from 'lucide-react';
import type { ETicketEntity } from '@/lib/entities';

export function BoardingPass({ ticket }: { ticket: ETicketEntity }) {
  if (!ticket.flight) return null;

  const { flight, bookingReference, seatNumber } = ticket;
  const departureDate = new Date(flight.departureTime);
  const arrivalDate = new Date(flight.arrivalTime);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-xl overflow-hidden border-2 border-primary/20 bg-black/60 backdrop-blur-md shadow-2xl transition-all hover:border-primary/40 group max-w-2xl mx-auto w-full">
      <div className="flex flex-col md:flex-row">
        {/* Main Ticket Area */}
        <div className="flex-1 p-6 border-b-2 md:border-b-0 md:border-r-2 border-dashed border-primary/30 relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Plane size={200} className="text-primary rotate-45 transform translate-x-1/4 -translate-y-1/4" />
          </div>
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-sm mb-1 uppercase">
                <Ticket size={16} />
                Boarding Pass
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{flight.airline}</h3>
              <p className="text-muted-foreground font-mono text-sm">Flight: {flight.flightNumber}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors uppercase font-mono tracking-wider ${
              ticket.status === 'boarded'
                ? 'border-emerald-400/50 text-emerald-400 bg-emerald-400/10'
                : ticket.status === 'invalid'
                ? 'border-red-500/50 text-red-400 bg-red-500/10'
                : 'border-primary/50 text-primary bg-primary/5'
            }`}>
              {ticket.status === 'boarded' ? '✓ BOARDED' : ticket.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center mb-8 relative z-10">
            <div className="text-center md:text-left">
              <p className="text-4xl font-black text-white">{flight.departure}</p>
              <div className="flex items-center justify-center md:justify-start gap-1 text-muted-foreground mt-1 text-sm">
                <MapPin size={14} />
                <span>Origin</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center px-2">
              <div className="w-full flex items-center justify-center mb-2">
                <div className="h-px bg-primary/30 w-full" />
                <Plane size={24} className="text-primary mx-2" />
                <div className="h-px bg-primary/30 w-full" />
              </div>
              <span className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">Direct</span>
            </div>

            <div className="text-center md:text-right">
              <p className="text-4xl font-black text-white">{flight.arrival}</p>
              <div className="flex items-center justify-center md:justify-end gap-1 text-muted-foreground mt-1 text-sm">
                <MapPin size={14} />
                <span>Destination</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-primary/5 rounded-xl p-4 relative z-10">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar size={12}/> Date</p>
              <p className="font-semibold text-white text-sm">{formatDate(departureDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock size={12}/> Boarding Time</p>
              <p className="font-semibold text-white text-sm">{formatTime(departureDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gate</p>
              <p className="font-semibold text-white text-sm">TBD</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Seat</p>
              <p className="font-semibold text-primary text-lg">{seatNumber || 'Unassigned'}</p>
            </div>
          </div>
        </div>

        {/* Ticket Stub (QR Code side) */}
        <div className="w-full md:w-64 bg-primary/10 p-6 flex flex-col items-center justify-center relative">
          <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-background rounded-full hidden md:block" />
          
          <div className="bg-white p-3 rounded-xl mb-4 group-hover:scale-105 transition-transform duration-300">
            <QRCodeSVG 
              value={ticket.qrData} 
              size={120}
              level="H"
              includeMargin={false}
              className="text-black"
            />
          </div>
          
          <div className="text-center w-full">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Booking Ref</p>
            <p className="font-mono text-lg font-bold text-white tracking-widest bg-black/40 py-1 rounded-md">{bookingReference}</p>
          </div>
          
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs">
            <CheckCircle size={14} />
            <span>Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
