import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  adminOrders,
  adminUpdateOrderStatus,
  formatPrice,
  ORDER_STATUS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  exportOrdersCsv,
} from '../../api';
import { useToast } from '../../context/ToastContext';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [trackingEdits, setTrackingEdits] = useState({});
  const { showToast } = useToast();

  const load = () => adminOrders().then(setOrders).catch(console.error);
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await adminUpdateOrderStatus(id, { status });
      showToast('הסטטוס עודכן');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const saveTracking = async (id) => {
    try {
      await adminUpdateOrderStatus(id, { trackingNumber: trackingEdits[id] ?? '' });
      showToast('מספר מעקב נשמר');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const markPaid = async (id) => {
    try {
      await adminUpdateOrderStatus(id, { paymentStatus: 'paid' });
      showToast('סומן כשולם');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const copyAddress = (o) => {
    const text = `${o.name}\n${o.phone}\n${o.address}${o.city ? `, ${o.city}` : ''}\n${o.email}`;
    navigator.clipboard.writeText(text).then(() => showToast('כתובת הועתקה'));
  };

  const exportCsv = async () => {
    try {
      await exportOrdersCsv();
      showToast('הקובץ הורד');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filtered = filter
    ? orders.filter(
        (o) =>
          String(o.id).includes(filter) ||
          o.name.includes(filter) ||
          o.email.includes(filter)
      )
    : orders;

  return (
    <AdminLayout title="ניהול הזמנות">
      <div className="admin-toolbar">
        <input
          type="search"
          placeholder="חיפוש לפי מספר, שם או אימייל..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="search-input"
        />
        <button type="button" className="btn btn-outline" onClick={exportCsv}>
          ייצוא CSV
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>לקוח</th>
            <th>פריטים</th>
            <th>סכום</th>
            <th>תשלום</th>
            <th>סטטוס</th>
            <th>מעקב</th>
            <th>תאריך</th>
            <th>עדכון</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>
                <strong>{o.name}</strong>
                <br /><small>{o.email}</small>
                <br /><small>{o.phone}</small>
              </td>
              <td>
                <ul className="order-items-list">
                  {o.items.map((i, idx) => (
                    <li key={idx}>{i.name} × {i.quantity}</li>
                  ))}
                </ul>
                <small>{o.address}{o.city ? `, ${o.city}` : ''}</small>
                {o.couponCode && <small><br />קופון: {o.couponCode}</small>}
              </td>
              <td>{formatPrice(o.total)}</td>
              <td>
                <small>{PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod}</small>
                <br />
                <span className={`status-badge status-${o.paymentStatus === 'paid' ? 'success' : 'warning'}`}>
                  {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}
                </span>
                {o.paymentMethod === 'cod' && o.paymentStatus !== 'paid' && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => markPaid(o.id)}>
                    סמן שולם
                  </button>
                )}
              </td>
              <td>
                <span className={`status-badge status-${ORDER_STATUS[o.status]?.color}`}>
                  {ORDER_STATUS[o.status]?.label}
                </span>
              </td>
              <td>
                <input
                  type="text"
                  className="tracking-input"
                  placeholder="מספר מעקב"
                  value={trackingEdits[o.id] ?? o.trackingNumber ?? ''}
                  onChange={(e) => setTrackingEdits({ ...trackingEdits, [o.id]: e.target.value })}
                />
                <button type="button" className="btn btn-sm btn-outline" onClick={() => saveTracking(o.id)}>
                  שמור
                </button>
              </td>
              <td>{new Date(o.createdAt).toLocaleString('he-IL')}</td>
              <td>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => copyAddress(o)}>
                  העתק כתובת
                </button>
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                >
                  {Object.entries(ORDER_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
