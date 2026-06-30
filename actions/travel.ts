'use server';

import { createClientServer, createServiceRoleClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { redis } from '@/lib/redis';

// ─── 24-hour window constant ──────────────────────────────────────────────────
const CHECKIN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function searchFlights(from: string, to: string, date?: string) {
  const supabase = await createClientServer();
  let query = supabase.from('flights').select('*');
  
  if (from) {
    query = query.ilike('departure_airport', `%${from}%`);
  }
  if (to) {
    query = query.ilike('arrival_airport', `%${to}%`);
  }
  
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching flights:', error);
    return [];
  }
  
  return data || [];
}

import { paytabs } from '@/lib/paytabs';

export async function bookFlight(flightId: string) {
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Fetch the flight to get the price
  const { data: flight, error: flightError } = await supabase
    .from('flights')
    .select('*')
    .eq('id', flightId)
    .single();

  if (flightError || !flight) {
    throw new Error('Flight not found');
  }
  
  const bookingReference = 'BK-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  
  // 1. Create Booking (Pending Payment)
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id: user.id,
      flight_id: flightId,
      booking_reference: bookingReference,
      seat_number: null,
      status: 'pending_payment',
    })
    .select()
    .single();
    
  if (bookingError || !booking) {
    throw new Error(bookingError?.message || 'Failed to create booking');
  }

  // 2. Initialize PayTabs payment
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  
  try {
    const paymentResponse = await paytabs.initiatePayment({
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: booking.id,
      cart_currency: 'AED',
      cart_amount: flight.price,
      cart_description: `Flight Booking ${bookingReference}`,
      paypage_lang: 'en',
      customer_details: {
        name: user.user_metadata?.full_name || 'Guest',
        email: user.email || 'guest@example.com',
        street1: 'Dubai',
        city: 'Dubai',
        state: 'DU',
        country: 'AE',
        zip: '00000',
      },
      hide_shipping: true,
      callback: process.env.PAYTABS_CALLBACK_URL || `${appUrl}/api/webhooks/paytabs`,
      return: `${appUrl}/checkout/return?booking_id=${booking.id}`,
    });

    // 3. Store Payment in our DB
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: booking.id,
        user_id: user.id,
        tran_ref: paymentResponse.tran_ref,
        amount: flight.price,
        currency: 'AED',
        status: 'pending',
      });

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError);
      throw new Error('Failed to initialize payment.');
    }

    return { redirect_url: paymentResponse.redirect_url };
  } catch (error: any) {
    console.error('PayTabs error:', error);
    // Rollback booking if payment fails to initialize
    await supabase.from('bookings').delete().eq('id', booking.id);
    throw new Error('Payment gateway error. Please try again.');
  }
}

export async function getUserBookings() {
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) return [];
  
  const { data, error } = await supabase
    .from('bookings')
    .select('*, flights(*)')
    .eq('user_id', user.id);
    
  if (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
  
  return data || [];
}

