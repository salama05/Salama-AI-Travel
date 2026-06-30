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

export async function bookFlight(flightId: string) {
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }
  
  const bookingReference = 'BK-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const seatNumber = `${Math.floor(Math.random() * 30) + 1}${['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)]}`;
  
  // 1. Create Booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id: user.id,
      flight_id: flightId,
      booking_reference: bookingReference,
      seat_number: seatNumber,
      status: 'confirmed',
    })
    .select()
    .single();
    
  if (bookingError || !booking) {
    throw new Error(bookingError?.message || 'Failed to create booking');
  }

  // 2. Generate e-Ticket with a scannable verification URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const qrData = `${appUrl}/verify/ticket/${booking.id}`;
  
  const { error: ticketError } = await supabase
    .from('e_tickets')
    .insert({
      booking_id: booking.id,
      user_id: user.id,
      qr_data: qrData,
      status: 'valid',
    });

  if (ticketError) {
    console.error('Failed to generate e-ticket:', ticketError);
    // Non-fatal, we still return the booking
  }
  
  revalidatePath('/bookings');
  revalidatePath('/e-tickets');
  return booking;
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

export async function performCheckIn(ticketId: string): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  // ─── 1. Auth guard ──────────────────────────────────────────────────────────
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  // ─── 2. Fetch ticket (with flight departure time for validation) ─────────────
  const serviceClient = createServiceRoleClient();
  const { data: ticket, error: fetchError } = await serviceClient
    .from('e_tickets')
    .select(`
      id,
      status,
      user_id,
      bookings (
        id,
        flights ( departure_time )
      )
    `)
    .eq('id', ticketId)
    .single();

  if (fetchError || !ticket) {
    return { success: false, error: 'Ticket not found.' };
  }

  // ─── 3. Ownership check — prevent checking in another user's ticket ──────────
  if (ticket.user_id !== user.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // ─── 4. Status check — only 'valid' tickets can be checked in ───────────────
  if (ticket.status !== 'valid') {
    const msg =
      ticket.status === 'active'
        ? 'You have already completed online check-in for this flight.'
        : ticket.status === 'boarded'
        ? 'This ticket has already been used for boarding.'
        : 'This ticket is no longer valid for check-in.';
    return { success: false, error: msg };
  }

  // ─── 5. SERVER-SIDE 24-hour window guard (prevents any frontend bypass) ──────
  const booking = Array.isArray(ticket.bookings) ? ticket.bookings[0] : ticket.bookings;
  const flight = booking
    ? (Array.isArray(booking.flights) ? booking.flights[0] : booking.flights)
    : null;

  if (!flight?.departure_time) {
    return { success: false, error: 'Could not retrieve flight departure time.' };
  }

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

  // ─── 6. Transition: valid → active ──────────────────────────────────────────
  const { error: updateError } = await serviceClient
    .from('e_tickets')
    .update({ status: 'active' })
    .eq('id', ticketId);

  if (updateError) {
    console.error('[performCheckIn] Supabase update failed:', updateError);
    return { success: false, error: 'Check-in failed due to a server error. Please try again.' };
  }

  // ─── 7. Redis sync — update the ticket status key so AI agent stays current ──
  try {
    await redis.hset(`eticket:${ticketId}`, 'status', 'active', 'checked_in_at', new Date().toISOString());
    await redis.expire(`eticket:${ticketId}`, 60 * 60 * 48); // TTL: 48h
  } catch (redisErr) {
    // Non-fatal: Supabase is the source of truth, Redis is a cache
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
