const KEY = 'recentlyViewed';
const MAX = 8;

export function addRecentlyViewed(product) {
  try {
    let list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list = list.filter((p) => p.id !== product.id);
    list.unshift({ id: product.id, name: product.name, image: product.image, effectivePrice: product.effectivePrice ?? product.price });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