export async function getUserETickets() {
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) return [];
  
  // Join e_tickets with bookings and flights
  const { data, error } = await supabase
    .from('e_tickets')
    .select(`
      *,
      bookings (
        *,
        flights (*)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching e-tickets:', error);
    return [];
  }
  
  return data || [];
}

export async function getFlightOccupiedSeats(flightId: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('seat_number')
    .eq('flight_id', flightId)
    .not('status', 'eq', 'cancelled');

  if (error || !data) {
    console.error('Error fetching occupied seats:', error);
    return [];
  }

  return data.map((b) => b.seat_number).filter(Boolean) as string[];
}

export async function performCheckIn(
  ticketId: string,
  passportNumber: string,
  passportExpiry: string,
  seatNumber: string
): Promise<{ success: true } | { success: false; error: string }> {
  // ─── 1. Validation ──────────────────────────────────────────────────────────
  if (!passportNumber.trim()) {
    return { success: false, error: 'Passport number is required.' };
  }
  if (!passportExpiry.trim()) {
    return { success: false, error: 'Passport expiry date is required.' };
  }
  if (!seatNumber.trim()) {
    return { success: false, error: 'Seat selection is required.' };
  }

  // ─── 2. Auth guard ──────────────────────────────────────────────────────────
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  // ─── 3. Fetch ticket ────────────────────────────────────────────────────────
  const serviceClient = createServiceRoleClient();
  const { data: ticket, error: fetchError } = await serviceClient
    .from('e_tickets')
    .select(`
      id,
      status,
      user_id,
      bookings (
        id,
        flight_id,
        flights ( departure_time )
      )
    `)
    .eq('id', ticketId)
    .single();

  if (fetchError || !ticket) {
    return { success: false, error: 'Ticket not found.' };
  }

  // ─── 4. Ownership check ─────────────────────────────────────────────────────
  if (ticket.user_id !== user.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // ─── 5. Status check ────────────────────────────────────────────────────────
  if (ticket.status !== 'valid') {
    const msg =
      ticket.status === 'active'
        ? 'You have already completed online check-in for this flight.'
        : ticket.status === 'boarded'
        ? 'This ticket has already been used for boarding.'
        : 'This ticket is no longer valid for check-in.';
    return { success: false, error: msg };
  }

  const booking = Array.isArray(ticket.bookings) ? ticket.bookings[0] : ticket.bookings;
  const flight = booking
    ? (Array.isArray(booking.flights) ? booking.flights[0] : booking.flights)
    : null;

  if (!booking || !flight?.departure_time) {
    return { success: false, error: 'Could not retrieve flight departure time.' };
  }

  // ─── 6. Time window check ───────────────────────────────────────────────────
  const now = Date.now();
  const departure = new Date(flight.departure_time).getTime();
  const msUntilDeparture = departure - now;

  if (msUntilDeparture <= 0) {
    return { success: false, error: 'This flight has already departed. Check-in is closed.' };
  }

  if (msUntilDeparture > CHECKIN_WINDOW_MS) {
    const hoursLeft = Math.floor(msUntilDeparture / (1000 * 60 * 60));
    return {
      success: false,
      error: `Online check-in opens 24 hours before departure. Opens in approximately ${hoursLeft} hours.`,
    };
  }

  // ─── 7. Seat availability double-check (prevent race condition/bypass) ──────
  const occupiedSeats = await getFlightOccupiedSeats(booking.flight_id);
  if (occupiedSeats.includes(seatNumber)) {
    return { success: false, error: `Seat ${seatNumber} is already occupied. Please select another seat.` };
  }

  // ─── 8. DB Transaction / Sequence ──────────────────────────────────────────
  // A. Update booking with the selected seat
  const { error: bookingUpdateError } = await serviceClient
    .from('bookings')
    .update({ seat_number: seatNumber })
    .eq('id', booking.id);

  if (bookingUpdateError) {
    console.error('[performCheckIn] Booking seat update failed:', bookingUpdateError);
    if (bookingUpdateError.code === '23505') {
      return {
        success: false,
        error: `Seat ${seatNumber} was just taken by another passenger. Please select a different seat.`,
      };
    }
    return { success: false, error: 'Failed to assign seat. Please try again.' };
  }

  // B. Update e-ticket with status and passport details
  const { error: ticketUpdateError } = await serviceClient
    .from('e_tickets')
    .update({
      status: 'active',
      passport_number: passportNumber,
      passport_expiry: passportExpiry,
    })
    .eq('id', ticketId);

  if (ticketUpdateError) {
    console.error('[performCheckIn] Ticket check-in update failed:', ticketUpdateError);
    // Revert the seat booking just in case
    await serviceClient.from('bookings').update({ seat_number: null }).eq('id', booking.id);
    return { success: false, error: 'Check-in failed. Please try again.' };
  }

  // ─── 9. Redis sync — update ticket status and seat ─────────────────────────
  try {
    await redis.hset(
      `eticket:${ticketId}`,
      'status', 'active',
      'seat_number', seatNumber,
      'passport_number', passportNumber,
      'checked_in_at', new Date().toISOString()
    );
    await redis.expire(`eticket:${ticketId}`, 60 * 60 * 48); // TTL: 48h
  } catch (redisErr) {
    console.error('[performCheckIn] Redis sync failed (non-fatal):', redisErr);
  }

  revalidatePath('/e-tickets');
  return { success: true };
}

export async function createTicket(subject: string, description: string) {
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }
  
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      subject,
      description,
      status: 'open',
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(error.message);
  }
  
  revalidatePath('/tickets');
  return data;
}

export async function getUserTickets() {
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) return [];
  
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id);
    
  if (error) {
    console.error('Error fetching support tickets:', error);
    return [];
  }
  
  return data || [];
}
