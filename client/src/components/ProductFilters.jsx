import { useSearchParams } from 'react-router-dom';

export default function ProductFilters({ categories }) {
  const [params, setParams] = useSearchParams();

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <aside className="filters">
      <h3>סינון ומיון</h3>
      <label>
        קטגוריה
        <select
          value={params.get('category') || ''}
          onChange={(e) => update('category', e.target.value)}
        >
          <option value="">הכל</option>
          {(Array.isArray(categories) ? categories : []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        מיון
        <select
          value={params.get('sort') || ''}
          onChange={(e) => update('sort', e.target.value)}
        >
          <option value="">מומלצים</option>
          <option value="price-asc">מחיר: נמוך לגבוה</option>
          <option value="price-desc">מחיר: גבוה לנמוך</option>
          <option value="name">שם</option>
          <option value="newest">חדשים</option>
          <option value="discount">הנחה גבוהה</option>
        </select>
      </label>
      <label>
        מחיר מינימום
        <input
          type="number"
          min="0"
          value={params.get('minPrice') || ''}
          onChange={(e) => update('minPrice', e.target.value)}
          placeholder="0"
        />
      </label>
      <label>
        מחיר מקסימום
        <input
          type="number"
          min="0"
          value={params.get('maxPrice') || ''}
          onChange={(e) => update('maxPrice', e.target.value)}
          placeholder="ללא הגבלה"
        />
      </label>
      <button
        className="btn btn-outline btn-sm btn-block"
        onClick={() => setParams(new URLSearchParams(params.get('q') ? { q: params.get('q') } : {}))}
      >
        נקה סינון
      </button>
    </aside>
  );
}
