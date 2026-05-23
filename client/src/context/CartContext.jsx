import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);

function normalizeCartItem(item) {
  if (!item || item.id == null) return null;
  const price = Number(item.effectivePrice ?? item.price) || 0;
  return {
    id: Number(item.id),
    name: item.name || 'מוצר',
    image: item.image || '',
    brand: item.brand || '',
    stock: Math.max(0, Number(item.stock) || 99),
    quantity: Math.max(1, Number(item.quantity) || 1),
    price,
    effectivePrice: price,
  };
}

function loadCartFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem('cart') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeCartItem).filter(Boolean);
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCartFromStorage);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const removeItem = useCallback((id) => {
    const numId = Number(id);
    setItems((prev) => prev.filter((i) => Number(i.id) !== numId));
  }, []);

  const addItem = useCallback((product, quantity = 1) => {
    if (!product?.id) return;
    const price = Number(product.effectivePrice ?? product.price) || 0;
    const maxStock = Math.max(0, Number(product.stock) ?? 99);
    if (maxStock === 0) return;

    const numId = Number(product.id);
    const qty = Math.max(1, Math.min(quantity, maxStock));

    setItems((prev) => {
      const existing = prev.find((i) => Number(i.id) === numId);
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, maxStock);
        return prev.map((i) =>
          Number(i.id) === numId
            ? {
                ...i,
                name: product.name ?? i.name,
                image: product.image ?? i.image,
                quantity: newQty,
                stock: maxStock,
                price,
                effectivePrice: price,
              }
            : i
        );
      }
      return [
        ...prev,
        normalizeCartItem({
          ...product,
          id: numId,
          price,
          effectivePrice: price,
          quantity: qty,
          stock: maxStock,
        }),
      ].filter(Boolean);
    });
  }, []);

  const updateQuantity = useCallback(
    (id, quantity) => {
      const numId = Number(id);
      if (quantity < 1) {
        removeItem(numId);
        return;
      }
      setItems((prev) =>
        prev.map((i) => {
          if (Number(i.id) !== numId) return i;
          const max = Math.max(1, Number(i.stock) || 99);
          return { ...i, quantity: Math.min(quantity, max) };
        })
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);

  /** מסנכרן מחירים ומלאי מול קטלוג החנות */
  const syncWithCatalog = useCallback((catalogProducts) => {
    if (!Array.isArray(catalogProducts) || catalogProducts.length === 0) return;
    const byId = new Map(catalogProducts.map((p) => [Number(p.id), p]));

    setItems((prev) => {
      const next = [];
      for (const item of prev) {
        const product = byId.get(Number(item.id));
        if (!product || product.active === false || product.stock === 0) continue;
        const price = Number(product.effectivePrice ?? product.price) || 0;
        next.push(
          normalizeCartItem({
            ...item,
            name: product.name,
            image: product.image,
            brand: product.brand,
            stock: product.stock,
            price,
            effectivePrice: price,
            quantity: Math.min(item.quantity, product.stock),
          })
        );
      }
      return next;
    });
  }, []);

  const total = items.reduce(
    (sum, i) => sum + (Number(i.effectivePrice ?? i.price) || 0) * i.quantity,
    0
  );
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncWithCatalog,
        total,
        count,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
