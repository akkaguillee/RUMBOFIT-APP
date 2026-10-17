/** Product barcodes: EAN-8, UPC-A (12), EAN-13 and GTIN-14, checked with their own check digit. */
const LENGTHS = new Set([8, 12, 13, 14]);

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || !LENGTHS.has(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  // Weights 3,1,3… from the digit next to the check digit, leftwards.
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
