import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  adminCjStatus,
  adminCjSearch,
  adminCjImport,
  fetchCategories,
  formatPrice,
} from '../../api';
import { useToast } from '../../context/ToastContext';

export default function AdminCJImport() {
  const { showToast } = useToast();
  const [configured, setConfigured] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('electronics');
  const [markup, setMarkup] = useState(30);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    adminCjStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const search = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setSelected(new Set());
    try {
      const data = await adminCjSearch(keyword);
      setResults(data.list || []);
      if (!data.list?.length) showToast('לא נמצאו מוצרים', 'error');
    } catch (err) {
      showToast(err.message, 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (pid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((r) => r.pid)));
  };

  const doImport = async () => {
    if (!selected.size) {
      showToast('בחר לפחות מוצר אחד', 'error');
      return;
    }
    setImporting(true);
    try {
      const data = await adminCjImport([...selected], { markupPercent: markup, categoryId });
      showToast(`יובאו ${data.imported} מוצרים (${data.exists} כבר היו בחנות)`);
      setSelected(new Set());
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  if (configured === null) {
    return <AdminLayout title="ייבוא מ-CJ"><p>טוען...</p></AdminLayout>;
  }

  return (
    <AdminLayout title="ייבוא מוצרים מ-CJ Dropshipping">
      {!configured ? (
        <div className="info-card admin-info">
          <h2>חיבור API נדרש</h2>
          <ol>
            <li>היכנס ל-<strong>cjdropshipping.com</strong></li>
            <li><strong>My CJ</strong> → <strong>Authorization</strong> → <strong>API</strong></li>
            <li>העתק את <strong>API Key</strong></li>
            <li>ב-<strong>Railway</strong> הוסף משתנה: <code>CJ_ACCESS_TOKEN</code> = המפתח</li>
            <li><strong>Redeploy</strong> את השרת</li>
          </ol>
        </div>
      ) : (
        <>
          <form className="cj-search-bar" onSubmit={search}>
            <input
              type="search"
              placeholder="חפש מוצרים ב-CJ (למשל: phone, watch, hoodie)..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'מחפש...' : 'חיפוש'}
            </button>
          </form>

          <div className="cj-import-options">
            <label>
              אחוז רווח (%)
              <input
                type="number"
                min="5"
                max="500"
                value={markup}
                onChange={(e) => setMarkup(Number(e.target.value))}
              />
            </label>
            <label>
              קטגוריה בחנות
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importing || !selected.size}
              onClick={doImport}
            >
              {importing ? 'מייבא...' : `ייבא ${selected.size} מוצרים לחנות`}
            </button>
          </div>

          {results.length > 0 && (
            <>
              <div className="admin-toolbar">
                <button type="button" className="btn btn-outline btn-sm" onClick={toggleAll}>
                  {selected.size === results.length ? 'בטל הכל' : 'בחר הכל'}
                </button>
                <span>{results.length} תוצאות</span>
              </div>
              <div className="cj-results-grid">
                {results.map((p) => {
                  const retail = Math.ceil(p.price * (1 + markup / 100));
                  return (
                    <label key={p.pid} className={`cj-result-card ${selected.has(p.pid) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.pid)}
                        onChange={() => toggle(p.pid)}
                      />
                      {p.image ? (
                        <img src={p.image} alt={p.name} />
                      ) : (
                        <div className="cj-no-img">📦</div>
                      )}
                      <h3>{p.name}</h3>
                      <p className="cj-prices">
                        עלות CJ: {formatPrice(p.price)}
                        <br />
                        <strong>מחיר בחנות: {formatPrice(retail)}</strong>
                      </p>
                      <small>SKU: {p.sku || p.pid}</small>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
}
