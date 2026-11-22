// Pocket Play shell: picker, view switching, hold-to-exit, history/back button, mute, service worker.

import { audio } from './audio.js';
import { GAMES } from './registry.js';

const HOLD_MS = 1000;      // press-and-hold time to leave a game
const QUICK_TAP_MS = 400;  // shorter than this counts as a tap and shows the hint
const RING_CIRC = 179;     // circumference of the exit ring (2 * PI * 28.5)

const $ = (id) => document.getElementById(id);
const landing = $('landing'), home = $('home'), gameEl = $('game'), stage = $('stage'), hudCenter = $('hudCenter');

// Launched from the home screen? Then skip the landing page and open straight to the picker.
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const tiles = $('tiles'), exitBtn = $('exitBtn'), ring = $('ring'), hint = $('hint');

let current = null;      // { id, mod } of the running game
let opening = false;
let updateReady = false; // a new service worker took over; reload next time we're on the picker

// ---------- Picker ----------
function renderTiles() {
  for (const g of GAMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-label', `Play ${g.name}`);
    b.innerHTML = g.art;
    b.append(g.name);
    b.addEventListener('click', () => openGame(g));
    tiles.appendChild(b);
  }
  // Always end with a "coming soon" placeholder. If it would sit alone on its row, make it a full-width banner.
  const soon = document.createElement('div');
  const alone = GAMES.length % 2 === 0;
  soon.className = alone ? 'tile soon wide' : 'tile soon';
  soon.innerHTML = alone ? 'More games coming soon' : 'More games<br>coming soon';
  tiles.appendChild(soon);
}

// ---------- Mute ----------
function syncMute() {
  document.querySelectorAll('.mute').forEach((b) => {
    b.classList.toggle('off', audio.muted);
    b.setAttribute('aria-pressed', String(audio.muted));
    b.setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Turn sound off');
  });
}
document.querySelectorAll('.mute').forEach((b) =>
  b.addEventListener('click', () => {
    audio.init();
    audio.muted = !audio.muted;
    syncMute();
    if (!audio.muted) audio.blip();
  })
);

// ---------- Views ----------
const loadedStyles = new Map();
function ensureStyles(href) {
  if (!href) return Promise.resolve();
  if (!loadedStyles.has(href)) {
    loadedStyles.set(href, new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = link.onerror = () => resolve();
      document.head.appendChild(link);
    }));
  }
  return loadedStyles.get(href);
}

async function openGame(g) {
  if (current || opening) return;
  opening = true;
  audio.init(); // first user tap: unlock audio
  try {
    const [mod] = await Promise.all([import(g.module), ensureStyles(g.styles)]);
    home.hidden = true;
    gameEl.hidden = false;
    history.pushState({ game: g.id }, '');
    current = { id: g.id, mod };
    mod.start(stage, { audio, muted: audio.muted, hud: hudCenter });
  } catch (err) {
    console.error('Could not start game', err);
    closeGame(false);
  } finally {
    opening = false;
  }
}

function closeGame(withSound = true) {
  resetHold();
  if (current) {
    try { current.mod.stop(); } catch (err) { console.error(err); }
    current = null;
  }
  audio.stopAll();
  stage.replaceChildren();
  hudCenter.replaceChildren();
  gameEl.hidden = true;
  home.hidden = false;
  if (withSound) audio.swoosh();
  if (updateReady) location.reload();
}

/** Leave the game the same way the back button does, so history stays in step. */
function requestExit() {
  if (history.state && history.state.game) history.back(); // popstate will close the game
  else closeGame();
}

// ---------- Landing ----------
// History stack in a browser tab: landing (base) -> { view: 'picker' } -> { game }.
// From the home screen the base entry is the picker itself.
function showMenuView() {
  const s = history.state || {};
  const showLanding = !standalone && s.view !== 'picker';
  landing.hidden = !showLanding;
  home.hidden = showLanding;
  if (showLanding) landing.scrollTop = 0;
}

document.querySelectorAll('[data-start]').forEach((b) =>
  b.addEventListener('click', () => {
    audio.init();
    history.pushState({ view: 'picker' }, '');
    showMenuView();
  })
);

// Android back button / browser back: step back one screen (game -> picker -> landing).
window.addEventListener('popstate', () => {
  const inGame = history.state && history.state.game;
  if (current && !inGame) closeGame();
  if (!inGame) showMenuView();
});

// ---------- Hold-to-exit ----------
let holdStart = null, holdRaf = 0, hintTimer = 0;

function tickHold() {
  if (holdStart == null) return;
  const p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
  ring.style.strokeDashoffset = RING_CIRC * (1 - p);
  if (p >= 1) { resetHold(); requestExit(); return; }
  holdRaf = requestAnimationFrame(tickHold);
}
function beginHold() {
  if (holdStart != null) return;
  holdStart = performance.now();
  tickHold();
}
function cancelHold() {
  if (holdStart == null) return;
  if (performance.now() - holdStart < QUICK_TAP_MS) {
    hint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('show'), 1600);
  }
  resetHold();
}
function resetHold() {
  holdStart = null;
  cancelAnimationFrame(holdRaf);
  ring.style.strokeDashoffset = RING_CIRC;
}

exitBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.init();
  try { exitBtn.setPointerCapture(e.pointerId); } catch (err) {}
  beginHold();
});
exitBtn.addEventListener('pointerup', cancelHold);
exitBtn.addEventListener('pointercancel', resetHold);
exitBtn.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); beginHold(); }
});
exitBtn.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') cancelHold(); });
exitBtn.addEventListener('blur', resetHold);

// ---------- Page-level guards ----------
// Unlock audio on the very first tap anywhere.
document.addEventListener('pointerdown', () => audio.init(), { capture: true });
// No long-press menus, pinch zoom (iOS ignores user-scalable=no) or double-tap zoom.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());
// Silence everything when the app goes to the background.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.stopAll(); audio.suspend(); resetHold(); }
});

// ---------- Service worker (offline) ----------
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, nothing to refresh
    // A new version is active. Swap it in when it won't interrupt play.
    if (current || opening) updateReady = true;
    else location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered', err));
  });
}

// ---------- Boot ----------
// If the page was reloaded while a game entry was on the history stack, start on the picker.
if (history.state && history.state.game) history.replaceState({ view: 'picker' }, '');
renderTiles();
syncMute();
showMenuView();
