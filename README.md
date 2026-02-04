# Dobble Algorithm (Spot It!)

A JavaScript implementation of the Dobble card generation algorithm based on projective plane geometry.

## What is Dobble?

Dobble (also known as Spot It!) is a card game where:
- Each card has several symbols on it
- **Any two cards have exactly one symbol in common**
- Players race to find the matching symbol between cards

## The Algorithm

The algorithm uses mathematical properties of projective planes:

For a prime number `p`:
- Total cards: `p² + p + 1`
- Symbols per card: `p + 1`
- Total unique symbols: `p² + p + 1`

### Example with p=7:
- 57 cards (7² + 7 + 1)
- 8 symbols per card (7 + 1)
- 57 unique symbols total

## Usage

### Basic Usage

```javascript
const { generateDobbleCards, verifyDobbleCards } = require('./dobble');

// Generate cards using prime number 7
const cards = generateDobbleCards(7);
console.log(`Generated ${cards.length} cards`);

// Verify that all cards follow the Dobble rule
const verification = verifyDobbleCards(cards);
console.log('Valid:', verification.success);
```

### With Custom Symbols

```javascript
const { generateDobbleCards, convertToSymbols } = require('./dobble');

const cards = generateDobbleCards(3); // Smaller set: 13 cards

const symbols = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', 
                 '🐼', '🐨', '🐯', '🦁', '🐮', '🐷'];

const emojiCards = convertToSymbols(cards, symbols);
console.log(emojiCards);
```

### Run the Example

```bash
node dobble.js
```

### Interactive HTML Demo

Open `index.html` in a web browser to see an interactive card generator with emoji symbols. You can:
- Select different prime numbers to generate different set sizes
- See cards rendered beautifully with emoji symbols
- Hover over cards to see the interactive animations

## Example Output

## API

### `generateDobbleCards(p)`
Generates a complete Dobble card set.
- **Parameters:** `p` (number) - A prime number
- **Returns:** Array of cards, where each card is an array of symbol IDs
- **Throws:** Error if `p` is not prime

### `verifyDobbleCards(cards)`
Verifies that all cards follow the Dobble rule.
- **Parameters:** `cards` (Array) - Array of cards to verify
- **Returns:** Object with verification results

### `convertToSymbols(cards, symbols)`
Converts numeric symbol IDs to custom labels.
- **Parameters:**
  - `cards` (Array) - Cards with numeric IDs
  - `symbols` (Array) - Array of symbol labels
- **Returns:** Cards with custom labels

### `isPrime(n)`
Checks if a number is prime.
- **Parameters:** `n` (number) - Number to check
- **Returns:** Boolean

## Common Prime Numbers for Dobble

| Prime (p) | Cards | Symbols per Card | Total Symbols |
|-----------|-------|------------------|---------------|
| 2         | 7     | 3                | 7             |
| 3         | 13    | 4                | 13            |
| 5         | 31    | 6                | 31            |
| 7         | 57    | 8                | 57            |
| 11        | 133   | 12               | 133           |
| 13        | 183   | 14               | 183           |

The original Dobble game uses p=7, resulting in 55 cards with 8 symbols each (with 2 cards removed for manufacturing reasons).

## How It Works

The algorithm uses finite projective plane geometry, specifically an affine plane extended with a "line at infinity":

### Symbol Structure
- **Direction symbols** (0 to p): Represent "points at infinity" where parallel lines meet
  - Symbol 0: Where all vertical lines meet
  - Symbols 1 to p: Where lines of each slope (0 to p-1) meet
- **Point symbols** (p+1 to p²+p): Represent points in the affine plane, arranged as (p+1) + row×p + col

### Card Construction

1. **Card 0 - Line at Infinity**
   - Contains all direction symbols: [0, 1, 2, ..., p]
   - This card shares exactly one "direction" with every other card

2. **Cards 1 to p² - Affine Lines (y = mx + b)**
   - For each slope m (0 to p-1) and y-intercept b (0 to p-1):
   - Contains: direction symbol (m+1) + p points on the line y ≡ mx + b (mod p)
   - Each line has a unique slope-intercept combination

3. **Cards p²+1 to p²+p - Vertical Lines (x = c)**
   - For each column c (0 to p-1):
   - Contains: direction symbol 0 + p points where x = c
   - All vertical lines are parallel and meet at symbol 0

### Why It Works

The construction ensures that:
- Any two non-parallel affine lines intersect at exactly one affine point
- Any two lines with the same slope (including verticals) share their direction symbol
- The line at infinity intersects each affine/vertical line at its direction symbol
- Every pair of cards shares exactly one symbol - either a direction or an affine point

## License

MIT
