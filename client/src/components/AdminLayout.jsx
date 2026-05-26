import { Link, useNavigate, useLocation } from 'react-router-dom';
import { adminLogout } from '../api';

const links = [
  { to: '/admin', label: 'לוח בקרה', exact: true },
  { to: '/admin/products', label: 'מוצרים', match: 'products-list' },
  { to: '/admin/products/new', label: 'הוסף מוצר', exact: true },
  { to: '/admin/orders', label: 'הזמנות' },
  { to: '/admin/coupons', label: 'קופונים' },
  { to: '/admin/cj', label: 'ייבוא CJ' },
  { to: '/admin/settings', label: 'הגדרות חנות' },
];

function isLinkActive(location, link) {
  if (link.exact) return location.pathname === link.to;
  if (link.match === 'products-list') {
    return location.pathname === '/admin/products' || /\/admin\/products\/\d+\/edit$/.test(location.pathname);
  }
  return location.pathname.startsWith(link.to);
}

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = async () => {
    try {
      await adminLogout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h2>ניהול החנות</h2>
        <nav>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={isLinkActive(location, l) ? 'active' : ''}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link to="/" className="back-store">← חזרה לחנות</Link>
        <button className="btn btn-outline btn-sm" onClick={logout}>התנתק</button>
      </aside>
      <div className="admin-content">
        {title && <h1 className="admin-title">{title}</h1>}
        {children}
      </div>
    </div>
  );
}
