import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import {
  adminCreateProduct,
  adminUpdateProduct,
  adminProducts,
  adminTranslateProduct,
  fetchCategories,
} from '../../api';
import { useToast } from '../../context/ToastContext';

const empty = {
  name: '',
  sku: '',
  description: '',
  price: '',
  salePrice: '',
  image: '',
  brand: '',
  category: '',
  googleCategory: '',
  stock: '',
  gtin: '',
  featured: false,
  active: true,
};

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories);
    if (isEdit) {
      adminProducts().then((products) => {
        const p = products.find((x) => x.id === Number(id));
        if (p) {
          setForm({
            name: p.name,
            sku: p.sku,
            description: p.description,
            price: p.price,
            salePrice: p.salePrice || '',
            image: p.image,
            brand: p.brand,
            category: p.category,
            googleCategory: p.googleCategory,
            stock: p.stock,
            gtin: p.gtin || '',
            featured: !!p.featured,
            active: p.active !== false,
          });
        }
      });
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleTranslate = async () => {
    if (!isEdit) {
      showToast('שמור את המוצר קודם', 'error');
      return;
    }
    setTranslating(true);
    try {
      const updated = await adminTranslateProduct(id);
      setForm((f) => ({
        ...f,
        name: updated.name,
        description: updated.description,
      }));
      showToast('תורגם ונשמר בעברית');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTranslating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      price: Number(form.price),
      salePrice: form.salePrice ? Number(form.salePrice) : null,
      stock: Number(form.stock),
    };
    try {
      if (isEdit) {
        await adminUpdateProduct(id, payload);
        showToast('המוצר עודכן');
      } else {
        await adminCreateProduct(payload);
        showToast('המוצר נוסף');
      }
      navigate('/admin/products');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title={isEdit ? 'עריכת מוצר' : 'הוספת מוצר חדש'}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>שם המוצר *
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>מק״ט (SKU)
            <input name="sku" value={form.sku} onChange={handleChange} />
          </label>
          <label>מחיר (₪) *
            <input name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required />
          </label>
          <label>מחיר מבצע
            <input name="salePrice" type="number" min="0" step="0.01" value={form.salePrice} onChange={handleChange} />
          </label>
          <label>מלאי
            <input name="stock" type="number" min="0" value={form.stock} onChange={handleChange} required />
          </label>
          <label>מותג
            <input name="brand" value={form.brand} onChange={handleChange} />
          </label>
          <label>קטגוריה *
            <select name="category" value={form.category} onChange={handleChange} required>
              <option value="">בחר קטגוריה</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>קטגוריית Google
            <input name="googleCategory" value={form.googleCategory} onChange={handleChange} placeholder="Electronics > ..." />
          </label>
          <label>GTIN / ברקוד
            <input name="gtin" value={form.gtin} onChange={handleChange} />
          </label>
          <label className="full-width">קישור לתמונה
            <input name="image" value={form.image} onChange={handleChange} placeholder="https://..." />
          </label>
          {form.image && (
            <div className="image-preview full-width">
              <img src={form.image} alt="תצוגה מקדימה" />
            </div>
          )}
          <label className="full-width">תיאור
            <textarea name="description" rows={4} value={form.description} onChange={handleChange} />
          </label>
          {isEdit && (
            <div className="full-width">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={translating}
                onClick={handleTranslate}
              >
                {translating ? 'מתרגם...' : 'תרגם שם ותיאור לעברית ושמור'}
              </button>
            </div>
          )}
          <label className="checkbox-label">
            <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} />
            מוצר מומלץ (מוצג בדף הבית)
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            פעיל בחנות
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'שומר...' : isEdit ? 'עדכן מוצר' : 'הוסף מוצר'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/products')}>
            ביטול
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
