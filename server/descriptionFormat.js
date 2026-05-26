/**
 * ניקוי ותרגום תיאורי מוצר מ-CJ – בלי ביקורות, בלי סינית, עברית מסודרת
 */

import { needsTranslation, translateToHebrew } from './translate.js';

const REVIEW_PATTERNS = [
  /\b(seems like|i was looking|i love|works better|customers say|our customers|many users|buyers say)\b/i,
  /\b(at least (a )?few months|last(ed)? (at least )?for months|highly recommend|five stars?)\b/i,
  /\b(great product|awesome product|perfect for|love this product)\b/i,
  /\b(review|rated \d|star rating|verified purchase)\b/i,
  /נראה שה|לקוחות (אמרו|כותבים)|ביקורות|ממליצים בחום|מושלם למי ש/,
];

const HEADING_MAP = {
  overview: 'סקירה כללית',
  'product information': 'מפרט המוצר',
  'product info': 'מפרט המוצר',
  specification: 'מפרט טכני',
  specifications: 'מפרט טכני',
  features: 'תכונות עיקריות',
  'package list': 'מה בערכה',
  'packing list': 'מה בערכה',
  description: 'תיאור',
};

function stripHtml(text) {
  return String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cjkRatio(text) {
  const s = String(text || '');
  if (!s.length) return 0;
  const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf]/g) || []).length;
  return cjk / s.length;
}

/** בוחר תיאור באנגלית – לא סינית מ-CJ */
export function pickCjDescription(product) {
  const candidates = [
    product.descriptionEn,
    product.productDescriptionEn,
    product.descEn,
    product.description,
    product.productDescription,
  ].filter((c) => c && String(c).trim());

  const english = candidates.find((c) => cjkRatio(c) < 0.03 && /[a-zA-Z]{4,}/.test(c));
  if (english) return String(english);

  const lowCjk = candidates.find((c) => cjkRatio(c) < 0.12);
  return String(lowCjk || candidates[0] || '');
}

export function isReviewLikeParagraph(text) {
  const t = stripHtml(text);
  if (t.length < 25) return false;
  if (REVIEW_PATTERNS.some((re) => re.test(t))) return true;
  if (/\b(!{2,}|\.{3,})\s*$/i.test(t) && /\b(i |my |we )/i.test(t)) return true;
  return false;
}

export function needsDescriptionRetranslation(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (/【|】|概览|概况/.test(t)) return true;
  if (cjkRatio(t) > 0.02) return true;
  if (/קירה כללית|תכליתי עמיד|מעטפת מגן עם משטח/.test(t)) return true;
  if (needsTranslation(t)) return true;
  return false;
}

function normalizeHeading(line) {
  const plain = stripHtml(line).replace(/^[\d.)\s]+/, '').trim();
  const key = plain.replace(/[:：].*$/, '').trim().toLowerCase();
  if (HEADING_MAP[key]) return HEADING_MAP[key];
  if (/^overview\b/i.test(plain)) return 'סקירה כללית';
  if (/^product information/i.test(plain)) return 'מפרט המוצר';
  if (/^package list/i.test(plain)) return 'מה בערכה';
  return null;
}

/** מסיר תמונות, סינית, ביקורות ושאריות מ-CJ */
export function cleanCjDescriptionSource(html) {
  let s = String(html || '');
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  s = s.replace(/<img[^>]*>/gi, '');
  s = s.replace(/[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf]/g, '');
  s = s.replace(/【[^】]*】/g, '');
  s = s.replace(/[【】]/g, '');
  s = s.replace(/概览|概况/g, 'Overview');
  s = s.replace(/product picture|product image|תמונת מוצר/gi, '');
  return s;
}

function splitDescriptionBlocks(html) {
  const cleaned = cleanCjDescriptionSource(html);
  const plain = stripHtml(cleaned);
  const lines = plain
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks = [];

  const pushBlock = (type, text) => {
    const t = text.trim();
    if (!t || t.length < 2) return;
    if (isReviewLikeParagraph(t)) return;
    blocks.push({ type, text: t });
  };

  for (const line of lines) {
    const heading = normalizeHeading(line);
    if (heading) {
      blocks.push({ type: 'heading', text: heading });
      const rest = line.replace(/^[^:：]+[:：]?\s*/i, '').trim();
      if (rest.length > 15 && !normalizeHeading(rest)) pushBlock('p', rest);
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s*(.+)/);
    if (numbered) {
      pushBlock('li', numbered[2]);
      continue;
    }

    if (/^[-•*]\s+/.test(line)) {
      pushBlock('li', line.replace(/^[-•*]\s+/, ''));
      continue;
    }

  if (/^(material|size|capacity|weight|color|package|feature)s?\s*:/i.test(line)) {
      pushBlock('spec', line);
      continue;
    }

    pushBlock('p', line);
  }

  if (!blocks.length && plain.length > 10) {
    plain.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).forEach((part) => pushBlock('p', part));
  }

  return blocks;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function translateBlockText(text) {
  const raw = stripHtml(text);
  if (!raw) return '';
  if (!needsTranslation(raw)) return raw;
  return translateToHebrew(raw);
}

function blocksToHtml(blocks) {
  const parts = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      parts.push('</ul>');
      inList = false;
    }
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      closeList();
      parts.push(`<h3>${escapeHtml(block.text)}</h3>`);
    } else if (block.type === 'li') {
      if (!inList) {
        parts.push('<ul>');
        inList = true;
      }
      parts.push(`<li>${escapeHtml(block.text)}</li>`);
    } else if (block.type === 'spec') {
      closeList();
      const [label, ...rest] = block.text.split(':');
      const value = rest.join(':').trim();
      if (value) {
        parts.push(
          `<p class="desc-spec"><strong>${escapeHtml(label.trim())}:</strong> ${escapeHtml(value)}</p>`
        );
      } else {
        parts.push(`<p>${escapeHtml(block.text)}</p>`);
      }
    } else {
      closeList();
      parts.push(`<p>${escapeHtml(block.text)}</p>`);
    }
  }
  closeList();
  return parts.join('\n');
}

/** תרגום תיאור מוצר: פסקה-פסקה, בלי ביקורות, HTML נקי */
export async function translateProductDescription(html) {
  const source = cleanCjDescriptionSource(html);
  const blocks = splitDescriptionBlocks(source);
  if (!blocks.length) return '';

  const translated = [];
  for (const block of blocks) {
    if (block.type === 'heading') {
      translated.push(block);
      continue;
    }
    const he = await translateBlockText(block.text);
    if (he) translated.push({ ...block, text: he });
  }

  return blocksToHtml(translated);
}

export async function formatProductDescription(html, { translate = true } = {}) {
  const source = cleanCjDescriptionSource(html);
  if (!translate) {
    const blocks = splitDescriptionBlocks(source);
    return blocksToHtml(blocks);
  }
  return translateProductDescription(source);
}
