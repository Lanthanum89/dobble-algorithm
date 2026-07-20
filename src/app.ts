/**
 * My Dobble - app logic: photo upload, deck generation from user photos,
 * grid view rendering, and a "tower" style single-player play mode.
 */
import { registerSW } from 'virtual:pwa-register';
import { generateDobbleCards } from './dobble.ts';
import * as DobbleStorage from './storage.ts';
import { layoutForCard, clearLayoutCache } from './layout.ts';
import type { Deck, DeckConfig, Photo, PlayState } from './types.ts';

const PRIME_OPTIONS = [2, 3, 5, 7, 11] as const;

interface AppState {
  p: number;
  photos: Photo[];
  photoUrls: Map<number, string>;
  deck: Deck | null;
  play: PlayState | null;
}

const state: AppState = {
  p: 7,
  photos: [],
  photoUrls: new Map(),
  deck: null,
  play: null,
};

// ---------- Utilities ----------

function $<T extends Element = Element>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}
function $all<T extends Element = Element>(sel: string): T[] {
  return Array.from(document.querySelectorAll<T>(sel));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string, ms = 2200): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function requiredPhotoCount(p: number): number {
  return p * p + p + 1;
}

function symbolsPerCard(p: number): number {
  return p + 1;
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function objectUrlFor(photo: Photo): string {
  let url = state.photoUrls.get(photo.id);
  if (!url) {
    url = URL.createObjectURL(photo.blob);
    state.photoUrls.set(photo.id, url);
  }
  return url;
}

// ---------- Tabs ----------

type ViewName = 'setup' | 'grid' | 'play';

function showView(name: ViewName): void {
  $all('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  $all<HTMLButtonElement>('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

function setupTabs(): void {
  $all<HTMLButtonElement>('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const view = btn.dataset.view as ViewName;
      showView(view);
      if (view === 'grid') renderGrid();
      if (view === 'play') startOrResumePlay();
    });
  });
}

function updateTabAvailability(): void {
  const hasDeck = !!state.deck;
  $all<HTMLButtonElement>('.tab-btn[data-view="grid"], .tab-btn[data-view="play"]').forEach(b => {
    b.disabled = !hasDeck;
  });
}

// ---------- Setup: deck size ----------

