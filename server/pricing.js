/**
 * מחיר CJ בדולרים → מחיר מכירה בשקלים
 * (עלות מוצר + משלוח CJ) × שער × (1 + אחוז רווח)
 * המחיר כולל משלוח – הלקוח מקבל משלוח חינם בקופה.
 */

/** אחוז הרווח על העלות הכוללת (מוצר + משלוח) */
export const DEFAULT_MARKUP_PERCENT = (() => {
  const m = Number(process.env.CJ_MARKUP_PERCENT);
  return Number.isFinite(m) && m >= 0 ? m : 25;
})();

export function getUsdToIlsRate() {
  const rate = Number(process.env.USD_TO_ILS);
  return Number.isFinite(rate) && rate > 0 ? rate : 3.75;
}

export function getDefaultShippingUsd() {
  const ship = Number(process.env.CJ_SHIPPING_USD);
  return Number.isFinite(ship) && ship >= 0 ? ship : 4;
}

/** משלוח CJ נכלל תמיד במחיר המוצר (אלא אם הוגדר במפורש false) */
export function includesCjShippingInProductPrice() {
  const v = process.env.CJ_PRICE_INCLUDES_SHIPPING?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

function resolveShippingUsd(shippingUsd) {
  if (!includesCjShippingInProductPrice()) return 0;
  if (shippingUsd != null && Number.isFinite(Number(shippingUsd))) {
    return Math.max(0, Number(shippingUsd));
  }
  return getDefaultShippingUsd();
}

/** מחיר ברירת מחדל כשעלות CJ חסרה (1$ + משלוח) – לזיהוי מחירים שגויים */
export function getDefaultFallbackRetailIls(markupPercent = DEFAULT_MARKUP_PERCENT) {
  return calculateRetailPriceIls(1, { markupPercent });
}

/** עלות USD מ-CJ + משלוח USD → מחיר מכירה בש"ח (null אם אין עלות) */
export function calculateRetailPriceIls(costUsd, { markupPercent = DEFAULT_MARKUP_PERCENT, shippingUsd } = {}) {
  const cost = Number(costUsd);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const ship = resolveShippingUsd(shippingUsd);
  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : DEFAULT_MARKUP_PERCENT;

  const subtotalUsd = cost + ship;
  const withProfitUsd = subtotalUsd * (1 + validMarkup / 100);
  const ils = withProfitUsd * getUsdToIlsRate();

  return Math.max(5, Math.ceil(ils));
}

/** פירוט לתצוגה בניהול */
export function explainRetailPrice(costUsd, { markupPercent = DEFAULT_MARKUP_PERCENT, shippingUsd } = {}) {
  const cost = Number(costUsd);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const ship = resolveShippingUsd(shippingUsd);
  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : DEFAULT_MARKUP_PERCENT;
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
      ? 'המחיר כולל משלוח – משלוח חינם ללקוח'
      : 'משלוח ללקוח נגבה בנפרד בקופה',
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
