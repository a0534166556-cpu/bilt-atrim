const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

export function isCjConfigured() {
  return Boolean(process.env.CJ_ACCESS_TOKEN?.trim());
}

async function cjRequest(path, options = {}) {
  const token = process.env.CJ_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('CJ_ACCESS_TOKEN לא מוגדר ב-Railway');

  const res = await fetch(`${CJ_BASE}${path}`, {
    ...options,
    headers: {
      'CJ-Access-Token': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!data.result && data.code !== 200) {
    throw new Error(data.message || 'שגיאה מ-CJ Dropshipping');
  }
  return data;
}

function mapListItem(item) {
  const name =
    item.productNameEn ||
    item.productName ||
    item.nameEn ||
    item.name ||
    'מוצר CJ';
  const image =
    item.productImage ||
    item.bigImage ||
    item.image ||
    (Array.isArray(item.productImages) ? item.productImages[0] : '') ||
    '';
  const price = Number(item.sellPrice ?? item.price ?? item.salePrice ?? 0);
  return {
    pid: item.pid || item.productId || item.id,
    sku: item.productSku || item.sku || '',
    name: String(name).replace(/^\[.*?\]\s*/, ''),
    image,
    price,
    categoryName: item.categoryName || item.threeCategoryName || '',
  };
}

export async function searchCjProducts(keyword = '', page = 1, size = 20) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(Math.min(size, 50)),
  });
  if (keyword.trim()) params.set('keyWord', keyword.trim());

  const data = await cjRequest(`/product/listV2?${params}`);
  const list = data.data?.list || data.data?.content || data.data || [];
  const items = (Array.isArray(list) ? list : []).map(mapListItem).filter((p) => p.pid);

  return {
    list: items,
    total: data.data?.total ?? data.data?.totalRecords ?? items.length,
    page,
  };
}

export async function getCjProductDetail(pid) {
  const data = await cjRequest(`/product/query?pid=${encodeURIComponent(pid)}`);
  const p = data.data || {};
  const variants = p.variantList || p.variants || [];
  const firstVariant = variants[0] || {};
  const sellPrice = Number(
    firstVariant.sellPrice ?? p.sellPrice ?? p.productSellPrice ?? 0
  );
  const stock = variants.reduce((sum, v) => sum + (Number(v.inventory) || 0), 0) || 99;

  return {
    pid: p.pid || p.productId || pid,
    sku: p.productSku || p.sku || `CJ-${pid}`,
    name: p.productNameEn || p.productName || 'מוצר CJ',
    description: (p.description || p.productDescription || p.productNameEn || '').slice(0, 2000),
    image:
      p.productImage ||
      firstVariant.variantImage ||
      firstVariant.image ||
      (p.images?.[0] ?? ''),
    price: sellPrice,
    stock: stock || 99,
    categoryName: p.categoryName || '',
  };
}

export async function importCjProducts(pids, { markupPercent = 30, categoryId = 'electronics' } = {}) {
  const imported = [];
  const skipped = [];

  for (const pid of pids) {
    try {
      const detail = await getCjProductDetail(pid);
      const cost = detail.price;
      const retail = Math.ceil(cost * (1 + markupPercent / 100));
      imported.push({
        ...detail,
        cost,
        retail,
        categoryId,
      });
    } catch (err) {
      skipped.push({ pid, error: err.message });
    }
  }

  return { imported, skipped };
}
