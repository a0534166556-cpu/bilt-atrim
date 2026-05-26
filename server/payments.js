import Stripe from 'stripe';
import { confirmOrderPayment, setOrderStripeSession } from './db.js';
import { notifyOrderConfirmation } from './email.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let stripe;
if (stripeSecret) {
  stripe = new Stripe(stripeSecret);
}

export function isStripeEnabled() {
  return Boolean(stripe);
}

export function getPaymentConfig() {
  return {
    stripeEnabled: isStripeEnabled(),
    currency: 'ILS',
    codEnabled: true,
  };
}

export async function createStripeCheckoutSession(orderId, orderData, orderItems) {
  if (!stripe) throw new Error('תשלום בכרטיס אשראי לא מוגדר בשרת');

  const description = orderItems
    .map((i) => `${i.name} × ${i.quantity}`)
    .join(' | ');

  const lineItems = [
    {
      price_data: {
        currency: 'ils',
        product_data: {
          name: `הזמנה #${orderId}`,
          description: description.slice(0, 500),
        },
        unit_amount: Math.round(orderData.total * 100),
      },
      quantity: 1,
    },
  ];

  const successUrl = `${process.env.SITE_URL || 'http://localhost:5173'}/order-success/${orderId}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${process.env.SITE_URL || 'http://localhost:5173'}/checkout?cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    customer_email: orderData.email,
    client_reference_id: String(orderId),
    metadata: { orderId: String(orderId) },
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: 'he',
  });

  await setOrderStripeSession(orderId, session.id);
  return session.url;
}

export async function verifyStripeSession(sessionId) {
  if (!stripe) return { ok: false, error: 'Stripe לא מוגדר' };
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') {
    return { ok: false, error: 'התשלום לא הושלם' };
  }
  const orderId = Number(session.metadata?.orderId || session.client_reference_id);
  if (!orderId) return { ok: false, error: 'הזמנה לא נמצאה' };
  await confirmOrderPayment(orderId, session.id);
  return { ok: true, orderId };
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!stripe || !webhookSecret) {
    throw new Error('Webhook לא מוגדר');
  }
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const orderId = Number(session.metadata?.orderId || session.client_reference_id);
      if (orderId) {
        const result = await confirmOrderPayment(orderId, session.id);
        if (result.newlyConfirmed) {
          notifyOrderConfirmation(orderId).catch(() => {});
        }
      }
    }
  }
  return { received: true };
}
