/**
 * שליחת מיילים דרך Resend (https://resend.com)
 * Railway: RESEND_API_KEY, EMAIL_FROM, SITE_URL
 */

import { getOrderById, getStore } from './db.js';

const RESEND_API = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
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

function getFromAddress(store) {
  const from = process.env.EMAIL_FROM?.trim() || store?.email?.trim();
  const name = process.env.EMAIL_FROM_NAME?.trim() || store?.name || 'החנות';
  if (!from) return null;
  return `${name} <${from}>`;
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

async function sendEmail({ from, to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('RESEND_API_KEY לא מוגדר – מייל לא נשלח');
    return { ok: false, skipped: true };
  }

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
    throw new Error(data.message || data.error || `שגיאת מייל (${res.status})`);
  }
  return { ok: true, id: data.id };
}

export async function sendOrderConfirmationEmail(order, store) {
  if (!order?.email) return { ok: false, skipped: true };

  const from = getFromAddress(store);
  if (!from) {
    console.warn('EMAIL_FROM לא מוגדר – הוסף ב-Railway או בהגדרות החנות');
    return { ok: false, skipped: true };
  }

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
      from,
      to: order.email,
      subject: `אישור הזמנה #${order.id} – ${store?.name || 'החנות'}`,
      html,
    });
  } catch (err) {
    console.error('Order confirmation email failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendOrderShippedEmail(order, store) {
  if (!order?.email || !order.trackingNumber) return { ok: false, skipped: true };

  const from = getFromAddress(store);
  if (!from) return { ok: false, skipped: true };

  const html = orderEmailHtml({
    order,
    store,
    title: 'ההזמנה שלך נשלחה!',
    intro: `שלום ${order.name},<br><br>ההזמנה #${order.id} יצאה למשלוח.`,
  });

  try {
    return await sendEmail({
      from,
      to: order.email,
      subject: `ההזמנה #${order.id} נשלחה – ${store?.name || 'החנות'}`,
      html,
    });
  } catch (err) {
    console.error('Shipped email failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/** שליחה אחרי הזמנה חדשה (לא חוסם את התשובה ללקוח) */
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
