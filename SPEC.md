# Pocket Play — Spec

Kids games PWA. Working names: app "Pocket Play", first game "Dot Pop" (both placeholders).

A working prototype is included as `prototype.html`. Use it as the reference for look, feel, animations and sounds, but restructure it into the file layout below and add the PWA/offline parts it lacks.

## Overview

Build a single-page, installable, fully offline games app that a parent can hand to a child on their phone. It launches with one game (a simplified dot-connecting game) and is structured so more games can be added later.

Non-negotiable principles:

- **No network calls** after the first load. No analytics, external fonts, CDNs or APIs. Bundle any font locally or use a system rounded font stack.
- **No ads, purchases, accounts or external links.** Nothing a child can tap leads out of the app.
- **Static files only:** HTML, CSS and vanilla JavaScript. Hostable on any static host (GitHub Pages, Netlify).
- **Kid-first UI:** big touch targets, minimal text, nothing scary or punishing. There is no losing.
- **Phone-first:** designed for portrait phones; should still work on tablets and desktop browsers.

## Tech stack and PWA

Vanilla HTML, CSS and ES modules. No framework, no build step, no runtime dependencies, so the folder can be served as-is.

- **manifest.json:** app name, short name, icons (192px and 512px, plus a maskable icon), `display: standalone`, `orientation: portrait`, theme and background colours. Use relative paths so it works from a GitHub Pages subpath (e.g. `/pocket-play/`).
- **Service worker:** cache-first. Precache every app file on install with a versioned cache name; delete old caches on activate. After one visit the app must work in airplane mode.
- **Installable:** add-to-home-screen works on Android Chrome and iOS Safari. Include `apple-touch-icon` and the iOS meta tags for standalone mode.
- **Sound:** generated with the Web Audio API (synthesised tones), not audio files. Audio context starts on the first user tap, as browsers require.
- **Storage:** `localStorage` only, for settings such as mute. Nothing else is persisted.
- **Viewport:** disable pinch zoom and double-tap zoom; prevent pull-to-refresh and text selection on game screens; respect safe-area insets on notched phones.

## App shell

The app has two views: a game picker and a game screen. No routing library; swap views in JS.

**Game picker (launch screen)**

- A grid of large, colourful game tiles, each with an illustration and a short name. With one game, show it plus a "More games coming soon" placeholder tile.
- A mute/unmute toggle in a corner. Setting saved in `localStorage`.
- Light, playful idle animation (e.g. tile art gently bobbing).

**Game screen**

- The game fills the screen, with a HUD row: exit button (left), score (centre), mute (right).
- The exit button requires **press-and-hold for about 1 second** to return to the picker. Show a ring filling around the button while held; a quick tap shows a small "Hold to go back" hint and does nothing else.
- Use the History API so the Android back button also returns to the picker instead of closing the app.
- When leaving a game, call its `stop()` to clear timers, listeners, animation frames and audio.

## Game 1: Dot Pop — rules

An endless, no-fail game: connect same-colour dots to pop them, watch new ones fall in, keep going.

**Board**

- 8×8 grid, square, centred on a semi-opaque white rounded panel (so dots stay visible on every background), sized to fit the screen.
- 5 colours, distinguishable for colour-blind players (vary lightness as well as hue): red #FF4D6D, blue #3A86FF, yellow #FFC93C, green #2EC27E, purple #9D4EDD.
- Initial board is random and must contain at least one valid pair.

**Connecting**

1. Touch a dot to start a chain.
2. Drag into an orthogonally adjacent dot (up, down, left, right — never diagonal) of the same colour to add it. A thick line in that colour joins the chain and follows the finger.
3. Dragging back onto the previous dot in the chain removes the last dot (backtracking).
4. A dot already in the chain can't be added again.
5. Different-colour and non-adjacent dots are ignored while dragging.
6. Releasing with **2 or more** dots pops them. Releasing with 1 dot cancels with no penalty.

**After a pop**

1. Popped dots disappear, in sequence along the chain.
2. Dots above each gap fall straight down to fill it.
3. New random dots drop in from above the board to fill the empty cells.
4. Input is blocked until the fall animation finishes.
5. If the board has no pair of same-colour orthogonal neighbours, play a short "Shuffle!" animation and generate a fresh board (which must contain at least one pair).

**Score**

- A counter in the HUD shows total dots popped this session, with a small progress bar toward the next milestone. Resets when leaving the game; never saved.
- Out of scope: levels, move limits, timers, power-ups, squares/loops, special dots, losing.

## Game 1: animations, sounds and backgrounds

