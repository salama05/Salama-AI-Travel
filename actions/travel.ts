'use server';

import { createClientServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

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
