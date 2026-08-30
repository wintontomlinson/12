/**
 * Coercion helpers for upstream payloads.
 *
 * JioSaavn returns numbers as strings, booleans as `"true"`/`"false"` strings,
 * HTML-entity-encoded titles, and 150px artwork. Everything is funnelled
 * through here so normalizers stay declarative and no component ever receives
 * `&quot;` or the string `"false"` (which is truthy in JS — a real bug source).
 */

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  amp: '&',
};

function decodePass(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const token = entity.toLowerCase();

    if (token.startsWith('#x')) {
      const code = Number.parseInt(token.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (token.startsWith('#')) {
      const code = Number.parseInt(token.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[token] ?? match;
  });
}

/**
 * Decodes HTML entities in upstream text.
 *
 * Runs up to two passes because JioSaavn double-encodes in places (`&amp;quot;`
 * appears in real album titles). Bounded at two so a title containing a
 * legitimately escaped ampersand cannot be unwound indefinitely.
 */
export function decodeEntities(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return '';

  let out = decodePass(input);
  if (out.includes('&')) {
    const second = decodePass(out);
    if (second !== out) out = second;
  }
  return out.trim();
}

/**
 * Upgrades artwork to 500x500.
 *
 * Upstream hands back `...-150x150.jpg` (sometimes `50x50`). Swapping the
 * dimension token for `500x500` was verified to return HTTP 200. URLs without a
 * dimension token pass through untouched.
 */
export function upgradeImage(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  return url.replace(/\d+x\d+(?=\.(?:jpg|jpeg|png|webp)\b)/i, '500x500');
}

/**
 * Extracts a single best image URL.
 *
 * The `image` field is a bare string on most endpoints but an array of
 * `{ quality, link }` variants on others, so both shapes are handled.
 */
export function pickImage(image: unknown): string | null {
  if (typeof image === 'string') return upgradeImage(image);

  if (Array.isArray(image)) {
    const last = image[image.length - 1] as Record<string, unknown> | undefined;
    if (last) {
      const link = last['link'] ?? last['url'];
      if (typeof link === 'string') return upgradeImage(link);
    }
  }
  return null;
}

/** Parses a possibly-string number, returning null rather than NaN. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parses a number with a fallback, for fields that must always be numeric. */
export function toInt(value: unknown, fallback = 0): number {
  const parsed = toNumber(value);
  return parsed === null ? fallback : Math.trunc(parsed);
}

/**
 * Parses upstream booleans.
 *
 * Critically handles the STRING `"false"`, which is truthy in JavaScript and
 * would otherwise make every track appear to have lyrics.
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/** `explicit_content` arrives as `"0"` / `"1"`. */
export function toExplicit(value: unknown): boolean {
  return toInt(value, 0) === 1 || toBoolean(value);
}

/** Returns a trimmed non-empty string, or null. */
export function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Narrows unknown JSON to an indexable record without an `any` cast. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Returns `value` when it is an array, otherwise an empty array. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
