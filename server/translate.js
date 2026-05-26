/**
 * תרגום לאנגלית → עברית (MyMemory – חינמי, אופציונלי MYMEMORY_EMAIL ליותר מכסה)
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

async function translateChunk(chunk) {
  const url = new URL(MYMEMORY_URL);
  url.searchParams.set('q', chunk);
  url.searchParams.set('langpair', 'en|he');
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

export async function translateToHebrew(text) {
  const clean = stripHtml(text);
  if (!clean) return '';
  if (!needsTranslation(clean)) return clean;

  const chunks = splitChunks(clean);
  const parts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    parts.push(await translateChunk(chunks[i]));
    if (i < chunks.length - 1) await sleep(350);
  }
  return parts.join(' ').trim();
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
