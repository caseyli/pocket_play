// Dot Diner: the items on the shelves, the meals, the kitchens and the tunable numbers.
// All art is inline SVG (viewBox 0 0 64 64), so there are no image files and it works offline.

// ---------- Tunables (tuned for 2-4 year olds) ----------
export const SHELF_SIZE = 8;          // items on the shelves for every order (needed + extras)
export const ORDERS_PER_KITCHEN = 10; // new kitchen after this many orders
export const HOP_S = 0.42;            // one hop of the cook (seconds)

// ---------- Items ----------
const S = (body) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
const shadow = '<ellipse cx="32" cy="58" rx="20" ry="3.5" fill="rgba(29,35,64,.12)"/>';

export const ITEMS = {
  // --- food ---
  bread: { name: 'Bread', svg: S(`${shadow}
    <path d="M13 30c-6-3-6-15 4-18 5-2 9 1 15 1s10-3 15-1c10 3 10 15 4 18v22a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z" fill="#d9964a"/>
    <path d="M18 31c-4-2-4-11 3-13 4-1 7 1 11 1s7-2 11-1c7 2 7 11 3 13v20H18z" fill="#ffe0a3"/>`) },
  peanutButter: { name: 'Peanut butter', svg: S(`${shadow}
    <rect x="15" y="9" width="34" height="10" rx="3" fill="#e05a3a"/>
    <rect x="12" y="17" width="40" height="39" rx="9" fill="#c98a4b"/>
    <rect x="12" y="27" width="40" height="17" fill="#fff3d6"/>
    <path d="M27 31a4 4 0 1 1 5 5 4 4 0 1 1-5-5z" fill="#c98a4b"/>`) },
  jam: { name: 'Jam', svg: S(`${shadow}
    <rect x="15" y="9" width="34" height="10" rx="3" fill="#fff"/>
    <path d="M15 12h34M15 16h34M21 9v10M27 9v10M33 9v10M39 9v10M45 9v10" stroke="#ff4d6d" stroke-width="2.4"/>
    <rect x="12" y="17" width="40" height="39" rx="9" fill="#b0254f"/>
    <rect x="12" y="28" width="40" height="15" fill="#fff"/>
    <path d="M32 31c3-3 8 0 5 5l-5 4-5-4c-3-5 2-8 5-5z" fill="#ff4d6d"/>`) },
  cheese: { name: 'Cheese', svg: S(`${shadow}
    <path d="M7 34 44 14l13 8v12z" fill="#ffd65c"/>
    <rect x="7" y="34" width="50" height="20" rx="2" fill="#f5b301"/>
    <circle cx="18" cy="43" r="4" fill="#e09c00"/><circle cx="34" cy="47" r="3" fill="#e09c00"/><circle cx="47" cy="41" r="3.5" fill="#e09c00"/>
    <circle cx="36" cy="25" r="2.5" fill="#f0bf2e"/>`) },
  butter: { name: 'Butter', svg: S(`${shadow}
    <ellipse cx="32" cy="48" rx="26" ry="8" fill="#cfdcf0"/><ellipse cx="32" cy="46" rx="22" ry="6" fill="#eef3fb"/>
    <path d="M16 30l20-8 14 6v12l-20 8-14-6z" fill="#ffe680"/>
    <path d="M16 30l20-8 14 6-20 8z" fill="#fff3b0"/>`) },
  cereal: { name: "O's", svg: S(`${shadow}
    <rect x="14" y="6" width="36" height="50" rx="4" fill="#ffcf4a"/>
    <rect x="14" y="6" width="36" height="9" rx="4" fill="#ff8c42"/>
    <ellipse cx="32" cy="42" rx="14" ry="7" fill="#fff"/>
    <g fill="none" stroke="#c98a4b" stroke-width="3.4"><circle cx="24" cy="26" r="3.6"/><circle cx="35" cy="23" r="3.6"/><circle cx="40" cy="32" r="3.6"/><circle cx="28" cy="36" r="3.6"/><circle cx="34" cy="40" r="3"/></g>`) },
  milk: { name: 'Milk', svg: S(`${shadow}
    <path d="M18 22 25 9h14l7 13v31a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3z" fill="#f3f7fd" stroke="#c5d3ea" stroke-width="2"/>
    <path d="M18 22h28L39 9H25z" fill="#cfe0ff"/>
    <rect x="18" y="30" width="28" height="14" fill="#3A86FF"/>
    <path d="M27 37a5 5 0 0 0 10 0c0-3-5-8-5-8s-5 5-5 8z" fill="#fff"/>`) },
  pancakes: { name: 'Pancakes', svg: S(`${shadow}
    <ellipse cx="32" cy="48" rx="24" ry="7" fill="#c9853d"/><ellipse cx="32" cy="45" rx="24" ry="7" fill="#eaa95c"/>
    <ellipse cx="32" cy="39" rx="23" ry="7" fill="#c9853d"/><ellipse cx="32" cy="36" rx="23" ry="7" fill="#f0b46a"/>
    <ellipse cx="32" cy="30" rx="22" ry="7" fill="#c9853d"/><ellipse cx="32" cy="27" rx="22" ry="7" fill="#f5c07a"/>
    <path d="M19 27c4 4 22 4 26 0v6c-2 0-2 4-4 4s-2-4-4-4H21c-2 0-2 3-2 0z" fill="#a8550f" opacity=".75"/>
    <rect x="27" y="20" width="10" height="6" rx="1.5" fill="#ffe680"/>`) },
  syrup: { name: 'Syrup', svg: S(`${shadow}
    <rect x="27" y="5" width="10" height="8" rx="2" fill="#e05a3a"/>
    <path d="M26 13h12v6c8 3 10 9 10 15v18a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V34c0-6 2-12 10-15z" fill="#c46a1a"/>
    <rect x="18" y="34" width="28" height="13" rx="2" fill="#fff3d6"/>
    <path d="M27 40c2-3 4-3 5 0 1-3 3-3 5 0" stroke="#c46a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`) },
  apple: { name: 'Apple', svg: S(`${shadow}
    <path d="M32 19c-6-4-20-3-20 14 0 12 8 23 14 23 3 0 4-2 6-2s3 2 6 2c6 0 14-11 14-23 0-17-14-18-20-14z" fill="#ff4d6d"/>
    <path d="M32 19c0-5 1-9 4-12" stroke="#7a4a2b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M35 13c4-6 12-5 13-3-3 5-9 6-13 3z" fill="#2EC27E"/>
    <ellipse cx="22" cy="29" rx="4" ry="6" fill="#fff" opacity=".35"/>`) },
  banana: { name: 'Banana', svg: S(`${shadow}
    <path d="M10 22c4 20 26 32 46 20-2 8-16 14-28 10S8 34 10 22z" fill="#f5b301"/>
    <path d="M10 22c4 18 24 28 44 18 0 0 2 1 2 2-20 12-42 0-46-20z" fill="#ffd65c"/>
    <path d="M8 21l3-4 2 5z" fill="#7a5a2b"/><circle cx="56" cy="42" r="2" fill="#7a5a2b"/>`) },
  strawberry: { name: 'Strawberry', svg: S(`${shadow}
    <path d="M32 56C20 50 10 38 12 28c2-8 12-9 20-6 8-3 18-2 20 6 2 10-8 22-20 28z" fill="#ff4d6d"/>
    <path d="M20 22c4-5 8-4 12-1 4-3 8-4 12 1-4 2-8 4-12 2-4 2-8 0-12-2z" fill="#2EC27E"/>
    <path d="M32 21v-7" stroke="#2EC27E" stroke-width="3" stroke-linecap="round"/>
    <g fill="#ffe680"><circle cx="24" cy="32" r="1.4"/><circle cx="32" cy="30" r="1.4"/><circle cx="40" cy="32" r="1.4"/><circle cx="27" cy="40" r="1.4"/><circle cx="37" cy="40" r="1.4"/><circle cx="32" cy="47" r="1.4"/></g>`) },
  cocoa: { name: 'Cocoa', svg: S(`${shadow}
    <rect x="14" y="10" width="36" height="8" rx="3" fill="#5a3420"/>
    <rect x="15" y="17" width="34" height="39" rx="5" fill="#7a4a2b"/>
    <rect x="15" y="26" width="34" height="20" fill="#f3d9b1"/>
    <path d="M25 31h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM37 33h2a2.5 2.5 0 0 1 0 5h-2" fill="#7a4a2b" stroke="#7a4a2b" stroke-width="1.5"/>`) },
  marshmallows: { name: 'Marshmallows', svg: S(`${shadow}
    <rect x="9" y="34" width="20" height="20" rx="6" fill="#ffffff" stroke="#e3e8f2" stroke-width="2"/>
    <rect x="34" y="34" width="20" height="20" rx="6" fill="#ffd3ea" stroke="#f5b8d6" stroke-width="2"/>
    <rect x="21" y="14" width="22" height="20" rx="6" fill="#ffffff" stroke="#e3e8f2" stroke-width="2"/>`) },
  pasta: { name: 'Spaghetti', svg: S(`${shadow}
    <g stroke="#f0c062" stroke-width="2.4" stroke-linecap="round"><path d="M18 56 40 8M22 56 44 8M26 56 48 9M14 55 36 8M30 56 50 12M12 52 31 10"/></g>
    <rect x="21" y="27" width="22" height="9" rx="3" transform="rotate(-24 32 31)" fill="#FF4D6D"/>`) },
  sauce: { name: 'Tomato sauce', svg: S(`${shadow}
    <rect x="17" y="8" width="30" height="9" rx="3" fill="#2EC27E"/>
    <rect x="13" y="16" width="38" height="40" rx="9" fill="#e8355a"/>
    <rect x="13" y="26" width="38" height="18" fill="#fff6e0"/>
    <circle cx="32" cy="36" r="6" fill="#ff4d6d"/><path d="M29 30l3 2 3-2" stroke="#2EC27E" stroke-width="2" fill="none" stroke-linecap="round"/>`) },
  iceCream: { name: 'Ice cream', svg: S(`${shadow}
    <circle cx="23" cy="24" r="9" fill="#ffd3ea"/><circle cx="41" cy="24" r="9" fill="#fff0c2"/><circle cx="32" cy="17" r="9" fill="#c99a6e"/>
    <path d="M12 26h40l-5 28a3 3 0 0 1-3 2H20a3 3 0 0 1-3-2z" fill="#ff9db0"/>
    <rect x="10" y="24" width="44" height="7" rx="3" fill="#ff4d6d"/>`) },
  sprinkles: { name: 'Sprinkles', svg: S(`${shadow}
    <rect x="18" y="8" width="28" height="10" rx="4" fill="#c7cde0"/>
    <g fill="#8a92ad"><circle cx="26" cy="12" r="1.3"/><circle cx="32" cy="12" r="1.3"/><circle cx="38" cy="12" r="1.3"/></g>
    <rect x="16" y="17" width="32" height="39" rx="7" fill="#ffffff" stroke="#e3e8f2" stroke-width="2"/>
    <g stroke-width="3" stroke-linecap="round"><path d="M22 27l4 2" stroke="#FF4D6D"/><path d="M35 25l-3 3" stroke="#3A86FF"/><path d="M41 33l2 4" stroke="#FFC93C"/><path d="M24 40l3-3" stroke="#2EC27E"/><path d="M34 44l4-1" stroke="#9D4EDD"/><path d="M27 49l3 2" stroke="#FFC93C"/><path d="M40 47l-2 3" stroke="#FF4D6D"/></g>`) },
  soup: { name: 'Soup', svg: S(`${shadow}
    <path d="M24 8c-3 4 3 6 0 10M32 6c-3 4 3 6 0 10M40 8c-3 4 3 6 0 10" stroke="#c5d3ea" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <rect x="4" y="27" width="10" height="6" rx="3" fill="#6f7894"/><rect x="50" y="27" width="10" height="6" rx="3" fill="#6f7894"/>
    <path d="M10 24h44v24a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill="#8a92ad"/>
    <ellipse cx="32" cy="24" rx="22" ry="5" fill="#ff8c42"/><ellipse cx="32" cy="24" rx="22" ry="5" fill="none" stroke="#6f7894" stroke-width="2.4"/>`) },
  cookies: { name: 'Cookies', svg: S(`${shadow}
    <circle cx="25" cy="38" r="16" fill="#d69a52"/><circle cx="41" cy="30" r="16" fill="#e8ad62"/>
    <g fill="#5a3420"><circle cx="36" cy="24" r="2.4"/><circle cx="46" cy="28" r="2.4"/><circle cx="40" cy="36" r="2.4"/><circle cx="47" cy="38" r="1.8"/><circle cx="18" cy="40" r="2.2"/><circle cx="24" cy="48" r="2.2"/></g>`) },
  // --- dishes ---
  plate: { name: 'Plate', svg: S(`${shadow}
    <ellipse cx="32" cy="42" rx="28" ry="13" fill="#cfe0ff"/><ellipse cx="32" cy="40" rx="27" ry="12" fill="#ffffff" stroke="#bcd0f2" stroke-width="2"/>
    <ellipse cx="32" cy="40" rx="17" ry="7" fill="#f2f6ff" stroke="#dbe6fb" stroke-width="2"/>`) },
  bowl: { name: 'Bowl', svg: S(`${shadow}
    <path d="M6 30h52c0 14-10 24-26 24S6 44 6 30z" fill="#ff8c42"/>
    <ellipse cx="32" cy="30" rx="26" ry="7" fill="#ffb37a"/><ellipse cx="32" cy="30" rx="21" ry="4.5" fill="#e0702a"/>
    <path d="M14 38c4 6 10 9 18 9" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".4"/>`) },
  mug: { name: 'Mug', svg: S(`${shadow}
    <path d="M44 24h5a9 9 0 0 1 0 18h-5" stroke="#9D4EDD" stroke-width="5" fill="none"/>
    <rect x="12" y="16" width="34" height="40" rx="7" fill="#9D4EDD"/>
    <ellipse cx="29" cy="17" rx="17" ry="3.5" fill="#c79bf0"/>
    <circle cx="29" cy="36" r="6" fill="#fff" opacity=".9"/><path d="M26 35l2 2 4-4" stroke="#9D4EDD" stroke-width="2" fill="none" stroke-linecap="round"/>`) },
  glass: { name: 'Glass', svg: S(`${shadow}
    <path d="M15 8h34l-4 44a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" fill="#d8efff" stroke="#9fd0f2" stroke-width="2.4"/>
    <path d="M21 14l2 34" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`) },
  pan: { name: 'Pan', svg: S(`${shadow}
    <rect x="40" y="30" width="22" height="7" rx="3.5" fill="#6b4428" transform="rotate(-12 40 33)"/>
    <ellipse cx="25" cy="38" rx="22" ry="13" fill="#3a3f5a"/><ellipse cx="25" cy="36" rx="18" ry="9" fill="#555b78"/>
    <ellipse cx="20" cy="33" rx="6" ry="2.5" fill="#fff" opacity=".18"/>`) },
  // --- cutlery ---
  knife: { name: 'Knife', svg: S(`${shadow}
    <path d="M30 6c8 6 9 18 6 26l-6 1z" fill="#d5dbe8" stroke="#a9b2c8" stroke-width="2"/>
    <rect x="27" y="32" width="10" height="24" rx="5" fill="#3A86FF"/>`) },
  spoon: { name: 'Spoon', svg: S(`${shadow}
    <ellipse cx="32" cy="17" rx="10" ry="12" fill="#d5dbe8" stroke="#a9b2c8" stroke-width="2"/>
    <rect x="28.5" y="27" width="7" height="29" rx="3.5" fill="#a9b2c8"/>`) },
  fork: { name: 'Fork', svg: S(`${shadow}
    <path d="M22 6v14a10 10 0 0 0 20 0V6" fill="none" stroke="#a9b2c8" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M29 6v14M35 6v14" stroke="#a9b2c8" stroke-width="3.4" stroke-linecap="round"/>
    <rect x="28.5" y="28" width="7" height="28" rx="3.5" fill="#a9b2c8"/>`) },
};

