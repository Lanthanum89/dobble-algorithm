/**
 * My Dobble - app logic: photo upload, deck generation from user photos,
 * grid view rendering, and a "tower" style single-player play mode.
 */
(() => {
    const PRIME_OPTIONS = [2, 3, 5, 7, 11];

    const state = {
        p: 7,
        photos: [],          // [{id, blob, name}]
        photoUrls: new Map(), // id -> object URL
        deck: null,           // {p, photoIds, layoutSeed, cards}
        play: null,           // active play-mode session
    };

    // ---------- Utilities ----------

    function $(sel) { return document.querySelector(sel); }
    function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

    function toast(msg, ms = 2200) {
        const el = $('#toast');
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => el.classList.remove('show'), ms);
    }

    function requiredPhotoCount(p) {
        return p * p + p + 1;
    }

    function symbolsPerCard(p) {
        return p + 1;
    }

    function shuffle(arr, rng = Math.random) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function objectUrlFor(photo) {
        if (!state.photoUrls.has(photo.id)) {
            state.photoUrls.set(photo.id, URL.createObjectURL(photo.blob));
        }
        return state.photoUrls.get(photo.id);
    }

    // ---------- Tabs ----------

    function showView(name) {
        $all('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
        $all('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    }

    function setupTabs() {
        $all('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                showView(btn.dataset.view);
                if (btn.dataset.view === 'grid') renderGrid();
                if (btn.dataset.view === 'play') startOrResumePlay();
            });
        });
    }

    function updateTabAvailability() {
        const hasDeck = !!state.deck;
        $all('.tab-btn[data-view="grid"], .tab-btn[data-view="play"]').forEach(b => {
            b.disabled = !hasDeck;
        });
    }

    // ---------- Setup: deck size ----------

    function renderSizeOptions() {
        const wrap = $('#sizeOptions');
        wrap.innerHTML = '';
        PRIME_OPTIONS.forEach(p => {
            const count = requiredPhotoCount(p);
            const perCard = symbolsPerCard(p);
            const div = document.createElement('div');
            div.className = 'size-option' + (p === state.p ? ' selected' : '');
            div.dataset.p = p;
            div.innerHTML = `
                <div class="cards-count">${count}</div>
                <div class="cards-label">cards</div>
                <div class="symbols-label">${perCard} photos/card</div>
            `;
            div.addEventListener('click', () => {
                state.p = p;
                renderSizeOptions();
                renderPhotoProgress();
            });
            wrap.appendChild(div);
        });
    }

    // ---------- Setup: photo upload ----------

    async function loadPhotos() {
        state.photos = await DobbleStorage.getAllPhotos();
        renderPhotoGrid();
        renderPhotoProgress();
    }

    function renderPhotoProgress() {
        const need = requiredPhotoCount(state.p);
        const have = state.photos.length;
        const pct = Math.min(100, Math.round((have / need) * 100));
        $('#progressBar').style.width = pct + '%';
        $('#progressText').textContent = have >= need
            ? `${have} photos ready (need ${need}) — you're good to go!`
            : `${have} / ${need} photos added — add ${need - have} more`;
        $('#generateBtn').disabled = have < need;
    }

    function renderPhotoGrid() {
        const grid = $('#photoGrid');
        grid.innerHTML = '';
        state.photos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'photo-thumb';
            const img = document.createElement('img');
            img.src = objectUrlFor(photo);
            img.alt = photo.name;
            const btn = document.createElement('button');
            btn.textContent = '✕';
            btn.title = 'Remove photo';
            btn.addEventListener('click', async () => {
                await DobbleStorage.deletePhoto(photo.id);
                await loadPhotos();
            });
            div.appendChild(img);
            div.appendChild(btn);
            grid.appendChild(div);
        });
    }

    async function handleFiles(fileList) {
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        toast(`Adding ${files.length} photo${files.length > 1 ? 's' : ''}...`);
        for (const file of files) {
            try {
                await DobbleStorage.addPhoto(file);
            } catch (err) {
                console.error('Failed to add photo', err);
            }
        }
        await loadPhotos();
        toast('Photos added!');
    }

    function setupUpload() {
        const dropzone = $('#dropzone');
        const fileInput = $('#fileInput');

        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            fileInput.value = '';
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            });
        });
        dropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files) {
                handleFiles(e.dataTransfer.files);
            }
        });

        window.addEventListener('paste', (e) => {
            if (!$('#view-setup').classList.contains('active')) return;
            const items = (e.clipboardData || {}).files;
            if (items && items.length) handleFiles(items);
        });
    }

    // ---------- Deck generation ----------

    async function generateDeck() {
        const p = state.p;
        const need = requiredPhotoCount(p);
        if (state.photos.length < need) {
            toast(`Need ${need} photos, only have ${state.photos.length}`);
            return;
        }
        const chosenIds = shuffle(state.photos.map(ph => ph.id)).slice(0, need);
        const layoutSeed = Math.floor(Math.random() * 1e9);
        const config = { p, photoIds: chosenIds, layoutSeed, createdAt: Date.now() };
        await DobbleStorage.setMeta('config', config);
        buildDeckFromConfig(config);
        toast('Deck generated!');
        showView('grid');
        renderGrid();
    }

    function buildDeckFromConfig(config) {
        const rawCards = window.Dobble.generateDobbleCards(config.p);
        const cards = rawCards.map(card => card.map(symbolId => config.photoIds[symbolId]));
        state.deck = { ...config, cards };
        updateTabAvailability();
    }

    async function tryRestoreDeck() {
        const config = await DobbleStorage.getMeta('config');
        if (config && config.photoIds && state.photos.length) {
            const photoIdSet = new Set(state.photos.map(ph => ph.id));
            const allPresent = config.photoIds.every(id => photoIdSet.has(id));
            if (allPresent) {
                buildDeckFromConfig(config);
                return true;
            }
        }
        return false;
    }

    // ---------- Card layout (deterministic circle packing) ----------

    const layoutCache = new Map();

    function layoutForCard(cardIndex, count, layoutSeed) {
        const key = `${layoutSeed}:${cardIndex}:${count}`;
        if (layoutCache.has(key)) return layoutCache.get(key);

        const rng = mulberry32((layoutSeed * 2654435761 + cardIndex * 40503) >>> 0);
        // Scaled from the known optimal equal-circle-in-a-circle packing radius
        // (~0.8/sqrt(n)) with a safety margin, since our packer is a random
        // attempt-based approximation rather than a true optimal solver.
        const baseR = 0.42 / Math.sqrt(count);
        const GAP = 1.05; // keep a visible gap between circles so hit areas never touch

        // Roll a size for every symbol first, then place the biggest ones
        // first - packing large-to-small leaves fewer forced overlaps.
        const sizes = Array.from({ length: count }, () => baseR * (0.8 + rng() * 0.45));
        const order = sizes.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]);

        const placed = [];
        const results = new Array(count);
        for (const i of order) {
            const r = sizes[i];
            let best = null;
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
                if (!best || overlap < best.overlap) best = { x, y, r, overlap };
            }
            const entry = { x: best.x, y: best.y, r, rot: rng() * 360 };
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
                    const p1 = placed[a], p2 = placed[b];
                    const dx = p2.x - p1.x, dy = p2.y - p1.y;
                    let d = Math.hypot(dx, dy);
                    const minD = (p1.r + p2.r) * GAP;
                    if (d < minD) {
                        anyOverlap = true;
                        const push = (minD - d) / 2;
                        let ux, uy;
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

        const placedOrdered = results;

        let maxExtent = 1;
        for (const pt of placed) maxExtent = Math.max(maxExtent, Math.hypot(pt.x, pt.y) + pt.r);
        const scale = maxExtent > 1 ? 1 / maxExtent : 1;
        const result = placedOrdered.map(pt => ({
            x: pt.x * scale, y: pt.y * scale, r: pt.r * scale, rot: pt.rot,
        }));
        layoutCache.set(key, result);
        return result;
    }

    function renderCard(symbolPhotoIds, cardIndex, layoutSeed, { clickable = false } = {}) {
        const card = document.createElement('div');
        card.className = 'dobble-card' + (clickable ? ' clickable' : '');
        const layout = layoutForCard(cardIndex, symbolPhotoIds.length, layoutSeed);
        const photoById = new Map(state.photos.map(ph => [ph.id, ph]));

        symbolPhotoIds.forEach((photoId, i) => {
            const photo = photoById.get(photoId);
            if (!photo) return;
            const pos = layout[i];
            const img = document.createElement('img');
            img.className = 'symbol-img';
            img.src = objectUrlFor(photo);
            img.dataset.photoId = photoId;
            // pos.r is a radius in units of the card's own radius (1 = edge
            // of the card), and the card's radius is 50% of its width, so
            // diameter as a percentage of card width is simply pos.r * 100.
            const diameterPct = pos.r * 100;
            img.style.width = diameterPct + '%';
            img.style.height = diameterPct + '%';
            img.style.left = (50 + pos.x * 50 - diameterPct / 2) + '%';
            img.style.top = (50 + pos.y * 50 - diameterPct / 2) + '%';
            img.style.transform = `rotate(${pos.rot}deg)`;
            card.appendChild(img);
        });

        return card;
    }

    // ---------- Grid view ----------

    function renderGrid() {
        if (!state.deck) return;
        const { p, cards, layoutSeed } = state.deck;
        $('#gridStats').innerHTML = `
            <div class="stat"><div class="stat-value">${cards.length}</div><div class="stat-label">Total Cards</div></div>
            <div class="stat"><div class="stat-value">${symbolsPerCard(p)}</div><div class="stat-label">Photos per Card</div></div>
            <div class="stat"><div class="stat-value">${p}</div><div class="stat-label">Prime Number</div></div>
            <div class="stat"><div class="stat-value">1</div><div class="stat-label">Shared Photo</div></div>
        `;
        const grid = $('#cardsGrid');
        grid.innerHTML = '';
        cards.forEach((symbolPhotoIds, idx) => {
            const wrap = document.createElement('div');
            const cardEl = renderCard(symbolPhotoIds, idx, layoutSeed);
            const label = document.createElement('div');
            label.className = 'card-label';
            label.textContent = `Card ${idx + 1}`;
            wrap.appendChild(cardEl);
            wrap.appendChild(label);
            grid.appendChild(wrap);
        });
    }

    function reshuffleLayout() {
        if (!state.deck) return;
        state.deck.layoutSeed = Math.floor(Math.random() * 1e9);
        layoutCache.clear();
        DobbleStorage.setMeta('config', {
            p: state.deck.p, photoIds: state.deck.photoIds,
            layoutSeed: state.deck.layoutSeed, createdAt: state.deck.createdAt,
        });
        renderGrid();
        toast('Layout shuffled!');
    }

    // ---------- Play mode (tower / spot-it style) ----------

    function findCommonSymbol(cardA, cardB) {
        const setA = new Set(cardA);
        for (const s of cardB) if (setA.has(s)) return s;
        return null;
    }

    function startOrResumePlay() {
        if (!state.deck) return;
        if (!state.play || state.play.finished) newPlayGame();
        else renderPlay();
    }

    function newPlayGame() {
        const order = shuffle(state.deck.cards.map((_, i) => i));
        state.play = {
            order,
            centerIdx: order.pop(),
            correct: 0,
            wrong: 0,
            startedAt: Date.now(),
            finished: false,
        };
        renderPlay();
    }

    function renderPlay() {
        const play = state.play;
        const area = $('#playArea');
        area.innerHTML = '';
        $('#winBanner').style.display = 'none';

        if (!play || play.order.length === 0 && play.finished) {
            // handled below
        }

        $('#playCorrect').textContent = play.correct;
        $('#playWrong').textContent = play.wrong;
        $('#playRemaining').textContent = play.order.length + 1;

        if (play.order.length === 0) {
            finishPlay();
            return;
        }

        const centerCard = state.deck.cards[play.centerIdx];
        const nextIdx = play.order[play.order.length - 1];
        const nextCard = state.deck.cards[nextIdx];
        const common = findCommonSymbol(centerCard, nextCard);

        const colCenter = document.createElement('div');
        colCenter.className = 'play-area-col';
        colCenter.innerHTML = '<div class="card-label">Center Pile</div>';
        colCenter.appendChild(renderCard(centerCard, play.centerIdx, state.deck.layoutSeed));

        const colNext = document.createElement('div');
        colNext.className = 'play-area-col';
        colNext.innerHTML = '<div class="card-label">Find the match!</div>';
        const nextCardEl = renderCard(nextCard, nextIdx, state.deck.layoutSeed, { clickable: true });
        colNext.appendChild(nextCardEl);

        nextCardEl.querySelectorAll('.symbol-img').forEach(img => {
            img.addEventListener('click', () => {
                const photoId = Number(img.dataset.photoId);
                if (photoId === common) {
                    img.classList.add('correct');
                    play.correct++;
                    setTimeout(() => {
                        play.centerIdx = nextIdx;
                        play.order.pop();
                        renderPlay();
                    }, 350);
                } else {
                    img.classList.add('wrong');
                    play.wrong++;
                    $('#playWrong').textContent = play.wrong;
                    setTimeout(() => img.classList.remove('wrong'), 400);
                }
            }, { once: false });
        });

        area.appendChild(colCenter);
        area.appendChild(colNext);
    }

    function finishPlay() {
        state.play.finished = true;
        const seconds = Math.round((Date.now() - state.play.startedAt) / 1000);
        $('#playArea').innerHTML = '';
        const banner = $('#winBanner');
        banner.style.display = 'block';
        banner.innerHTML = `
            <div class="emoji">🎉</div>
            <h2>Tower cleared!</h2>
            <p>Time: ${seconds}s &nbsp;•&nbsp; Correct: ${state.play.correct} &nbsp;•&nbsp; Mistakes: ${state.play.wrong}</p>
            <div class="actions" style="justify-content:center;">
                <button class="btn" id="playAgainBtn">Play Again</button>
            </div>
        `;
        $('#playAgainBtn').addEventListener('click', newPlayGame);
    }

    // ---------- Reset ----------

    async function resetAll() {
        if (!confirm('This will delete all your uploaded photos and your generated deck. Continue?')) return;
        await DobbleStorage.clearAll();
        state.photoUrls.forEach(url => URL.revokeObjectURL(url));
        state.photoUrls.clear();
        state.photos = [];
        state.deck = null;
        state.play = null;
        updateTabAvailability();
        renderPhotoGrid();
        renderPhotoProgress();
        showView('setup');
        toast('Everything reset.');
    }

    // ---------- Install prompt ----------

    function setupInstallPrompt() {
        let deferredPrompt = null;
        const banner = $('#installBanner');
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            banner.style.display = 'flex';
        });
        $('#installBtn').addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            banner.style.display = 'none';
        });
        $('#installDismissBtn').addEventListener('click', () => {
            banner.style.display = 'none';
        });
        window.addEventListener('appinstalled', () => {
            banner.style.display = 'none';
        });
    }

    // ---------- Service worker ----------

    function registerServiceWorker() {
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(err => {
                    console.warn('Service worker registration failed', err);
                });
            });
        }
    }

    // ---------- Init ----------

    async function init() {
        setupTabs();
        setupUpload();
        setupInstallPrompt();
        registerServiceWorker();

        renderSizeOptions();
        $('#generateBtn').addEventListener('click', generateDeck);
        $('#resetBtn').addEventListener('click', resetAll);
        $('#reshuffleLayoutBtn').addEventListener('click', reshuffleLayout);
        $('#printBtn').addEventListener('click', () => window.print());
        $('#editPhotosBtn').addEventListener('click', () => showView('setup'));
        $('#newGameBtn').addEventListener('click', newPlayGame);

        await loadPhotos();
        const restored = await tryRestoreDeck();
        if (restored) {
            state.p = state.deck.p;
            renderSizeOptions();
        }
        updateTabAvailability();
        renderPhotoProgress();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
