export interface Photo {
  id: number;
  blob: Blob;
  name: string;
  addedAt: number;
}

export interface DeckConfig {
  p: number;
  photoIds: number[];
  layoutSeed: number;
  createdAt: number;
}

export interface Deck extends DeckConfig {
  /** Each card is an array of photo IDs (one per symbol slot). */
  cards: number[][];
}

export interface LayoutPoint {
  /** Center x, as a fraction of the card's own radius ([-1, 1], 0 = center). */
  x: number;
  /** Center y, as a fraction of the card's own radius. */
  y: number;
  /** Radius, as a fraction of the card's own radius. */
  r: number;
  /** Rotation in degrees, purely cosmetic. */
  rot: number;
}

export interface PlayState {
  /** Shuffled indices of cards still in the draw pile (top of pile = last element). */
  order: number[];
  centerIdx: number;
  correct: number;
  wrong: number;
  startedAt: number;
  finished: boolean;
}
