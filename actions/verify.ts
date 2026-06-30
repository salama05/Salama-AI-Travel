'use server';

import { createServiceRoleClient } from '@/lib/supabase';

export type VerificationResult =
  | { outcome: 'boarded'; bookingReference: string; flightNumber: string; departure: string; arrival: string; seatNumber: string | null }
  | { outcome: 'already_scanned'; bookingReference: string }
  | { outcome: 'invalid'; reason: string };

/**
 * verifyTicket — called automatically when the verification page loads.
 *
 * Uses the service-role client to bypass RLS, because the scanner is
 * an unauthenticated device (airport gate iPad, phone camera, etc.).
 *
 * Status transitions:
 *   'valid'   → 'boarded'   ✅
 *   'boarded' → (no change) ⚠️ already scanned
 *   any other → (no change) ❌ invalid
 */
export async function verifyTicket(ticketId: string): Promise<VerificationResult> {
  const supabase = createServiceRoleClient();

  // 1. Fetch the e-ticket, join booking + flight for display info
  const { data: ticket, error: fetchError } = await supabase
    .from('e_tickets')
    .select(`
      id,
      status,
      bookings (
        booking_reference,
        seat_number,
        flights (
          flight_number,
          departure_airport,
          arrival_airport
        )
      )
    `)
    .eq('id', ticketId)
    .single();

  if (fetchError || !ticket) {
    return { outcome: 'invalid', reason: 'Ticket not found. It may have been cancelled.' };
  }

  const booking = Array.isArray(ticket.bookings) ? ticket.bookings[0] : ticket.bookings;
  const flight = booking
    ? (Array.isArray(booking.flights) ? booking.flights[0] : booking.flights)
    : null;

  // 2. Handle already-boarded case
  if (ticket.status === 'boarded') {
    return {
      outcome: 'already_scanned',
      bookingReference: booking?.booking_reference ?? 'N/A',
    };
  }

  // 3. Reject any other non-valid status
  if (ticket.status !== 'valid') {
    return {
      outcome: 'invalid',
      reason: `Ticket status is '${ticket.status}'. This ticket cannot be used for boarding.`,
    };
  }

  // 4. Transition: valid → boarded
  const { error: updateError } = await supabase
    .from('e_tickets')
    .update({ status: 'boarded' })
    .eq('id', ticketId);

  if (updateError) {
    console.error('[verify-ticket] Failed to update status:', updateError);
    return { outcome: 'invalid', reason: 'Verification failed due to a server error. Please try again.' };
  }

  return {
    outcome: 'boarded',
    bookingReference: booking?.booking_reference ?? 'N/A',
    flightNumber: flight?.flight_number ?? 'N/A',
    departure: flight?.departure_airport ?? 'N/A',
    arrival: flight?.arrival_airport ?? 'N/A',
    seatNumber: booking?.seat_number ?? null,
  };
}
