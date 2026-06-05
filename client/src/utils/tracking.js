/** קישור מעקב חכם (17track) */
export function trackingUrl(trackingNumber) {
  const num = String(trackingNumber || '').trim();
  if (!num) return null;
  return `https://t.17track.net/he#nums=${encodeURIComponent(num)}`;
}
