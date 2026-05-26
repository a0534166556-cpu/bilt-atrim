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

/** עלות USD מ-CJ + משלוח USD → מחיר מכירה בש"ח */
export function calculateRetailPriceIls(costUsd, { markupPercent = 30, shippingUsd } = {}) {
  const cost = Number(costUsd);
  const validCost = Number.isFinite(cost) && cost > 0 ? cost : 1;
  const ship =
    shippingUsd != null && Number.isFinite(Number(shippingUsd))
      ? Math.max(0, Number(shippingUsd))
      : getDefaultShippingUsd();
  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : 30;

  const subtotalUsd = validCost + ship;
  const withProfitUsd = subtotalUsd * (1 + validMarkup / 100);
  const ils = withProfitUsd * getUsdToIlsRate();

  return Math.max(5, Math.ceil(ils));
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
