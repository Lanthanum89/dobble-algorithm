/**
 * Dobble (Spot It!) Card Generator
 *
 * Generates cards for the Dobble game where any two cards share exactly
 * one symbol in common, based on projective plane geometry. For a prime
 * number p, this creates p² + p + 1 cards with p + 1 symbols each.
 */

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;

  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Generates a Dobble card set using projective plane construction
 * (an affine plane plus a "line at infinity").
 *
 * @param p - Prime number (determines set size)
 * @returns Array of cards, each card an array of symbol IDs
 */
export function generateDobbleCards(p: number): number[][] {
  if (!isPrime(p)) {
    throw new Error(`${p} is not a prime number. Please use a prime number.`);
  }

  const cards: number[][] = [];

  // Symbol numbering:
  // 0: "vertical direction" (point at infinity for vertical lines)
  // 1..p: direction symbols for slopes 0, 1, ..., p-1
  // (p+1) onwards: points in affine plane, numbered as (p+1) + row*p + col
  const point = (row: number, col: number) => (p + 1) + row * p + col;

  // Card 0: the "line at infinity" - contains all direction symbols.
  const card0: number[] = [];
  for (let i = 0; i <= p; i++) {
    card0.push(i);
  }
  cards.push(card0);

  // p² affine lines: y = mx + b
  for (let m = 0; m < p; m++) {
    for (let b = 0; b < p; b++) {
      const card: number[] = [m + 1]; // direction symbol for slope m
      for (let x = 0; x < p; x++) {
        const y = (m * x + b) % p;
        card.push(point(y, x));
      }
      cards.push(card);
    }
  }

  // p vertical lines: x = c (parallel, meet at direction symbol 0)
  for (let c = 0; c < p; c++) {
    const card: number[] = [0];
    for (let y = 0; y < p; y++) {
      card.push(point(y, c));
    }
    cards.push(card);
  }

  return cards;
}

export interface VerificationResult {
  success: boolean;
  totalComparisons: number;
  errors: Array<{ card1: number; card2: number; commonSymbols: number; symbols: number[] }>;
}

/** Verifies that all cards follow the Dobble rule (exactly one common symbol). */
export function verifyDobbleCards(cards: number[][]): VerificationResult {
  const errors: VerificationResult['errors'] = [];

  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const card1 = cards[i]!;
      const card2 = cards[j]!;
      const common = card1.filter(symbol => card2.includes(symbol));

      if (common.length !== 1) {
        errors.push({ card1: i, card2: j, commonSymbols: common.length, symbols: common });
      }
    }
  }

  return {
    success: errors.length === 0,
    totalComparisons: (cards.length * (cards.length - 1)) / 2,
    errors,
  };
}

/** Converts numeric symbol IDs to custom labels (e.g. emojis, letters). */
export function convertToSymbols<T>(cards: number[][], symbols: T[]): (T | string)[][] {
  return cards.map(card =>
    card.map(symbolId => symbols[symbolId] ?? `Symbol${symbolId}`)
  );
}

export function printCards(cards: unknown[][]): void {
  cards.forEach((card, index) => {
    console.log(`Card ${index}: [${card.join(', ')}]`);
  });
}
