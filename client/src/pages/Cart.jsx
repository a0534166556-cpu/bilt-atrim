import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../context/CartContext';
import { fetchProducts, formatPrice } from '../api';

export default function Cart() {
  const { items, updateQuantity, removeItem, total, syncWithCatalog } = useCart();
  const [loading, setLoading] = useState(items.length > 0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (items.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchProducts()
      .then((products) => {
        if (!cancelled) syncWithCatalog(products);
      })
      .catch(() => {
        if (!cancelled) setError('לא הצלחנו לעדכן מחירים – אפשר להמשיך לתשלום');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- sync once on mount

  if (loading && items.length > 0) {
    return (
      <div className="container page">
        <Helmet><title>סל קניות | מרקט גוגל</title></Helmet>
        <p className="loading">מעדכן סל...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container page empty-cart">
        <Helmet><title>סל קניות | מרקט גוגל</title></Helmet>
        <h1>הסל ריק</h1>
        <p>עדיין לא הוספת מוצרים</p>
        <Link to="/products" className="btn btn-primary">המשך קניות</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>סל קניות ({items.length}) | מרקט גוגל</title></Helmet>
      <div className="container page">
        <h1>סל קניות</h1>
        {error && <p className="error-banner">{error}</p>}

        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => {
              const unitPrice = Number(item.effectivePrice ?? item.price) || 0;
              const atMax = item.quantity >= (item.stock ?? 99);
              return (
                <div key={item.id} className="cart-item">
                  <Link to={`/product/${item.id}`} className="cart-item-image">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <div className="cart-no-image">📦</div>
                    )}
                  </Link>
                  <div className="cart-item-info">
                    <Link to={`/product/${item.id}`}>
                      <h3>{item.name}</h3>
                    </Link>
                    <p className="cart-unit-price">{formatPrice(unitPrice)}</p>
                    {item.stock < 10 && (
                      <small className="stock-hint">נותרו {item.stock} במלאי</small>
                    )}
                    <div className="cart-item-actions">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label="הפחת כמות"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={atMax}
                        aria-label="הוסף כמות"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removeItem(item.id)}
                      >
                        הסר
                      </button>
                    </div>
                  </div>
                  <p className="cart-item-total">{formatPrice(unitPrice * item.quantity)}</p>
                </div>
              );
            })}
          </div>

          <aside className="cart-summary">
            <h2>סיכום הזמנה</h2>
            <div className="summary-row">
              <span>פריטים ({items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span>{formatPrice(total)}</span>
            </div>
            <p className="cart-summary-note">משלוח יחושב בשלב הבא</p>
            <Link to="/checkout" className="btn btn-primary btn-block">
              להמשך לתשלום
            </Link>
            <Link to="/products" className="btn btn-outline btn-block cart-continue">
              המשך קניות
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
