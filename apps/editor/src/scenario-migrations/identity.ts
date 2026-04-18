export const pieceIdAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const pieceIdLength = 6;
const pieceIdPrefix = "piece_";
const pieceIdPattern = new RegExp(
  `^${pieceIdPrefix}[${pieceIdAlphabet}]{${pieceIdLength}}$`
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

function randomPieceId(): string {
  const bytes = new Uint8Array(pieceIdLength);
  crypto.getRandomValues(bytes);
  let out = pieceIdPrefix;
  for (const byte of bytes) {
    out += pieceIdAlphabet[byte % pieceIdAlphabet.length];
  }
  return out;
}
