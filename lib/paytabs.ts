import crypto from 'crypto';

interface PayTabsInitOptions {
  profile_id: string;
  tran_type: string;
  tran_class: string;
  cart_id: string;
  cart_currency: string;
  cart_amount: number;
  cart_description: string;
  paypage_lang: string;
  customer_details: {
    name: string;
    email: string;
    street1: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    ip?: string;
  };
  hide_shipping: boolean;
  callback?: string;
  return?: string;
}

interface PayTabsResponse {
  tran_ref: string;
  tran_type: string;
  cart_id: string;
  cart_description: string;
  cart_currency: string;
  cart_amount: string;
  return: string;
  redirect_url: string;
}

export class PayTabsAPI {
  private serverKey: string;
  private profileId: string;
  private regionUrl: string;

  constructor() {
    this.serverKey = process.env.PAYTABS_SERVER_KEY || '';
    this.profileId = process.env.PAYTABS_PROFILE_ID || '';
    this.regionUrl = process.env.PAYTABS_REGION_URL || 'https://secure-global.paytabs.com/';
  }

  async initiatePayment(options: Omit<PayTabsInitOptions, 'profile_id'>): Promise<PayTabsResponse> {
    const payload: PayTabsInitOptions = {
      ...options,
      profile_id: this.profileId,
    };

    const response = await fetch(`${this.regionUrl}payment/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.serverKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayTabs API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // A basic signature verification. For Next.js App router, we usually read headers to compare against the signature.
  verifyWebhookSignature(signature: string, payload: string): boolean {
    // Paytabs sends 'signature' header. We must compute HMAC SHA256 of the RAW body payload using Server Key.
    const computedSignature = crypto
      .createHmac('sha256', this.serverKey)
      .update(payload)
      .digest('hex');

    return signature.toLowerCase() === computedSignature.toLowerCase();
  }
}

export const paytabs = new PayTabsAPI();
