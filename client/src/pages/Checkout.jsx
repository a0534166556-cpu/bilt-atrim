import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import {
  createOrder,
  createStripeCheckout,
  fetchPaymentConfig,
  validateCoupon,
  formatPrice,
} from '../api';
import { useToast } from '../context/ToastContext';

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { store } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', notes: '',
  });

  useEffect(() => {
    fetchPaymentConfig()
      .then((cfg) => {
        setStripeEnabled(cfg.stripeEnabled);
        if (cfg.stripeEnabled) setPaymentMethod('stripe');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get('cancelled') === '1') {
      showToast('התשלום בוטל – אפשר לנסות שוב', 'error');
    }
  }, [searchParams, showToast]);

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

  const orderPayload = () => ({
    ...form,
    couponCode: appliedCoupon || undefined,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.effectivePrice ?? i.price,
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (paymentMethod === 'stripe' && stripeEnabled) {
        const data = await createStripeCheckout(orderPayload());
        clearCart();
        window.location.href = data.checkoutUrl;
        return;
      }
      const data = await createOrder({ ...orderPayload(), paymentMethod: 'cod' });
      clearCart();
      navigate(`/order-success/${data.orderId}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitLabel =
    paymentMethod === 'stripe' && stripeEnabled
      ? `תשלום מאובטח – ${formatPrice(grandTotal)}`
      : `אישור הזמנה – ${formatPrice(grandTotal)}`;

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

            <h2 className="payment-heading">אמצעי תשלום</h2>
            <div className="payment-methods">
              {stripeEnabled && (
                <label className={`payment-option ${paymentMethod === 'stripe' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="stripe"
                    checked={paymentMethod === 'stripe'}
                    onChange={() => setPaymentMethod('stripe')}
                  />
                  <span className="payment-option-body">
                    <strong>כרטיס אשראי</strong>
                    <small>תשלום מאובטח דרך Stripe (Visa, Mastercard, וכו׳)</small>
                  </span>
                </label>
              )}
              <label className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <span className="payment-option-body">
                  <strong>מזומן / העברה בנקאית</strong>
                  <small>תשלום בעת קבלת המשלוח או לפי הוראות שנשלחו במייל</small>
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'מעבד...' : submitLabel}
            </button>
            {paymentMethod === 'stripe' && stripeEnabled && (
              <p className="payment-secure-note">🔒 מועבר לדף תשלום מאובטח של Stripe</p>
            )}
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
