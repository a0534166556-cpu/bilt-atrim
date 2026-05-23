import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { adminProducts, adminDeleteProduct, adminDuplicateProduct, formatPrice } from '../../api';
import { useToast } from '../../context/ToastContext';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const { showToast } = useToast();

  const load = () => adminProducts().then(setProducts).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleDuplicate = async (id) => {
    try {
      await adminDuplicateProduct(id);
      showToast('מוצר שוכפל');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`למחוק את "${name}"?`)) return;
    try {
      await adminDeleteProduct(id);
      showToast('המוצר נמחק');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <AdminLayout title="ניהול מוצרים">
      <div className="admin-toolbar">
        <Link to="/admin/products/new" className="btn btn-primary">+ מוצר חדש</Link>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>תמונה</th>
            <th>שם</th>
            <th>מחיר</th>
            <th>מלאי</th>
            <th>סטטוס</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={p.active === false ? 'row-inactive' : ''}>
              <td><img src={p.image} alt="" className="table-thumb" /></td>
              <td>
                <strong>{p.name}</strong>
                <br /><small>{p.sku}</small>
              </td>
              <td>
                {formatPrice(p.salePrice && p.salePrice < p.price ? p.salePrice : p.price)}
                {p.salePrice && p.salePrice < p.price && (
                  <small className="old-price">{formatPrice(p.price)}</small>
                )}
              </td>
              <td className={p.stock < 5 ? 'text-warning' : ''}>{p.stock}</td>
              <td>
                {p.active === false ? 'מוסתר' : p.stock === 0 ? 'אזל' : 'פעיל'}
                {p.featured && ' ⭐'}
              </td>
              <td className="actions-cell">
                <Link to={`/admin/products/${p.id}/edit`} className="btn btn-outline btn-sm">ערוך</Link>
                <button className="btn btn-outline btn-sm" onClick={() => handleDuplicate(p.id)}>שכפל</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.name)}>
                  מחק
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
