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

export const GAMES = [
  {
    id: 'dots',
    name: 'Dot Pop',
    art: dotsArt,
    module: new URL('../games/dots/dots.js', import.meta.url).href,
    styles: new URL('../games/dots/dots.css', import.meta.url).href,
  },
];
