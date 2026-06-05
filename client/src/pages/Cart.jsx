import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useCart } from '../context/CartContext';
import { fetchProducts, formatPrice } from '../api';
export default function Cart() {
  const { items, updateQuantity, removeItem, total, syncWithCatalog } = useCart();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    setSyncing(true);
    fetchProducts()
      .then((products) => {
        if (!cancelled) syncWithCatalog(products);
      })
      .catch(() => {
        if (!cancelled) {
          setError('לא הצלחנו לעדכן מחירים – אפשר להמשיך לתשלום');
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items.length, syncWithCatalog]);

  if (items.length === 0) {
    return (
      <div className="container page empty-cart">
        <Helmet><title>{'סל קניות | NovaShop'}</title></Helmet>
        <h1>הסל ריק</h1>
        <p>עדיין לא הוספת מוצרים</p>
        <Link to="/products" className="btn btn-primary">המשך קניות</Link>
      </div>
    );
  }

  const itemCount = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  return (
    <>
      <Helmet><title>{`סל קניות (${itemCount}) | NovaShop`}</title></Helmet>
      <div className="container page cart-page">
        <h1>סל קניות</h1>
        {syncing && <p className="loading-inline">מעדכן מחירים...</p>}
        {error && <p className="error-banner">{error}</p>}

        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => {
              const unitPrice = Number(item.effectivePrice ?? item.price) || 0;
              const qty = Number(item.quantity) || 1;
              const stock = Number(item.stock) || 99;
              const atMax = qty >= stock;
              return (
                <div key={item.id} className="cart-item">
                  <Link to={`/product/${item.id}`} className="cart-item-image">
                    {item.image ? (
                      <img src={item.image} alt={item.name || 'מוצר'} />
                    ) : (
                      <div className="cart-no-image">📦</div>
                    )}
                  </Link>
                  <div className="cart-item-info">
                    <Link to={`/product/${item.id}`}>
                      <h3>{item.name || 'מוצר'}</h3>
                    </Link>
                    <p className="cart-unit-price">{formatPrice(unitPrice)}</p>
                    {stock > 0 && stock < 10 && (
                      <small className="stock-hint">נותרו {stock} במלאי</small>
                    )}
                    <div className="cart-item-actions">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, qty - 1)}
                        aria-label="הפחת כמות"
                      >
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, qty + 1)}
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
                  <p className="cart-item-total">{formatPrice(unitPrice * qty)}</p>
                </div>
              );
            })}
          </div>

          <aside className="cart-summary">
            <h2>סיכום הזמנה</h2>
            <div className="summary-row">
              <span>פריטים ({itemCount})</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="summary-row">
              <span>משלוח</span>
              <span>חינם!</span>
            </div>
            <p className="cart-summary-note">🚚 משלוח חינם על כל ההזמנות</p>
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
