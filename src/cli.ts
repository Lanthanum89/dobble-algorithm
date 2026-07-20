import { generateDobbleCards, verifyDobbleCards, convertToSymbols, printCards } from './dobble.ts';

const p = 7; // Use prime number 7

console.log(`Generating Dobble cards for p = ${p}`);
console.log(`Expected: ${p * p + p + 1} cards with ${p + 1} symbols each\n`);

const cards = generateDobbleCards(p);
console.log(`Generated ${cards.length} cards\n`);

const verification = verifyDobbleCards(cards);
console.log('Verification:', verification.success ? '✓ PASSED' : '✗ FAILED');
console.log(`Total comparisons: ${verification.totalComparisons}`);

if (!verification.success) {
  console.log('Errors:', verification.errors);
}

console.log('\nFirst 5 cards:');
printCards(cards.slice(0, 5));

const emojiSymbols = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐜', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖',
  '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠',
  '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆'];

const emojiCards = convertToSymbols(cards.slice(0, 3), emojiSymbols);
console.log('\nFirst 3 cards with emoji symbols:');
printCards(emojiCards);
