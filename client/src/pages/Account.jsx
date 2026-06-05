import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PageHelmet from '../components/PageHelmet';
import { useAuth } from '../context/AuthContext';
import {
  fetchAccountOrders,
  formatPrice,
  ORDER_STATUS,
  PAYMENT_STATUS_LABELS,
} from '../api';
import { trackingUrl } from '../utils/tracking';

export default function Account() {
  const { user, loading, logout, saveProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    fetchAccountOrders()
      .then(setOrders)
      .catch(console.error)
      .finally(() => setOrdersLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      city: user.city || '',
    });
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setSavingProfile(true);
    try {
      await saveProfile(form);
      setProfileMsg('הפרטים נשמרו ✓');
    } catch (err) {
      setProfileMsg(err.message || 'שגיאה בשמירה');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <p>טוען...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: '/account' }} replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="container page account-page">
      <PageHelmet title="החשבון שלי" />
      <div className="account-header">
        <div>
          <h1>שלום, {user.name}</h1>
          <p>{user.email}{user.phone ? ` | ${user.phone}` : ''}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleLogout}>
          התנתק
        </button>
      </div>

      <section className="account-profile">
        <h2>הפרטים שלי</h2>
        <p className="account-profile-hint">
          הפרטים יישמרו וימולאו אוטומטית בקופה בהזמנה הבאה.
        </p>
        <form className="account-profile-form" onSubmit={handleSaveProfile}>
          <label>
            שם מלא
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            טלפון
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            כתובת
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label>
            עיר
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <div className="account-profile-actions">
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'שומר...' : 'שמירת פרטים'}
            </button>
            {profileMsg && <span className="account-profile-msg">{profileMsg}</span>}
          </div>
        </form>
      </section>

      <h2>ההזמנות שלי</h2>
      {ordersLoading && <p>טוען הזמנות...</p>}
      {!ordersLoading && orders.length === 0 && (
        <p>
          עדיין אין הזמנות. <Link to="/products">לקניות</Link>
        </p>
      )}
      <div className="account-orders">
        {orders.map((order) => (
          <article key={order.id} className="account-order-card">
            <div className="account-order-head">
              <strong>הזמנה #{order.id}</strong>
              <span className={`status-badge status-${ORDER_STATUS[order.status]?.color}`}>
                {ORDER_STATUS[order.status]?.label}
              </span>
            </div>
            <p>{new Date(order.createdAt).toLocaleString('he-IL')} · {formatPrice(order.total)}</p>
            <p>
              תשלום: {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
            </p>
            {order.trackingNumber && (
              <p>
                מעקב: {order.trackingNumber}{' '}
                <a href={trackingUrl(order.trackingNumber)} target="_blank" rel="noreferrer">
                  17track
                </a>
              </p>
            )}
            <ul>
              {order.items.map((i, idx) => (
                <li key={idx}>{i.name} × {i.quantity}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
