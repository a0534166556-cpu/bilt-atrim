/**
 * שליחת מיילים – SendGrid או Resend
 * Railway: SENDGRID_API_KEY (מומלץ) או RESEND_API_KEY, EMAIL_FROM, SITE_URL
 */

import { getOrderById, getStore } from './db.js';

const RESEND_API = 'https://api.resend.com/emails';
const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';

export function isEmailConfigured() {
  return Boolean(
    process.env.SENDGRID_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim()
  );
}

function useSendGrid() {
  return Boolean(process.env.SENDGRID_API_KEY?.trim());
}

function formatIls(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₪0';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(n);
}

function getFromParts(store) {
  const email = process.env.EMAIL_FROM?.trim() || store?.email?.trim();
  const name = process.env.EMAIL_FROM_NAME?.trim() || store?.name || 'החנות';
  return { email, name };
}

/** פורמט Resend: "Name <email>" */
function getFromAddress(store) {
  const { email, name } = getFromParts(store);
  if (!email) return null;
  return `${name} <${email}>`;
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://bilt-atrim.netlify.app').replace(/\/$/, '');
}

function orderEmailHtml({ order, store, title, intro }) {
  const trackUrl = `${siteUrl()}/track-order`;
  const itemsHtml = (order.items || [])
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:left">${formatIls(i.price)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px">
    <h1 style="color:#1a73e8;font-size:22px;margin:0 0 16px">${title}</h1>
    <p style="color:#333;line-height:1.6">${intro}</p>
    <p style="font-size:18px;background:#e8f0fe;padding:12px;border-radius:6px">
      <strong>מספר הזמנה:</strong> ${order.id}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f1f3f4">
          <th style="padding:8px;text-align:right">מוצר</th>
          <th style="padding:8px">כמות</th>
          <th style="padding:8px;text-align:left">מחיר</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p><strong>סה״כ:</strong> ${formatIls(order.total)}</p>
    <p><strong>כתובת:</strong> ${order.address}${order.city ? `, ${order.city}` : ''}</p>
    ${
      order.trackingNumber
        ? `<p><strong>מספר מעקב:</strong> ${order.trackingNumber}</p>`
        : ''
    }
    <p style="margin-top:24px">
      <a href="${trackUrl}" style="display:inline-block;background:#1a73e8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">
        מעקב הזמנה
      </a>
    </p>
    <p style="color:#666;font-size:13px;margin-top:24px">
      לשאלות: ${store?.email || ''} ${store?.phone ? `| ${store.phone}` : ''}
    </p>
  </div>
</body>
</html>`;
}

async function sendViaSendGrid({ fromEmail, fromName, to, subject, html }) {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const res = await fetch(SENDGRID_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.errors?.[0]?.message || `שגיאת SendGrid (${res.status})`;
    throw new Error(msg);
  }
  return { ok: true };
}

async function sendViaResend({ from, to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `שגיאת Resend (${res.status})`);
  }
  return { ok: true, id: data.id };
}

async function sendEmail({ to, subject, html, store }) {
  if (!isEmailConfigured()) {
    console.warn('SENDGRID_API_KEY או RESEND_API_KEY לא מוגדר');
    return { ok: false, skipped: true };
  }

  const { email: fromEmail, name: fromName } = getFromParts(store);
  if (!fromEmail) {
    console.warn('EMAIL_FROM לא מוגדר – הוסף ב-Railway');
    return { ok: false, skipped: true };
  }

  if (useSendGrid()) {
    return sendViaSendGrid({ fromEmail, fromName, to, subject, html });
  }

  const from = getFromAddress(store);
  return sendViaResend({ from, to, subject, html });
}

export async function sendOrderConfirmationEmail(order, store) {
  if (!order?.email) return { ok: false, skipped: true };

  const paymentLabel =
    order.paymentMethod === 'stripe' ? 'כרטיס אשראי (שולם)' : 'תשלום במזומן/העברה';

  const html = orderEmailHtml({
    order,
    store,
    title: `תודה על ההזמנה – ${store?.name || 'החנות'}`,
    intro: `שלום ${order.name},<br><br>קיבלנו את ההזמנה שלך (${paymentLabel}). שמרי/שמור את מספר ההזמנה למעקב.`,
  });

  try {
    return await sendEmail({
      to: order.email,
      subject: `אישור הזמנה #${order.id} – ${store?.name || 'החנות'}`,
      html,
      store,
    });
  } catch (err) {
    console.error('Order confirmation email failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendOrderShippedEmail(order, store) {
  if (!order?.email || !order.trackingNumber) return { ok: false, skipped: true };

  const html = orderEmailHtml({
    order,
    store,
    title: 'ההזמנה שלך נשלחה!',
    intro: `שלום ${order.name},<br><br>ההזמנה #${order.id} יצאה למשלוח.`,
  });

  try {
    return await sendEmail({
      to: order.email,
      subject: `ההזמנה #${order.id} נשלחה – ${store?.name || 'החנות'}`,
      html,
      store,
    });
  } catch (err) {
    console.error('Shipped email failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function notifyOrderConfirmation(orderId) {
  if (!isEmailConfigured()) return;
  try {
    const order = await getOrderById(orderId);
    const store = await getStore();
    if (order) await sendOrderConfirmationEmail(order, store);
  } catch (err) {
    console.error('notifyOrderConfirmation:', err.message);
  }
}

export async function notifyOrderShipped(orderId) {
  if (!isEmailConfigured()) return;
  try {
    const order = await getOrderById(orderId);
    const store = await getStore();
    if (order?.trackingNumber) await sendOrderShippedEmail(order, store);
  } catch (err) {
    console.error('notifyOrderShipped:', err.message);
  }
}
