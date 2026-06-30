import { NextResponse } from 'next/server';
import { paytabs } from '@/lib/paytabs';
import { createServiceRoleClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
    }

    const payloadText = await request.text();
    const isValid = paytabs.verifyWebhookSignature(signature, payloadText);

    if (!isValid) {
      console.error('Invalid PayTabs webhook signature.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Safely parse JSON
    let data;
    try {
      data = JSON.parse(payloadText);
    } catch (e) {
      // Paytabs might send URL encoded data in some configurations, but usually JSON
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    const tranRef = data.tran_ref;
    const cartId = data.cart_id; // This is our booking_id
    const responseStatus = data.payment_result?.response_status; // 'A' = Authorized/Captured

    const supabase = createServiceRoleClient();

    if (responseStatus === 'A') {
      // 1. Update Payment Status
      await supabase
        .from('payments')
        .update({ status: 'captured' })
        .eq('booking_id', cartId);

      // 2. Update Booking Status
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', cartId)
        .select()
        .single();

      if (bookingError || !booking) {
        console.error('Webhook: Failed to update booking', bookingError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // 3. Generate E-Ticket
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const qrData = `${appUrl}/verify/ticket/${booking.id}`;
      
      // Check if ticket already exists just in case (idempotency)
      const { data: existingTicket } = await supabase
        .from('e_tickets')
        .select('id')
        .eq('booking_id', booking.id)
        .single();

      if (!existingTicket) {
        await supabase
          .from('e_tickets')
          .insert({
            booking_id: booking.id,
            user_id: booking.user_id,
            qr_data: qrData,
            status: 'valid',
          });
      }
    } else {
      // Handle Failed or Cancelled Payment
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('booking_id', cartId);
      
      // Optionally update booking to cancelled or keep pending
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', cartId);
    }

    return NextResponse.json({ message: 'Webhook received and processed' });
  } catch (error) {
    console.error('Error in PayTabs Webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
