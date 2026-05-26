function looksLikeHtml(text) {
  return /<[a-z][\s\S]*>/i.test(text || '');
}

function sanitizeProductHtml(html) {
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export default function ProductDescription({ content, plain = false }) {
  if (!content?.trim()) return null;

  if (!plain && looksLikeHtml(content)) {
    return (
      <div
        className="product-desc product-desc-html"
        dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(content) }}
      />
    );
  }

  return <p className="product-desc">{content}</p>;
}
