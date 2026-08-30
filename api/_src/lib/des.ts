import { DES } from 'des.js';
import type { AudioQuality, DownloadLink } from '../../../shared/types.js';

/**
 * Audio URL decryption.
 *
 * JioSaavn ships playable URLs as base64-encoded DES-ECB ciphertext under a
 * fixed, publicly known key.
 *
 * ── Why not node:crypto ──────────────────────────────────────────────────────
 * Node 22 bundles OpenSSL 3, which classifies DES as a legacy cipher and
 * rejects `crypto.createDecipheriv('des-ecb', ...)` with
 * `ERR_OSSL_EVP_UNSUPPORTED`. Running node with `--openssl-legacy-provider`
 * fixes it locally, but that flag cannot be relied upon inside Vercel's managed
 * runtime — the failure would only appear after deploy, on every track.
 *
 * So we use a pure-JS DES. It was verified to produce byte-identical output to
 * OpenSSL (with the legacy provider enabled) for the same ciphertext, and has
 * no dependency on the host's crypto policy.
 */

const DES_KEY = Buffer.from('38346591', 'utf8');
const DES_BLOCK_SIZE = 8;

/** Bitrate variants, ascending. The client picks; we only build the URLs. */
const QUALITY_BITRATES: ReadonlyArray<{ quality: AudioQuality; bitrate: string }> = [
  { quality: '12kbps', bitrate: '12' },
  { quality: '48kbps', bitrate: '48' },
  { quality: '96kbps', bitrate: '96' },
  { quality: '160kbps', bitrate: '160' },
  { quality: '320kbps', bitrate: '320' },
];

/**
 * Removes PKCS#5 padding.
 *
 * Done by hand because the cipher runs with `padding: false`. That is
 * deliberate: des.js's own padding handling drops the final plaintext block,
 * which silently truncated the URL's `.mp4` extension during verification.
 *
 * The trailing byte is only trusted when it is a valid pad length AND every
 * padding byte matches it. Anything else is treated as unpadded data and
 * returned intact, so malformed input degrades instead of losing characters.
 */
function stripPkcs5Padding(buffer: Buffer): Buffer {
  if (buffer.length === 0) return buffer;

  const padLength = buffer[buffer.length - 1];
  if (padLength === undefined || padLength < 1 || padLength > DES_BLOCK_SIZE) {
    return buffer;
  }
  if (padLength > buffer.length) return buffer;

  for (let i = buffer.length - padLength; i < buffer.length; i += 1) {
    if (buffer[i] !== padLength) return buffer;
  }
  return buffer.subarray(0, buffer.length - padLength);
}

/**
 * Decrypts an `encrypted_media_url` into a playable CDN URL.
 *
 * Returns null rather than throwing: one undecryptable track must not fail an
 * entire album response.
 */
export function decryptMediaUrl(encrypted: unknown): string | null {
  if (typeof encrypted !== 'string' || encrypted.trim().length === 0) return null;

  try {
    const ciphertext = Buffer.from(encrypted, 'base64');

    // Not a whole number of DES blocks — not something we can decrypt.
    if (ciphertext.length === 0 || ciphertext.length % DES_BLOCK_SIZE !== 0) return null;

    const cipher = DES.create({ type: 'decrypt', key: DES_KEY, padding: false });
    const decrypted = Buffer.concat([
      Buffer.from(cipher.update(ciphertext)),
      Buffer.from(cipher.final()),
    ]);

    const url = stripPkcs5Padding(decrypted).toString('utf8');

    // Guard against a wrong key yielding plausible-length garbage.
    if (!url.startsWith('http')) return null;

    return url;
  } catch {
    return null;
  }
}

/**
 * Expands one decrypted URL into every bitrate variant.
 *
 * The decrypted URL ends in `_96.mp4`; swapping the bitrate token was verified
 * to return HTTP 206 for `_320`, so quality selection needs no extra upstream
 * calls. Variants are returned ascending, meaning the last entry is the best
 * available.
 *
 * Upgrading to HTTPS matters: a mixed-content audio request is blocked outright
 * by browsers on an HTTPS deployment.
 */
export function buildDownloadLinks(encrypted: unknown): DownloadLink[] {
  const decrypted = decryptMediaUrl(encrypted);
  if (decrypted === null) return [];

  const secure = decrypted.replace(/^http:\/\//i, 'https://');

  // Match the bitrate token immediately before the file extension.
  const bitratePattern = /_(\d+)(?=\.[a-z0-9]+$)/i;

  if (!bitratePattern.test(secure)) {
    // Unexpected shape (e.g. a preview clip). Still playable as-is.
    return [{ quality: '96kbps', url: secure }];
  }

  return QUALITY_BITRATES.map(({ quality, bitrate }) => ({
    quality,
    url: secure.replace(bitratePattern, `_${bitrate}`),
  }));
}

/** Highest-quality URL, or null when decryption failed. */
export function bestDownloadUrl(links: DownloadLink[]): string | null {
  return links.length === 0 ? null : (links[links.length - 1]?.url ?? null);
}
