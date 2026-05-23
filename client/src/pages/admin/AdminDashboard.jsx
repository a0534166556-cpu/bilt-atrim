import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { adminStats, formatPrice, ORDER_STATUS } from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) return <AdminLayout title="לוח בקרה"><p>טוען...</p></AdminLayout>;

  return (
    <AdminLayout title="לוח בקרה">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.totalProducts}</span>
          <span className="stat-label">מוצרים</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activeProducts}</span>
          <span className="stat-label">פעילים</span>
        </div>
        <div className="stat-card stat-warning">
          <span className="stat-value">{stats.lowStock}</span>
          <span className="stat-label">מלאי נמוך</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalOrders}</span>
          <span className="stat-label">הזמנות</span>
        </div>
        <div className="stat-card stat-warning">
          <span className="stat-value">{stats.pendingOrders}</span>
          <span className="stat-label">ממתינות</span>
        </div>
        <div className="stat-card stat-success">
          <span className="stat-value">{formatPrice(stats.revenue)}</span>
          <span className="stat-label">הכנסות</span>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>הזמנות אחרונות</h2>
          <Link to="/admin/orders" className="btn btn-outline btn-sm">כל ההזמנות</Link>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>לקוח</th>
              <th>סכום</th>
              <th>סטטוס</th>
              <th>תאריך</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentOrders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.name}</td>
                <td>{formatPrice(o.total)}</td>
                <td>
                  <span className={`status-badge status-${ORDER_STATUS[o.status]?.color}`}>
                    {ORDER_STATUS[o.status]?.label}
                  </span>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString('he-IL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-quick-actions">
        <Link to="/admin/products/new" className="btn btn-primary">+ הוסף מוצר חדש</Link>
        <Link to="/admin/products" className="btn btn-outline">נהל מוצרים</Link>
      </div>
    </AdminLayout>
  );
}
