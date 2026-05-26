import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  adminCjStatus,
  adminCjSearch,
  adminCjImport,
  adminCjMyProducts,
  adminCjSyncMy,
  fetchCategories,
  formatPrice,
} from '../../api';
import { useToast } from '../../context/ToastContext';

export default function AdminCJImport() {
  const { showToast } = useToast();
  const [configured, setConfigured] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('electronics');
  const [markup, setMarkup] = useState(30);
  const [loading, setLoading] = useState(false);
  const [loadingMy, setLoadingMy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [translateToHebrew, setTranslateToHebrew] = useState(true);

  useEffect(() => {
    adminCjStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const loadMyProducts = async () => {
    setLoadingMy(true);
    try {
      const data = await adminCjMyProducts();
      setMyProducts(data.list || []);
      if (!data.list?.length) {
        showToast('אין מוצרים – לחץ Added על מוצרים באתר CJ קודם', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
      setMyProducts([]);
    } finally {
      setLoadingMy(false);
    }
  };

  const syncAllFromCj = async () => {
    setSyncing(true);
    try {
      const data = await adminCjSyncMy({ markupPercent: markup, categoryId, translateToHebrew });
      if (data.synced === 0 && data.message) {
        showToast(data.message, 'error');
        return;
      }
      const failed = data.failed || 0;
      showToast(
        failed
          ? `סונכרנו ${data.synced} מוצרים, ${failed} נכשלו`
          : `סונכרנו ${data.synced} מוצרים (${data.imported || 0} חדשים, ${data.updated || 0} עודכנו)`
      );
      await loadMyProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

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
      const data = await adminCjImport([...selected], {
        markupPercent: markup,
        categoryId,
        translateToHebrew,
      });
      showToast(
        `יובאו ${data.imported} מוצרים${data.updated ? `, עודכנו ${data.updated}` : ''}`
      );
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
          <div className="cj-sync-hero info-card">
            <h2>המוצרים שלי ב-CJ → האתר שלך</h2>
            <p>
              ב-<strong>CJ Dropshipping</strong> לחץ <strong>Added</strong> על המוצרים שאתה רוצה למכור.
              אחר כך כאן לחץ <strong>סנכרן הכל לאתר</strong> – המוצרים יעלו אוטומטית עם תמונות, גלריה וסרטון.
            </p>
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
              <label className="checkbox-label cj-translate-check">
                <input
                  type="checkbox"
                  checked={translateToHebrew}
                  onChange={(e) => setTranslateToHebrew(e.target.checked)}
                />
                תרגם שם ותיאור לעברית אוטומטית
              </label>
              <button
                type="button"
                className="btn btn-outline"
                disabled={loadingMy}
                onClick={loadMyProducts}
              >
                {loadingMy ? 'טוען...' : 'הצג מוצרים מ-CJ'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={syncing}
                onClick={syncAllFromCj}
              >
                {syncing ? 'מסנכרן ומתרגם...' : 'סנכרן הכל לאתר'}
              </button>
            </div>
            {myProducts.length > 0 && (
              <p className="cj-my-count">
                {myProducts.length} מוצרים ממתינים ב-CJ (לחץ סנכרן כדי להעלות לאתר)
              </p>
            )}
          </div>

          <hr className="cj-divider" />

          <h3>חיפוש נוסף ב-CJ</h3>
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

          {results.length > 0 && (
            <>
              <div className="admin-toolbar">
                <button type="button" className="btn btn-outline btn-sm" onClick={toggleAll}>
                  {selected.size === results.length ? 'בטל הכל' : 'בחר הכל'}
                </button>
                <span>{results.length} תוצאות</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={importing || !selected.size}
                  onClick={doImport}
                >
                  {importing ? 'מייבא...' : `ייבא ${selected.size} נבחרים`}
                </button>
              </div>
              <div className="cj-results-grid">
                {results.map((p) => {
                  const usdToIls = 3.75;
                  const shippingUsd = 4;
                  const retail = Math.ceil((p.price + shippingUsd) * (1 + markup / 100) * usdToIls);
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
                        עלות CJ: ${p.price?.toFixed?.(2) ?? p.price} + משלוח
                        <br />
                        <strong>מחיר בחנות (₪): {formatPrice(retail)}</strong>
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
