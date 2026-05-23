import { getProductById, validateCoupon, getStore, getEffectivePrice } from './db.js';

export const SHIPPING_COST = 29;

export function calcShipping(subtotal, store) {
  const min = store?.freeShippingMin || 0;
  if (min > 0 && subtotal >= min) return 0;
  return subtotal > 0 ? SHIPPING_COST : 0;
}

export async function buildOrderFromBody(body) {
  const { name, email, phone, address, city, notes, items, couponCode } = body;
  if (!name || !email || !phone || !address || !items?.length) {
    return { error: 'יש למלא את כל השדות החובה' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'אימייל לא תקין' };
  }

  const orderItems = [];
  for (const item of items) {
    const product = await getProductById(item.id);
    if (!product || !product.active) {
      return { error: `מוצר ${item.name || ''} לא זמין` };
    }
    const qty = Math.max(1, Math.min(Number(item.quantity) || 1, product.stock));
    if (qty < (Number(item.quantity) || 1)) {
      return { error: `אין מספיק מלאי עבור ${product.name}` };
    }
    orderItems.push({
      id: product.id,
      name: product.name,
      quantity: qty,
      price: getEffectivePrice(product),
    });
  }

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  let discount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, subtotal);
    if (couponResult.error) return { error: couponResult.error };
    discount = couponResult.discount;
    appliedCoupon = couponResult.coupon.code;
  }
  const store = await getStore();
  const afterDiscount = subtotal - discount;
  const shippingCost = calcShipping(afterDiscount, store);
  const total = afterDiscount + shippingCost;

  const orderData = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    address: address.trim(),
    city: (city || '').trim(),
    notes: (notes || '').trim(),
    subtotal,
    discount,
    couponCode: appliedCoupon,
    shippingCost,
    total,
  };

  return { orderData, orderItems, total };
}