// ---------- Meals ----------
// `items` are what the cook has to fetch, in any order.
export const MEALS = [
  { name: 'Jam sandwich',     items: ['bread', 'peanutButter', 'jam', 'knife', 'plate'] },
  { name: "Bowl of O's",      items: ['bowl', 'cereal', 'milk', 'spoon'] },
  { name: 'Grilled cheese',   items: ['bread', 'cheese', 'butter', 'pan', 'plate'] },
  { name: 'Pancakes',         items: ['pancakes', 'syrup', 'plate', 'fork'] },
  { name: 'Apple slices',     items: ['apple', 'knife', 'plate'] },
  { name: 'Fruit salad',      items: ['bowl', 'banana', 'strawberry', 'spoon'] },
  { name: 'Hot chocolate',    items: ['mug', 'milk', 'cocoa', 'marshmallows'] },
  { name: 'Spaghetti',        items: ['pasta', 'sauce', 'bowl', 'fork'] },
  { name: 'Ice cream',        items: ['iceCream', 'sprinkles', 'bowl', 'spoon'] },
  { name: 'Soup',             items: ['soup', 'bowl', 'spoon'] },
  { name: 'Milk and cookies', items: ['cookies', 'milk', 'glass'] },
];

// ---------- Kitchens ----------
// Each is a set of CSS custom properties applied to the game's root element.
export const KITCHENS = [
  { label: 'Home kitchen!', vars: {
    '--wall': '#ffe7c2', '--wall-pattern': 'linear-gradient(rgba(255,255,255,.55) 2px, transparent 2px) 0 0/40px 40px, linear-gradient(90deg, rgba(255,255,255,.55) 2px, transparent 2px) 0 0/40px 40px',
    '--view': 'linear-gradient(#8fd3ff, #d7f1ff 68%, #9be08a 68%)', '--frame': '#ffffff', '--awning': '#FF4D6D',
    '--counter': '#c47f4b', '--counter-top': '#e8a46a', '--shelf': '#f3d3a2', '--plank': '#c47f4b', '--tray': '#ffffff' } },
  { label: 'Picnic time!', vars: {
    '--wall': '#bfe8ff', '--wall-pattern': 'radial-gradient(circle at 20% 30%, rgba(255,255,255,.9) 0 18px, transparent 19px), radial-gradient(circle at 75% 15%, rgba(255,255,255,.8) 0 14px, transparent 15px)',
    '--view': 'linear-gradient(#bfe9ff, #eaf8ff 60%, #8fd47a 60%)', '--frame': '#ffffff', '--awning': '#2EC27E',
    '--counter': 'repeating-linear-gradient(90deg, rgba(255,77,109,.5) 0 14px, transparent 14px 28px), repeating-linear-gradient(0deg, rgba(255,77,109,.5) 0 14px, #ffffff 14px 28px)',
    '--counter-top': '#ffffff', '--shelf': '#8fd47a', '--plank': '#c98a4b', '--tray': '#fff6d8' } },
  { label: 'Beach cafe!', vars: {
    '--wall': '#c6f1f3', '--wall-pattern': 'linear-gradient(90deg, rgba(255,255,255,.55) 2px, transparent 2px) 0 0/30px 30px',
    '--view': 'linear-gradient(#6fd0ff 0 48%, #2fb3e0 48% 74%, #f6dc9b 74%)', '--frame': '#ffffff', '--awning': '#3A86FF',
    '--counter': '#e8c27a', '--counter-top': '#f6dc9b', '--shelf': '#f6e3b4', '--plank': '#d9a85a', '--tray': '#ffffff' } },
  { label: 'Snowy cabin!', vars: {
    '--wall': '#9b6a43', '--wall-pattern': 'linear-gradient(rgba(0,0,0,.12) 2px, transparent 2px) 0 0/100% 28px',
    '--view': 'linear-gradient(#b8d4f2, #e8f2ff 62%, #ffffff 62%)', '--frame': '#6b4428', '--awning': '#9D4EDD',
    '--counter': '#6b4428', '--counter-top': '#8a5b37', '--shelf': '#c9a27a', '--plank': '#6b4428', '--tray': '#fff6e8' }, snow: true },
];
