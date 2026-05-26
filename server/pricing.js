/**
 * מחיר CJ בדולרים → מחיר מכירה בשקלים
 * (עלות מוצר + משלוח) × שער × (1 + אחוז רווח)
 */

export function getUsdToIlsRate() {
  const rate = Number(process.env.USD_TO_ILS);
  return Number.isFinite(rate) && rate > 0 ? rate : 3.75;
}

export function getDefaultShippingUsd() {
  const ship = Number(process.env.CJ_SHIPPING_USD);
  return Number.isFinite(ship) && ship >= 0 ? ship : 4;
}

/** משלוח CJ בתוך מחיר המוצר? ברירת מחדל לא – הלקוח משלם משלוח בנפרד בקופה (₪29) */
export function includesCjShippingInProductPrice() {
  const v = process.env.CJ_PRICE_INCLUDES_SHIPPING?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function resolveShippingUsd(shippingUsd) {
  if (!includesCjShippingInProductPrice()) return 0;
  if (shippingUsd != null && Number.isFinite(Number(shippingUsd))) {
    return Math.max(0, Number(shippingUsd));
  }
  return getDefaultShippingUsd();
}

/** מחיר ברירת מחדל כשעלות CJ חסרה (1$ + משלוח) – לזיהוי מחירים שגויים */
export function getDefaultFallbackRetailIls(markupPercent = 30) {
  return calculateRetailPriceIls(1, { markupPercent });
}

/** עלות USD מ-CJ + משלוח USD → מחיר מכירה בש"ח (null אם אין עלות) */
export function calculateRetailPriceIls(costUsd, { markupPercent = 30, shippingUsd } = {}) {
  const cost = Number(costUsd);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const ship = resolveShippingUsd(shippingUsd);
  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : 30;

  const subtotalUsd = cost + ship;
  const withProfitUsd = subtotalUsd * (1 + validMarkup / 100);
  const ils = withProfitUsd * getUsdToIlsRate();

  return Math.max(5, Math.ceil(ils));
}

/** פירוט לתצוגה בניהול */
export function explainRetailPrice(costUsd, { markupPercent = 30, shippingUsd } = {}) {
  const cost = Number(costUsd);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const ship = resolveShippingUsd(shippingUsd);
  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : 30;
  const rate = getUsdToIlsRate();
  const subtotalUsd = cost + ship;
  const retail = calculateRetailPriceIls(cost, { markupPercent: validMarkup, shippingUsd: ship });
  return {
    costUsd: cost,
    shippingUsd: ship,
    markupPercent: validMarkup,
    usdToIls: rate,
    subtotalUsd,
    retailIls: retail,
    checkoutShippingNote: includesCjShippingInProductPrice()
      ? null
      : 'משלוח ללקוח נגבה בנפרד בקופה (₪29)',
  };
}

function parseUsd(...values) {
  const nums = values
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .map((v) => {
      if (v == null || v === '') return NaN;
      const n = Number(String(v).replace(/[^0-9.]/g, ''));
      return n;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.min(...nums) : 0;
}

/** מחיר עלות USD מ-CJ (variantSellPrice, sellPrice, nowPrice…) */
export function extractCostUsd(product, variants = []) {
  const variantFields = variants.flatMap((v) => [
    v.variantSellPrice,
    v.variantSugSellPrice,
    v.sellPrice,
    v.price,
  ]);
  return parseUsd(
    product?.sellPrice,
    product?.nowPrice,
    product?.discountPrice,
    product?.productSellPrice,
    product?.productPrice,
    ...variantFields
  );
}

export function extractShippingUsd(product, variants = []) {
  const candidates = [
    product?.postage,
    product?.freight,
    product?.shippingCost,
    product?.logisticsPrice,
    product?.addPrice,
  ];
  for (const v of variants) {
    candidates.push(v.postage, v.freight, v.shippingCost, v.logisticsPrice);
  }
  const nums = candidates.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length) return Math.min(...nums);
  return getDefaultShippingUsd();
}
