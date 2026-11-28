// Dot Golf: scoring rings, flick tuning and the courses. Distances are in metres.

// ---------- Target ----------
export const HOLE_R = 0.6;            // the ball drops in if it rolls this close (generous for small hands)
export const HOLE_POINTS = 150;
// Rings from the middle out: [outer radius, points]. 100 down to 50 in tens.
export const RINGS = [[1.6, 100], [2.9, 90], [4.2, 80], [5.5, 70], [6.8, 60], [8.1, 50]];
export const PIN_DIST = [14, 26];     // the flag is placed this far ahead...
export const PIN_SIDE = 5;            // ...and up to this far left or right
export const POINTS_PER_COURSE = 500; // new course every 500 points

// ---------- Flick ----------
export const FLICK_MIN = 0.35;        // slowest flick that counts, in screen-heights per second
export const FLICK_MAX = 3.2;         // flicks faster than this all go the maximum distance
export const SHOT_MIN = 6;            // distance of the gentlest flick
export const SHOT_MAX = 34;           // distance of the hardest flick
export const AIM_MAX = 0.55;          // widest sideways angle (radians)
export const ASSIST_AIM = 0.55;       // how much each shot is nudged toward the flag: 0 = none, 1 = always straight at it
export const ASSIST_POWER = 0.55;     // ...and toward the right distance
export const LAUNCH_ANGLE = 0.72;     // radians (about 41 degrees) up from the ground
export const GRAVITY = 9.8;
export const BOUNCE = 0.34;           // how much height a bounce keeps
export const ROLL_FRICTION = 5;       // m/s^2 slow-down while rolling

// ---------- Courses ----------
// kinds: scenery around the edge of the green (shared scenery in js/scenery.js).
export const COURSES = [
  { label: 'Sunny park!', sky: ['#7cc8ff', '#d2efff'], hills: '#8fd47a', hillsFar: '#b6e3a3',
    stripes: ['#7fd065', '#73c45a'], rough: '#5aa84a', ring: '#ffffff', accent: '#FF4D6D', kinds: ['tree', 'bush', 'tree'] },
  { label: 'Seaside!', sky: ['#5fc3f2', '#c8f0ff'], hills: '#3fb6e0', hillsFar: '#8ad8f2', sea: true,
    stripes: ['#9bd67a', '#8fcb6c'], rough: '#c9d98a', ring: '#ffffff', accent: '#3A86FF', kinds: ['palm', 'umbrella', 'palm'] },
  { label: 'Autumn hills!', sky: ['#ffc98f', '#fff0dc'], hills: '#d9a35a', hillsFar: '#ecc98f',
    stripes: ['#a8c95a', '#9dbd4f'], rough: '#b98a4b', ring: '#fff8e8', accent: '#9D4EDD', kinds: ['autumnTree', 'bush', 'autumnTree'] },
  { label: 'Starry night!', sky: ['#1a1b4b', '#3b3a8c'], hills: '#2b2c6e', hillsFar: '#38397f', stars: true, night: true,
    stripes: ['#3c8a5c', '#357f53'], rough: '#2a6243', ring: '#e9e3ff', accent: '#FFC93C', kinds: ['lamp', 'bush', 'lamp'] },
];
