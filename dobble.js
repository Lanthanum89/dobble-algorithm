/**
 * Dobble (Spot It!) Card Generator
 * 
 * This algorithm generates cards for the Dobble game where:
 * - Any two cards share exactly one symbol in common
 * - Based on projective plane geometry
 * - For a prime number p: creates p²+p+1 cards with p+1 symbols each
 */

/**
 * Checks if a number is prime
 * @param {number} n - Number to check
 * @returns {boolean} True if prime
 */
function isPrime(n) {
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
 * Based on affine plane + line at infinity
 * @param {number} p - Prime number (determines set size)
 * @returns {Array<Array<number>>} Array of cards, each card is an array of symbol IDs
 */
function generateDobbleCards(p) {
    if (!isPrime(p)) {
        throw new Error(`${p} is not a prime number. Please use a prime number.`);
    }
    
    const cards = [];
    
    // Symbol numbering:
    // 0: "vertical direction" (point at infinity for vertical lines)
    // 1..p: direction symbols for slopes 0, 1, ..., p-1
    // (p+1) onwards: points in affine plane, numbered as (p+1) + row*p + col
    
    const point = (row, col) => (p + 1) + row * p + col;
    
    // Card 0: the "line at infinity"
    // Contains: all direction symbols (0, 1, ..., p)
    const card0 = [];
    for (let i = 0; i <= p; i++) {
        card0.push(i);
    }
    cards.push(card0);
    
    // p² affine lines: y = mx + b
    // Line with slope m and y-intercept b
    for (let m = 0; m < p; m++) {
        for (let b = 0; b < p; b++) {
            const card = [];
            card.push(m + 1); // direction symbol for slope m
            
            // Points on the line y = mx + b (mod p)
            for (let x = 0; x < p; x++) {
                const y = (m * x + b) % p;
                card.push(point(y, x)); // row=y, col=x
            }
            
            cards.push(card);
        }
    }
    
    // p vertical lines: x = c
    // These are parallel and meet at direction symbol 0
    for (let c = 0; c < p; c++) {
        const card = [];
        card.push(0); // direction symbol 0 for vertical lines
        
        // All points in column c
        for (let y = 0; y < p; y++) {
            card.push(point(y, c));
        }
        
        cards.push(card);
   }
    
    return cards;
}

/**
 * Verifies that all cards follow the Dobble rule (exactly one common symbol)
 * @param {Array<Array<number>>} cards - Array of cards to verify
 * @returns {Object} Verification result with success status and details
 */
function verifyDobbleCards(cards) {
    const errors = [];
    
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            const card1 = cards[i];
            const card2 = cards[j];
            
            // Find common symbols
            const common = card1.filter(symbol => card2.includes(symbol));
            
            if (common.length !== 1) {
                errors.push({
                    card1: i,
                    card2: j,
                    commonSymbols: common.length,
                    symbols: common
                });
            }
        }
    }
    
    return {
        success: errors.length === 0,
        totalComparisons: (cards.length * (cards.length - 1)) / 2,
        errors: errors
    };
}

/**
 * Converts symbol IDs to custom labels (e.g., emojis, letters, etc.)
 * @param {Array<Array<number>>} cards - Cards with numeric symbol IDs
 * @param {Array<string>} symbols - Array of symbol labels
 * @returns {Array<Array<string>>} Cards with custom labels
 */
function convertToSymbols(cards, symbols) {
    return cards.map(card => 
        card.map(symbolId => symbols[symbolId] || `Symbol${symbolId}`)
    );
}

/**
 * Prints cards in a readable format
 * @param {Array<Array<any>>} cards - Cards to print
 */
function printCards(cards) {
    cards.forEach((card, index) => {
        console.log(`Card ${index}: [${card.join(', ')}]`);
    });
}

// Example usage (Node CLI only)
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const p = 7; // Use prime number 7
    
    console.log(`Generating Dobble cards for p = ${p}`);
    console.log(`Expected: ${p * p + p + 1} cards with ${p + 1} symbols each\n`);
    
    const cards = generateDobbleCards(p);
    
    console.log(`Generated ${cards.length} cards\n`);
    
    // Verify the cards
    const verification = verifyDobbleCards(cards);
    console.log('Verification:', verification.success ? '✓ PASSED' : '✗ FAILED');
    console.log(`Total comparisons: ${verification.totalComparisons}`);
    
    if (!verification.success) {
        console.log('Errors:', verification.errors);
    }
    
    // Print first 5 cards as example
    console.log('\nFirst 5 cards:');
    printCards(cards.slice(0, 5));
    
    // Example with custom symbols (emojis)
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
}

// Export functions for use in other modules (Node) or attach to window (browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateDobbleCards,
        verifyDobbleCards,
        convertToSymbols,
        printCards,
        isPrime
    };
} else if (typeof window !== 'undefined') {
    window.Dobble = {
        generateDobbleCards,
        verifyDobbleCards,
        convertToSymbols,
        printCards,
        isPrime
    };
}
