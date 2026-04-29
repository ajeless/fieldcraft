export const pieceIdAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const pieceIdLength = 6;
const pieceIdPrefix = "piece_";
const sideIdLength = 6;
const sideIdPrefix = "side_";
const pieceIdPattern = new RegExp(
  `^${pieceIdPrefix}[${pieceIdAlphabet}]{${pieceIdLength}}$`
);
const sideIdPattern = new RegExp(
  `^${sideIdPrefix}[${pieceIdAlphabet}]{${sideIdLength}}$`
);

export function generatePieceId(existing: Iterable<string>): string {
  const taken = existing instanceof Set ? existing : new Set(existing);
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = randomPieceId();
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique piece id after 32 attempts.");
}

export function isPieceIdShape(value: string): boolean {
  return pieceIdPattern.test(value);
}

export function generateSideId(existing: Iterable<string>): string {
  const taken = existing instanceof Set ? existing : new Set(existing);
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = randomId(sideIdPrefix, sideIdLength);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique side id after 32 attempts.");
}

export function isSideIdShape(value: string): boolean {
  return sideIdPattern.test(value);
}

function randomPieceId(): string {
  return randomId(pieceIdPrefix, pieceIdLength);
}

function randomId(prefix: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = prefix;
  for (const byte of bytes) {
    out += pieceIdAlphabet[byte % pieceIdAlphabet.length];
  }
  return out;
}
