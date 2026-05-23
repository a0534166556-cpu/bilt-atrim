import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { createOrder, validateCoupon, formatPrice } from '../api';
import { useToast } from '../context/ToastContext';

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { store } = useStore();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', notes: '',
  });

  const subtotal = total;
  const afterDiscount = subtotal - discount;
  const freeShipping = store?.freeShippingMin && afterDiscount >= store.freeShippingMin;
  const shippingCost = freeShipping ? 0 : afterDiscount > 0 ? 29 : 0;
  const grandTotal = afterDiscount + shippingCost;

  if (items.length === 0) {
    return (
      <div className="container page">
        <p>הסל ריק. <Link to="/products">חזרה לחנות</Link></p>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const result = await validateCoupon(couponInput.trim(), subtotal);
      setDiscount(result.discount);
      setAppliedCoupon(result.code);
      showToast(`קופון ${result.code} הופעל!`);
    } catch (err) {
      showToast(err.message, 'error');
      setDiscount(0);
      setAppliedCoupon('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const data = await createOrder({
        ...form,
        couponCode: appliedCoupon || undefined,
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.effectivePrice ?? i.price,
        })),
      });
      clearCart();
      navigate(`/order-success/${data.orderId}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>תשלום | מרקט גוגל</title></Helmet>
      <div className="container page checkout-page">
        <h1>השלמת הזמנה</h1>
        <div className="checkout-layout">
          <form onSubmit={handleSubmit} className="checkout-form">
            <h2>פרטי משלוח</h2>
            <label>שם מלא *
              <input name="name" required value={form.name} onChange={handleChange} />
            </label>
            <label>אימייל *
              <input name="email" type="email" required value={form.email} onChange={handleChange} />
            </label>
            <label>טלפון *
              <input name="phone" type="tel" required value={form.phone} onChange={handleChange} />
            </label>
            <label>כתובת *
              <input name="address" required value={form.address} onChange={handleChange} />
            </label>
            <label>עיר
              <input name="city" value={form.city} onChange={handleChange} />
            </label>
            <label>הערות להזמנה
              <textarea name="notes" rows={2} value={form.notes} onChange={handleChange} />
            </label>

            <div className="coupon-row">
              <label>קוד קופון
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                />
              </label>
              <button type="button" className="btn btn-outline" onClick={applyCoupon}>
                החל
              </button>
            </div>
            {appliedCoupon && (
              <p className="coupon-applied">✓ קופון {appliedCoupon} – הנחה {formatPrice(discount)}</p>
            )}

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'מעבד...' : `אישור – ${formatPrice(grandTotal)}`}
            </button>
          </form>
          <aside className="checkout-summary">
            <h2>סיכום</h2>
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  {i.name} × {i.quantity} – {formatPrice((i.effectivePrice ?? i.price) * i.quantity)}
                </li>
              ))}
            </ul>
            <div className="summary-row">
              <span>סכום ביניים</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="summary-row discount">
                <span>הנחה</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>משלוח</span>
              <span>{shippingCost === 0 ? 'חינם!' : formatPrice(shippingCost)}</span>
            </div>
            {!freeShipping && store?.freeShippingMin && (
              <p className="shipping-hint">
                משלוח חינם בהזמנה מעל {formatPrice(store.freeShippingMin)}
              </p>
            )}
            <div className="summary-row total">
              <span>סה״כ</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