Every action gets a playful visual and audio response. Keep it smooth at 60fps on a mid-range phone, and respect `prefers-reduced-motion`.

**Characters**

- Each dot has two cartoon eyes. Pupils drift idly and look toward the finger while dragging. Eyes blink at random intervals. Dots in the current chain switch to happy "^ ^" eyes.

**Animations**

- **Select:** each dot added does a squash-and-stretch "boing" and gets a white outline.
- **Chain line:** thick rounded line in the chain colour, gently pulsing.
- **Pop:** dots grow and fade, bursting into confetti and stars in their colour, one after another along the chain.
- **Fall:** gravity easing with a small bounce and squash on landing.
- **Big chains:** 5+ dots shows "Great!", 8+ "Awesome!", 10+ "WOW!" as a big floating word, with a screen shake that grows with chain size.
- **Idle:** after ~4s without touch, random dots wiggle to invite play.
- **Shuffle:** dots spin and shrink away, then a new board drops in.
- **Score:** number bumps up each time it increases.

**Sounds (Web Audio, synthesised)**

- **Connect:** a note per dot added, rising up a pentatonic scale as the chain grows.
- **Backtrack:** the note steps back down.
- **Pop:** bubbly downward "bloop" per dot, pitch rising along the chain.
- **Land:** very soft tick (throttled).
- **Big chain:** short cheerful chord. **Milestone / game start:** short jingle. **Shuffle / exit:** soft swoosh.
- All sounds respect the mute toggle. Keep volumes gentle; nothing harsh.
- Short vibration on connect/pop via `navigator.vibrate` where supported; silently skip elsewhere.

**Background worlds**

- The game background is a full-screen gradient plus gently drifting shapes.
- Every **100 points**, crossfade to the next world, with a full-screen confetti celebration, the jingle, and the world's name as a floating word.
- Six worlds cycle: Sunny sky (clouds), Under the sea (rising bubbles), Outer space (twinkling stars), Candy land (floating hearts), Forest (falling leaves), Sunset (sparkles).
- Milestone interval and world list are constants that are easy to tweak.

## Architecture and file structure

Each game is a self-contained module registered with the shell, so adding a game means adding one folder and one registry entry.

```
/
├── index.html
├── manifest.json
├── sw.js              # service worker, precache list + version
├── css/
│   └── app.css        # shell styles, shared tokens
├── js/
│   ├── app.js         # view switching, exit button, history, mute, SW registration
│   ├── registry.js    # list of games: id, name, tile art, module path
│   └── audio.js       # shared Web Audio helpers (notes, pops, jingles)
├── games/
│   └── dots/
│       ├── dots.js    # game logic + rendering
│       ├── dots.css
│       └── themes.js  # background worlds + milestone constants
└── icons/             # app icons (generate simple PNGs from an SVG of the dot characters)
```

**Game module interface**

- `start(container, { audio, muted })` — build the game inside the given element and begin.
- `stop()` — remove listeners, timers, animation frames and DOM; leave nothing running.

**Implementation notes**

- Keep board state as a 2D array separate from rendering.
- Use Pointer Events with `touch-action: none` on the board, `setPointerCapture`, and coalesced events for fast drags.
- Start a chain from anywhere in a cell; add dots only when the finger is within a circle around the cell centre, so diagonal finger paths don't grab the wrong neighbour.
- Render the board on a `<canvas>` scaled for devicePixelRatio; use separate full-screen canvases for the background shapes and the confetti layer.
- Board size, colours, milestone interval and hold time are constants at the top of their files.

## Acceptance checklist

- [ ] Loads once online, then works fully in airplane mode (including after closing and reopening)
- [ ] Installs to the home screen on Android Chrome and iOS Safari and opens standalone in portrait
- [ ] Works when served from a subpath (GitHub Pages project site)
- [ ] DevTools Network tab shows zero requests after the first load
- [ ] No external links, ads, purchases or prompts anywhere
- [ ] Exit only works with a ~1s press-and-hold; Android back returns to the picker
- [ ] Dragging never scrolls, zooms or refreshes the page
- [ ] Only orthogonal same-colour dots can be chained; backtracking works
- [ ] 2+ dots pop, gravity and refill animate correctly, input is blocked during animation
- [ ] Board reshuffles when no pairs remain, and every new board has at least one pair
- [ ] Background world changes every 100 points with a celebration
- [ ] Sounds play, feel cheerful, and fully stop when muted
- [ ] Smooth on a mid-range phone; no leaks after entering and exiting the game repeatedly

## Deployment

Add a short README explaining how to run locally (any static server, e.g. `npx serve`) and how to publish with GitHub Pages (deploy from the `main` branch root).
