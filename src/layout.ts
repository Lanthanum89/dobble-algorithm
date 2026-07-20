import type { LayoutPoint } from './types.ts';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlacedCircle {
  x: number;
  y: number;
  r: number;
  rot: number;
}

const layoutCache = new Map<string, LayoutPoint[]>();

/**
 * Deterministically packs `count` circles (one per symbol) into a unit
 * disk with no overlap, in random-looking but reproducible positions -
 * the classic "spot it" scattered symbol look.
 *
 * Same (cardIndex, count, layoutSeed) always yields the same layout, so
 * a card looks identical every time it's rendered (grid view, play mode,
 * after reload) until the deck is explicitly reshuffled.
 */
export function layoutForCard(cardIndex: number, count: number, layoutSeed: number): LayoutPoint[] {
  const key = `${layoutSeed}:${cardIndex}:${count}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;

  const rng = mulberry32((layoutSeed * 2654435761 + cardIndex * 40503) >>> 0);
  // Scaled from the known optimal equal-circle-in-a-circle packing radius
  // (~0.8/sqrt(n)) with a safety margin, since our packer is a random
  // attempt-based approximation rather than a true optimal solver.
  const baseR = 0.42 / Math.sqrt(count);
  const GAP = 1.05; // keep a visible gap between circles so hit areas never touch

  // Roll a size for every symbol first, then place the biggest ones
  // first - packing large-to-small leaves fewer forced overlaps.
  const sizes = Array.from({ length: count }, () => baseR * (0.8 + rng() * 0.45));
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]! - sizes[a]!);

  const placed: PlacedCircle[] = [];
  const results: PlacedCircle[] = new Array(count);

  for (const i of order) {
    const r = sizes[i]!;
    let best: { x: number; y: number; r: number; overlap?: number } | null = null;
    for (let attempt = 0; attempt < 600; attempt++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * Math.max(0, 1 - r);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      let overlap = 0;
      for (const q of placed) {
        const d = Math.hypot(x - q.x, y - q.y);
        const minD = (r + q.r) * GAP;
        if (d < minD) overlap = Math.max(overlap, minD - d);
      }
      if (overlap === 0) { best = { x, y, r }; break; }
      if (!best || overlap < best.overlap!) best = { x, y, r, overlap };
    }
    const entry: PlacedCircle = { x: best!.x, y: best!.y, r, rot: rng() * 360 };
    placed.push(entry);
    results[i] = entry;
  }

  // Random placement alone can leave a few circles still touching,
  // especially with many symbols on one card - nudge overlapping
  // pairs apart until none remain (or we give up after a few passes).
  for (let pass = 0; pass < 60; pass++) {
    let anyOverlap = false;
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const p1 = placed[a]!, p2 = placed[b]!;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy);
        const minD = (p1.r + p2.r) * GAP;
        if (d < minD) {
          anyOverlap = true;
          const push = (minD - d) / 2;
          let ux: number, uy: number;
          if (d < 1e-6) {
            const a2 = rng() * Math.PI * 2;
            ux = Math.cos(a2); uy = Math.sin(a2);
          } else {
            ux = dx / d; uy = dy / d;
          }
          p1.x -= ux * push; p1.y -= uy * push;
          p2.x += ux * push; p2.y += uy * push;
        }
      }
    }
    for (const p of placed) {
      const dist = Math.hypot(p.x, p.y);
      const maxDist = 1 - p.r;
      if (maxDist > 0 && dist > maxDist) {
        const s = maxDist / dist;
        p.x *= s; p.y *= s;
      }
    }
    if (!anyOverlap) break;
  }

  let maxExtent = 1;
  for (const pt of placed) maxExtent = Math.max(maxExtent, Math.hypot(pt.x, pt.y) + pt.r);
  const scale = maxExtent > 1 ? 1 / maxExtent : 1;
  const result = results.map(pt => ({
    x: pt.x * scale, y: pt.y * scale, r: pt.r * scale, rot: pt.rot,
  }));
  layoutCache.set(key, result);
  return result;
}

export function clearLayoutCache(): void {
  layoutCache.clear();
}
