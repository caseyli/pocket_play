// The list of games shown in the picker.
// To add a game: create games/<id>/ with a module exporting start(container, opts) and stop(),
// then add an entry here (and add its files to the precache list in sw.js).

const eye = (cx, cy) =>
  `<circle cx="${cx - 5}" cy="${cy - 3}" r="4" fill="#fff"/><circle cx="${cx + 5}" cy="${cy - 3}" r="4" fill="#fff"/>` +
  `<circle cx="${cx - 4}" cy="${cy - 2}" r="2" fill="#1d2340"/><circle cx="${cx + 6}" cy="${cy - 2}" r="2" fill="#1d2340"/>`;
const dot = (cx, cy, fill) => `<circle cx="${cx}" cy="${cy}" r="15" fill="${fill}"/>${eye(cx, cy)}`;

const dotsArt = `
<svg viewBox="0 0 120 100" aria-hidden="true">
  <path d="M30 70 L60 70 L60 40" stroke="#3A86FF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <g class="bob">${dot(30, 70, '#3A86FF')}</g>
  <g class="bob">${dot(60, 70, '#3A86FF')}</g>
  <g class="bob">${dot(60, 40, '#3A86FF')}</g>
  <g class="bob">${dot(92, 40, '#FF4D6D')}</g>
  ${dot(92, 72, '#FFC93C')}
  ${dot(30, 40, '#2EC27E')}
</svg>`;

const kartArt = `
<svg viewBox="0 0 120 100" aria-hidden="true">
  <rect x="99" y="10" width="17" height="46" rx="7" fill="#2b2f45"/>
  <circle cx="107.5" cy="20" r="5" fill="#5a5f78"/><circle cx="107.5" cy="33" r="5" fill="#5a5f78"/>
  <circle cx="107.5" cy="46" r="5.5" fill="#2EC27E"/>
  <path d="M8 62h14M4 72h16M10 82h12" stroke="#b9d4ee" stroke-width="4" stroke-linecap="round"/>
  <g class="bob">
    <rect x="27" y="68" width="15" height="21" rx="5" fill="#2b2f45"/><rect x="78" y="68" width="15" height="21" rx="5" fill="#2b2f45"/>
    <rect x="33" y="57" width="54" height="26" rx="9" fill="#FF4D6D"/>
    <rect x="35" y="51" width="50" height="6" rx="3" fill="#C9184A"/>
    <rect x="30" y="78" width="60" height="7" rx="3.5" fill="#3a3f5a"/>
    <circle cx="44" cy="70" r="3.5" fill="#ff3b3b"/><circle cx="76" cy="70" r="3.5" fill="#ff3b3b"/>
    <circle cx="60" cy="34" r="17" fill="#FF4D6D"/>
    <circle cx="54" cy="31" r="4.5" fill="#fff"/><circle cx="66" cy="31" r="4.5" fill="#fff"/>
    <circle cx="54" cy="29" r="2.3" fill="#1d2340"/><circle cx="66" cy="29" r="2.3" fill="#1d2340"/>
  </g>
</svg>`;

const dinerArt = `
<svg viewBox="0 0 120 100" aria-hidden="true">
  <rect x="4" y="74" width="112" height="10" rx="5" fill="#e8a46a"/>
  <ellipse cx="82" cy="72" rx="28" ry="8" fill="#cfe0ff"/><ellipse cx="82" cy="70" rx="26" ry="7" fill="#fff"/>
  <path d="M64 66c-3-2-3-8 2-9 3-1 5 0 8 0s5-1 8 0c5 1 5 7 2 9v3H64z" fill="#d9964a"/>
  <path d="M66 62h20v5H66z" fill="#b0254f"/>
  <path d="M64 58c-3-2-3-8 2-9 3-1 5 0 8 0s5-1 8 0c5 1 5 7 2 9v4H64z" fill="#ffe0a3"/>
  <g class="bob">
    <circle cx="34" cy="56" r="17" fill="#2EC27E"/>
    <circle cx="28" cy="53" r="4.5" fill="#fff"/><circle cx="40" cy="53" r="4.5" fill="#fff"/>
    <circle cx="29" cy="54" r="2.3" fill="#1d2340"/><circle cx="41" cy="54" r="2.3" fill="#1d2340"/>
    <path d="M29 62a6 6 0 0 0 10 0" stroke="#1d2340" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="34" r="6.5" fill="#fff"/><circle cx="40" cy="34" r="6.5" fill="#fff"/><circle cx="34" cy="30" r="7.5" fill="#fff"/>
    <rect x="23" y="34" width="22" height="7" rx="2.5" fill="#e4e9f3"/>
  </g>
  <path d="M104 22l2.4 5 5.4.6-4 3.7 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.7 5.4-.6z" fill="#FFC93C"/>
</svg>`;

export const GAMES = [
  {
    id: 'dots',
    name: 'Dot Pop',
    art: dotsArt,
    module: new URL('../games/dots/dots.js', import.meta.url).href,
    styles: new URL('../games/dots/dots.css', import.meta.url).href,
  },
  {
    id: 'kart',
    name: 'Dot Dash',
    art: kartArt,
    module: new URL('../games/kart/kart.js', import.meta.url).href,
    styles: new URL('../games/kart/kart.css', import.meta.url).href,
  },
  {
    id: 'diner',
    name: 'Dot Diner',
    art: dinerArt,
    module: new URL('../games/diner/diner.js', import.meta.url).href,
    styles: new URL('../games/diner/diner.css', import.meta.url).href,
  },
];
