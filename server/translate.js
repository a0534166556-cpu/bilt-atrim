/**
 * תרגום MyMemory (חינמי) – en↔he
 * MYMEMORY_EMAIL אופציונלי למכסה גבוהה יותר
 */

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const CHUNK_SIZE = 450;

function stripHtml(text) {
  return String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function needsTranslation(text) {
  const clean = stripHtml(text);
  if (!clean || clean.length < 4) return false;
  const hebrew = (clean.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (clean.match(/[a-zA-Z]/g) || []).length;
  if (latin < 8) return false;
  return latin > hebrew * 1.5;
}

export function isMostlyHebrew(text) {
  const clean = stripHtml(text);
  if (!clean || clean.length < 4) return false;
  const hebrew = (clean.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (clean.match(/[a-zA-Z]/g) || []).length;
  if (hebrew < 4) return false;
  return hebrew > latin * 1.5;
}

function splitChunks(text, maxLen = CHUNK_SIZE) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(' ', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function translateChunk(chunk, langpair) {
  const url = new URL(MYMEMORY_URL);
  url.searchParams.set('q', chunk);
  url.searchParams.set('langpair', langpair);
  const email = process.env.MYMEMORY_EMAIL?.trim();
  if (email) url.searchParams.set('de', email);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'שגיאה בתרגום');
  }
  return data.responseData?.translatedText || chunk;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateText(text, langpair, { skipIf } = {}) {
  const clean = stripHtml(text);
  if (!clean) return '';
  if (skipIf && !skipIf(clean)) return clean;

  const chunks = splitChunks(clean);
  const parts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    parts.push(await translateChunk(chunks[i], langpair));
    if (i < chunks.length - 1) await sleep(350);
  }
  return parts.join(' ').trim();
}

export async function translateToHebrew(text) {
  return translateText(text, 'en|he', { skipIf: (clean) => needsTranslation(clean) });
}

export async function translateToEnglish(text) {
  return translateText(text, 'he|en', { skipIf: (clean) => isMostlyHebrew(clean) });
}

export async function translateProductFields({ name, description }) {
  const [translatedName, translatedDesc] = await Promise.all([
    name ? translateToHebrew(name) : Promise.resolve(name),
    description ? translateToHebrew(description) : Promise.resolve(description),
  ]);
  return {
    name: translatedName || name,
    description: translatedDesc || description,
  };
}

export async function translateProductFieldsToEnglish({ name, description }) {
  const [translatedName, translatedDesc] = await Promise.all([
    name ? translateToEnglish(name) : Promise.resolve(name),
    description ? translateToEnglish(description) : Promise.resolve(description),
  ]);
  return {
    name: translatedName || name,
    description: translatedDesc || description,
  };
}

/** מוצרים באנגלית במסד → עברית (ייבוא ישן) */
export async function translateEnglishProductsInDb({ getAllProducts, updateProduct }) {
  const products = await getAllProducts();
  const results = [];

  for (const p of products) {
    const nameNeeds = needsTranslation(p.name);
    const descNeeds = needsTranslation(p.description);
    if (!nameNeeds && !descNeeds) continue;

    try {
      const translated = await translateProductFields({
        name: nameNeeds ? p.name : p.name,
        description: descNeeds ? p.description : p.description,
      });
      await updateProduct(p.id, {
        name: nameNeeds ? translated.name : p.name,
        description: descNeeds ? translated.description : p.description,
      });
      results.push({ id: p.id, status: 'ok' });
      await sleep(500);
    } catch (err) {
      results.push({ id: p.id, status: 'error', error: err.message });
    }
  }
  return results;
}