function renderSizeOptions(): void {
  const wrap = $('#sizeOptions');
  wrap.innerHTML = '';
  PRIME_OPTIONS.forEach(p => {
    const count = requiredPhotoCount(p);
    const perCard = symbolsPerCard(p);
    const div = document.createElement('div');
    div.className = 'size-option' + (p === state.p ? ' selected' : '');
    div.dataset.p = String(p);
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

async function loadPhotos(): Promise<void> {
  state.photos = await DobbleStorage.getAllPhotos();
  renderPhotoGrid();
  renderPhotoProgress();
}

function renderPhotoProgress(): void {
  const need = requiredPhotoCount(state.p);
  const have = state.photos.length;
  const pct = Math.min(100, Math.round((have / need) * 100));
  ($('#progressBar') as HTMLElement).style.width = pct + '%';
  $('#progressText').textContent = have >= need
    ? `${have} photos ready (need ${need}) — you're good to go!`
    : `${have} / ${need} photos added — add ${need - have} more`;
  ($('#generateBtn') as HTMLButtonElement).disabled = have < need;
}

function renderPhotoGrid(): void {
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

async function handleFiles(fileList: FileList | File[]): Promise<void> {
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

function setupUpload(): void {
  const dropzone = $('#dropzone');
  const fileInput = $<HTMLInputElement>('#fileInput');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files) handleFiles(target.files);
    target.value = '';
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
    const dragEvent = e as DragEvent;
    if (dragEvent.dataTransfer?.files) {
      handleFiles(dragEvent.dataTransfer.files);
    }
  });

  window.addEventListener('paste', (e) => {
    if (!$('#view-setup').classList.contains('active')) return;
    const items = (e as ClipboardEvent).clipboardData?.files;
    if (items && items.length) handleFiles(items);
  });
}

// ---------- Deck generation ----------

async function generateDeck(): Promise<void> {
  const p = state.p;
  const need = requiredPhotoCount(p);
  if (state.photos.length < need) {
    toast(`Need ${need} photos, only have ${state.photos.length}`);
    return;
  }
  const chosenIds = shuffle(state.photos.map(ph => ph.id)).slice(0, need);
  const layoutSeed = Math.floor(Math.random() * 1e9);
  const config: DeckConfig = { p, photoIds: chosenIds, layoutSeed, createdAt: Date.now() };
  await DobbleStorage.setMeta('config', config);
  buildDeckFromConfig(config);
  toast('Deck generated!');
  showView('grid');
  renderGrid();
}

function buildDeckFromConfig(config: DeckConfig): void {
  const rawCards = generateDobbleCards(config.p);
  const cards = rawCards.map(card => card.map(symbolId => config.photoIds[symbolId]!));
  state.deck = { ...config, cards };
  updateTabAvailability();
}

async function tryRestoreDeck(): Promise<boolean> {
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

// ---------- Card rendering ----------

function renderCard(symbolPhotoIds: number[], cardIndex: number, layoutSeed: number, opts: { clickable?: boolean } = {}): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'dobble-card' + (opts.clickable ? ' clickable' : '');
  const layout = layoutForCard(cardIndex, symbolPhotoIds.length, layoutSeed);
  const photoById = new Map(state.photos.map(ph => [ph.id, ph]));

  symbolPhotoIds.forEach((photoId, i) => {
    const photo = photoById.get(photoId);
    const pos = layout[i];
    if (!photo || !pos) return;
    const img = document.createElement('img');
    img.className = 'symbol-img';
    img.src = objectUrlFor(photo);
    img.dataset.photoId = String(photoId);
    // pos.r is a radius in units of the card's own radius (1 = edge of
    // the card), and the card's radius is 50% of its width, so diameter
    // as a percentage of card width is simply pos.r * 100.
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

function renderGrid(): void {
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

function reshuffleLayout(): void {
  if (!state.deck) return;
  state.deck.layoutSeed = Math.floor(Math.random() * 1e9);
  clearLayoutCache();
  DobbleStorage.setMeta('config', {
    p: state.deck.p, photoIds: state.deck.photoIds,
    layoutSeed: state.deck.layoutSeed, createdAt: state.deck.createdAt,
  });
  renderGrid();
  toast('Layout shuffled!');
}

// ---------- Play mode (tower / spot-it style) ----------

function findCommonSymbol(cardA: number[], cardB: number[]): number | null {
  const setA = new Set(cardA);
  for (const s of cardB) if (setA.has(s)) return s;
  return null;
}

function startOrResumePlay(): void {
  if (!state.deck) return;
  if (!state.play || state.play.finished) newPlayGame();
  else renderPlay();
}

function newPlayGame(): void {
  if (!state.deck) return;
  const order = shuffle(state.deck.cards.map((_, i) => i));
  const centerIdx = order.pop();
  if (centerIdx === undefined) return;
  state.play = {
    order,
    centerIdx,
    correct: 0,
    wrong: 0,
    startedAt: Date.now(),
    finished: false,
  };
  renderPlay();
}

function renderPlay(): void {
  const play = state.play;
  const deck = state.deck;
  if (!play || !deck) return;
  const area = $('#playArea');
  area.innerHTML = '';
  ($('#winBanner') as HTMLElement).style.display = 'none';

  $('#playCorrect').textContent = String(play.correct);
  $('#playWrong').textContent = String(play.wrong);
  $('#playRemaining').textContent = String(play.order.length + 1);

  if (play.order.length === 0) {
    finishPlay();
    return;
  }

  const centerCard = deck.cards[play.centerIdx]!;
  const nextIdx = play.order[play.order.length - 1]!;
  const nextCard = deck.cards[nextIdx]!;
  const common = findCommonSymbol(centerCard, nextCard);

  const colCenter = document.createElement('div');
  colCenter.className = 'play-area-col';
  colCenter.innerHTML = '<div class="card-label">Center Pile</div>';
  colCenter.appendChild(renderCard(centerCard, play.centerIdx, deck.layoutSeed));

  const colNext = document.createElement('div');
  colNext.className = 'play-area-col';
  colNext.innerHTML = '<div class="card-label">Find the match!</div>';
  const nextCardEl = renderCard(nextCard, nextIdx, deck.layoutSeed, { clickable: true });
  colNext.appendChild(nextCardEl);

  nextCardEl.querySelectorAll<HTMLImageElement>('.symbol-img').forEach(img => {
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
        $('#playWrong').textContent = String(play.wrong);
        setTimeout(() => img.classList.remove('wrong'), 400);
      }
    });
  });

  area.appendChild(colCenter);
  area.appendChild(colNext);
}

function finishPlay(): void {
  if (!state.play) return;
  state.play.finished = true;
  const seconds = Math.round((Date.now() - state.play.startedAt) / 1000);
  $('#playArea').innerHTML = '';
  const banner = $('#winBanner') as HTMLElement;
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

async function resetAll(): Promise<void> {
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

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function setupInstallPrompt(): void {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  const banner = $('#installBanner') as HTMLElement;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    banner.style.display = 'flex';
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
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

// ---------- Init ----------

export async function init(): Promise<void> {
  registerSW({ immediate: true });

  setupTabs();
  setupUpload();
  setupInstallPrompt();

  renderSizeOptions();
  $('#generateBtn').addEventListener('click', generateDeck);
  $('#resetBtn').addEventListener('click', resetAll);
  $('#reshuffleLayoutBtn').addEventListener('click', reshuffleLayout);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#editPhotosBtn').addEventListener('click', () => showView('setup'));
  $('#newGameBtn').addEventListener('click', newPlayGame);

  await loadPhotos();
  const restored = await tryRestoreDeck();
  if (restored && state.deck) {
    state.p = state.deck.p;
    renderSizeOptions();
  }
  updateTabAvailability();
  renderPhotoProgress();
}
