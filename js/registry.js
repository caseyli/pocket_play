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
];
