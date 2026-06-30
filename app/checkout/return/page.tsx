'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Navbar from '@/components/navbar';

function CheckoutReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!bookingId) {
      setStatus('error');
      return;
    }

    const checkPaymentStatus = async () => {
      const supabase = createClient();
      
      // We will poll the database for up to 10 seconds to see if the webhook updated the payment
      let attempts = 0;
      const maxAttempts = 10;
      
      const interval = setInterval(async () => {
        attempts++;
        const { data, error } = await supabase
          .from('payments')
          .select('status')
          .eq('booking_id', bookingId)
          .single();
          
        if (data) {
          if (data.status === 'captured') {
            clearInterval(interval);
            setStatus('success');
            setTimeout(() => {
              router.push('/e-tickets');
            }, 3000);
          } else if (data.status === 'failed') {
            clearInterval(interval);
            setStatus('error');
          }
        }
        
        if (attempts >= maxAttempts && status === 'loading') {
          clearInterval(interval);
          // If we timeout, we might assume success if PayTabs sent us here, or tell them to check email
          // Let's redirect to bookings to be safe
          router.push('/bookings');
        }
      }, 2000);

      return () => clearInterval(interval);
    };

    checkPaymentStatus();
  }, [bookingId, router, status]);

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="cyber-panel max-w-md w-full p-8 rounded-lg border border-cyber-cyan/30 text-center space-y-6">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-cyber-cyan animate-spin mx-auto" />
            <h1 className="text-2xl font-mono font-bold text-cyber-cyan uppercase tracking-widest">Verifying Payment</h1>
            <p className="text-foreground/60 text-sm">Please wait while we confirm your transaction securely...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-cyber-green mx-auto" />
            <h1 className="text-2xl font-mono font-bold text-cyber-green uppercase tracking-widest">Payment Successful</h1>
            <p className="text-foreground/60 text-sm">Your booking is confirmed. Generating E-Ticket...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-cyber-pink mx-auto" />
            <h1 className="text-2xl font-mono font-bold text-cyber-pink uppercase tracking-widest">Payment Failed</h1>
            <p className="text-foreground/60 text-sm">We could not verify your payment or it was declined.</p>
            <button 
              onClick={() => router.push('/flights')}
              className="mt-4 px-6 py-2 bg-cyber-pink/20 text-cyber-pink border border-cyber-pink rounded font-mono uppercase tracking-widest text-sm hover:bg-cyber-pink/40 transition-colors"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function CheckoutReturnPage() {
  return (
    <div className="min-h-screen bg-cyber-black text-foreground flex flex-col">
      <Navbar />
      <Suspense fallback={
        <main className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="w-16 h-16 text-cyber-cyan animate-spin mx-auto" />
        </main>
      }>
        <CheckoutReturnContent />
      </Suspense>
    </div>
  );
}
