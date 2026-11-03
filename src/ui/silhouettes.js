// Hand-authored, original comic silhouettes for the cut-ins (1-MORE, ALL-OUT panels, deploy cards)
// and the leader hero art on the "THE SHOW'S OVER" splash.
//
// Style rules: hard angular manga shapes, solid ink fill, NO facial features. The only accents are
// glowing gear (mask eye-slit, visor, holo glasses), a white offset rim light, and a halftone shading
// layer clipped to the silhouette. Everything is plain SVG, turned into data-URLs so the same art
// works in <img>, CSS and canvas (the All-Out shatter draws it into a snapshot).

const P = (pts) => pts.map((p) => p.join(',')).join(' ');
const poly = (pts, attrs = '') => `<polygon points="${P(pts)}" ${attrs}/>`;

// deterministic pseudo-random for particles
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Compose a silhouette: `shapes` (array of point lists) forms the ink body. A white copy offset by
 * `rim` reads as a hard rim light; a halftone pattern (clipped to the body) shades the shadow side;
 * diagonal white hatch strokes catch the lit side; `fx` is extra markup drawn on top (gear glows).
 */
function compose({ w, h, shapes, rim = [6, -4], shade = 'left', hatch = [], fx = '', under = '' }) {
  const body = shapes.map((s) => poly(s)).join('');
  const shadeRect = shade === 'left'
    ? `<polygon points="0,${h * 0.25} ${w * 0.55},${h} 0,${h}"/>`
    : `<polygon points="${w},${h * 0.2} ${w * 0.45},${h} ${w},${h}"/>`;
  const hatchLines = hatch.map(([x1, y1, x2, y2, sw = 3]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${sw}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
  <pattern id="ht" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="4.5" cy="4.5" r="2.6" fill="#e8002d"/></pattern>
  <pattern id="ht2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3.5" cy="3.5" r="1.4" fill="#fff" fill-opacity=".55"/></pattern>
  <clipPath id="body">${body}</clipPath>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
${under}
<g fill="#fff" transform="translate(${rim[0]},${rim[1]})">${body}</g>
<g fill="#050505">${body}</g>
<g clip-path="url(#body)">
  <g fill="url(#ht)" opacity=".75">${shadeRect}</g>
  <g stroke="#fff" stroke-linecap="square" opacity=".9">${hatchLines}</g>
</g>
${fx}
</svg>`;
}

// ------------------------------------------------------------------------------------- JESTER
// Side profile facing right: tousled razor locks, popped trench collar, angular masquerade mask with
// a crimson eye-slit, forearm up holding a slim dagger.
function jester() {
  const coat = [[30, 400], [58, 318], [96, 268], [150, 240], [232, 238], [262, 252], [252, 300], [262, 400]];
  const collarBack = [[112, 270], [96, 150], [126, 182], [150, 214], [172, 246]];
  const collarFront = [[214, 252], [236, 168], [252, 196], [246, 252]];
  const neck = [[168, 244], [176, 186], [214, 186], [222, 244]];
  const head = [[150, 126], [170, 84], [214, 70], [248, 86], [262, 112], [264, 124], [282, 142], [266, 150], [270, 162], [260, 168], [262, 180], [244, 196], [214, 200], [186, 192], [160, 166]];
  // long razor locks swept back by the wind (tips all lean back/up, fringe falls over the mask)
  const hair = [
    [264, 116], [298, 150], [260, 100], [276, 58], [250, 82], [228, 30], [214, 64], [178, 24], [178, 64], [124, 40], [156, 82],
    [84, 70], [140, 104], [62, 112], [136, 128], [70, 156], [142, 152], [96, 194], [150, 172], [140, 210], [166, 188], [190, 140], [236, 108],
  ];
  const arm = [[214, 300], [262, 268], [306, 330], [330, 250], [356, 254], [330, 360], [292, 372], [226, 336]];
  const glove = [[322, 258], [326, 224], [344, 204], [366, 212], [370, 240], [356, 262]];
  const mask = [[204, 112], [270, 104], [290, 120], [270, 136], [242, 134], [224, 142], [206, 132]];
  const slit = [[232, 122], [272, 114], [262, 126], [236, 128]];
  const blade = [[350, 214], [398, 96], [368, 222]];
  const fx = `
  ${poly(mask, 'fill="#16161c" stroke="#fff" stroke-width="3" stroke-linejoin="miter"')}
  ${poly(slit, 'fill="#ff1a3d" filter="url(#glow)"')}
  ${poly(blade, 'fill="#f4f4f8" stroke="#050505" stroke-width="3"')}
  <polygon points="356,206 396,104 364,212" fill="#9aa0b8"/>
  <line x1="340" y1="230" x2="372" y2="214" stroke="#050505" stroke-width="8"/>
  <polygon points="346,226 352,240 380,226 376,216" fill="#e8002d"/>`;
  return compose({
    w: 400, h: 400,
    shapes: [coat, collarBack, collarFront, neck, head, hair, arm, glove],
    rim: [7, -5],
    hatch: [[230, 250, 262, 300, 4], [246, 246, 262, 270, 3], [236, 80, 258, 96, 3], [300, 280, 316, 254, 3]],
    fx,
  });
}

// -------------------------------------------------------------------------------------- QUEEN
// Aggressive 3/4 stance: helmet with a sleek visor (twin red glows), spiked rider pauldrons, and a
// huge foreshortened fist with knuckle dusters thrown at the viewer.
function queen() {
  const torso = [[86, 400], [104, 306], [150, 262], [250, 262], [292, 304], [300, 400]];
  const neck = [[166, 270], [170, 200], [232, 200], [238, 270]];
  const helmet = [[146, 182], [142, 132], [164, 96], [206, 80], [246, 94], [262, 132], [258, 180], [236, 206], [176, 208]];
  const hair = [[152, 170], [96, 214], [140, 204], [86, 256], [146, 226], [120, 280], [176, 214]];
  const padL = [[70, 306], [84, 258], [130, 232], [178, 248], [168, 296]];
  const padR = [[222, 248], [266, 232], [310, 254], [322, 306], [236, 296]];
  const spikes = [
    [[92, 262], [44, 212], [114, 246]], [[122, 240], [104, 180], [146, 236]], [[152, 240], [168, 192], [170, 248]],
    [[248, 240], [238, 186], [270, 236]], [[280, 240], [312, 190], [298, 250]], [[302, 258], [358, 222], [314, 272]],
  ];
  const forearm = [[244, 400], [270, 330], [330, 316], [338, 400]];
  const fist = [[262, 336], [276, 292], [334, 270], [378, 282], [394, 320], [380, 356], [330, 372], [282, 366]];
  const visor = [[154, 136], [254, 126], [260, 158], [210, 174], [156, 166]];
  const fx = `
  ${poly(visor, 'fill="#20232e" stroke="#fff" stroke-width="3"')}
  <polygon points="160,140 252,130 254,138 162,148" fill="#fff" opacity=".35"/>
  ${poly([[172, 154], [202, 148], [198, 158], [174, 160]], 'fill="#ff1a3d" filter="url(#glow)"')}
  ${poly([[214, 146], [244, 140], [240, 152], [216, 156]], 'fill="#ff1a3d" filter="url(#glow)"')}
  <polygon points="284,296 340,276 384,288 386,300 340,290 288,310" fill="#d6d9e6" stroke="#050505" stroke-width="3"/>
  <g fill="#d6d9e6" stroke="#050505" stroke-width="2.5">
    <circle cx="300" cy="300" r="7"/><circle cx="323" cy="291" r="7"/><circle cx="346" cy="285" r="7"/><circle cx="369" cy="289" r="7"/>
  </g>
  <g stroke="#ff1a3d" stroke-width="5" stroke-linecap="square" filter="url(#glow)" opacity=".95">
    <line x1="392" y1="262" x2="400" y2="240"/><line x1="396" y1="300" x2="400" y2="298"/><line x1="350" y1="262" x2="360" y2="232"/><line x1="312" y1="268" x2="306" y2="240"/>
  </g>`;
  return compose({
    w: 400, h: 400,
    shapes: [torso, neck, hair, helmet, padL, padR, ...spikes, forearm, fist],
    rim: [-7, -5],
    shade: 'right',
    hatch: [[100, 300, 128, 262, 4], [112, 330, 140, 286, 3], [150, 100, 170, 84, 3], [272, 340, 290, 300, 3]],
    fx,
  });
}

// ------------------------------------------------------------------------------------- ORACLE
// Cyber navigator: a long angular mane whipping back, chunky headphones, holo visor glasses with a
// projected wireframe pane, and a matrix of digital particles around the head.
function oracle() {
  const body = [[70, 400], [88, 316], [140, 262], [236, 262], [292, 310], [312, 400]];
  const hood = [[120, 286], [130, 236], [176, 222], [240, 226], [272, 270], [228, 262], [160, 266]];
  const head = [[150, 160], [158, 116], [196, 90], [240, 98], [262, 134], [258, 176], [236, 204], [190, 210], [160, 194]];
  const mane = [
    [200, 84], [150, 86], [104, 122], [80, 180], [56, 250], [18, 330], [6, 400], [70, 400], [66, 360], [96, 380], [92, 312],
    [128, 350], [120, 284], [148, 318], [140, 250], [164, 226], [158, 190], [176, 140], [222, 112], [264, 122], [318, 112], [272, 100], [336, 70], [262, 80], [292, 40], [236, 66], [214, 30], [196, 70],
  ];
  const phones = [[150, 140], [180, 136], [186, 196], [154, 200], [142, 172]];
  const r = rng(7);
  let particles = '';
  for (let i = 0; i < 46; i++) {
    const a = -Math.PI * 0.95 + r() * Math.PI * 1.25;
    const d = 90 + r() * 110;
    const x = 205 + Math.cos(a) * d;
    const y = 150 + Math.sin(a) * d * 0.8;
    if (y > 250 || x < 0 || x > 400 || y < 0) continue;
    const s = 3 + r() * 9;
    particles += r() < 0.3
      ? `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${(s * 1.8).toFixed(1)}" font-family="Courier New,monospace" font-weight="700">${r() < 0.5 ? '0' : '1'}</text>`
      : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill-opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }
  const fx = `
  ${poly(phones, 'fill="#050505" stroke="#39ff88" stroke-width="3"')}
  <g fill="#39ff88" filter="url(#glow)">
    ${poly([[178, 128], [266, 120], [270, 144], [182, 152]], 'fill-opacity=".85"')}
  </g>
  <g stroke="#050505" stroke-width="2" opacity=".55"><line x1="184" y1="134" x2="266" y2="127"/><line x1="185" y1="140" x2="267" y2="133"/><line x1="186" y1="146" x2="268" y2="139"/></g>
  <g fill="none" stroke="#39ff88" stroke-width="2" filter="url(#glow)">
    <polygon points="282,88 372,70 372,148 282,158"/>
    <polyline points="290,130 312,112 328,124 350,96 366,104"/>
    <line x1="268" y1="122" x2="282" y2="88"/><line x1="270" y1="144" x2="282" y2="158"/>
  </g>
  <g fill="#39ff88" filter="url(#glow)">${particles}</g>
  <g stroke="#39ff88" stroke-width="1.5" opacity=".7" fill="none"><polyline points="60,120 90,120 104,104 140,104"/><polyline points="330,190 360,190 372,206 400,206"/><polyline points="96,60 120,60 132,46"/></g>`;
  return compose({
    w: 400, h: 400,
    shapes: [body, hood, mane, head],
    rim: [6, -5],
    hatch: [[236, 270, 272, 320, 4], [250, 120, 262, 150, 3], [60, 280, 80, 230, 3]],
    fx,
  });
}

// ------------------------------------------------------------------------------------- PROMPTER
// The cat in the prompt box: a small sitting cat, ears up, a script scroll under one paw, a gold
// bow at the throat and two glowing eye-slits (no other facial features), tail curling up.
function prompter() {
  const body = [[96, 400], [110, 322], [148, 270], [214, 262], [262, 290], [286, 350], [292, 400]];
  const head = [[128, 214], [132, 168], [118, 98], [166, 140], [210, 138], [252, 92], [252, 168], [262, 210], [240, 250], [190, 262], [146, 250]];
  const tail = [[284, 380], [334, 352], [356, 290], [340, 232], [366, 214], [380, 290], [358, 366], [300, 400]];
  const paw = [[150, 400], [156, 352], [196, 344], [204, 400]];
  const fx = `
  <g fill="#ffd400" filter="url(#glow)">
    <polygon points="150,192 184,184 180,198 154,202"/><polygon points="206,184 240,192 236,202 210,198"/>
  </g>
  <g fill="#ffd400" stroke="#050505" stroke-width="3">
    <polygon points="170,258 196,268 170,282"/><polygon points="222,258 196,268 222,282"/><circle cx="196" cy="268" r="7"/>
  </g>
  <g>
    <rect x="198" y="330" width="92" height="40" rx="18" fill="#f4f0e6" stroke="#050505" stroke-width="4" transform="rotate(-14 244 350)"/>
    <g stroke="#050505" stroke-width="2" opacity=".6" transform="rotate(-14 244 350)"><line x1="214" y1="342" x2="276" y2="342"/><line x1="214" y1="350" x2="270" y2="350"/><line x1="214" y1="358" x2="262" y2="358"/></g>
  </g>`;
  return compose({
    w: 400, h: 400,
    shapes: [tail, body, head, paw],
    rim: [6, -4],
    hatch: [[118, 110, 140, 150, 3], [248, 100, 246, 150, 3], [270, 300, 284, 350, 4]],
    fx,
  });
}

// ------------------------------------------------------------------------------------- LIMELIGHT
// Pyrotechnic star: twin tails whipping up like flames, a long stage coat, one arm thrown up with a
// fire orb in the palm, and sparks rising around her.
function limelight() {
  const coat = [[64, 400], [92, 318], [146, 266], [236, 262], [286, 300], [312, 400]];
  const head = [[150, 170], [156, 124], [192, 100], [234, 108], [256, 142], [252, 184], [230, 210], [188, 214], [160, 198]];
  const tailL = [[160, 130], [110, 110], [60, 150], [30, 220], [40, 290], [70, 240], [86, 200], [120, 170]];
  const tailR = [[240, 116], [290, 90], [340, 118], [362, 190], [340, 260], [326, 200], [300, 160], [256, 140]];
  const arm = [[250, 280], [286, 268], [330, 170], [352, 120], [330, 108], [300, 160], [256, 240]];
  const r = rng(11);
  let sparks = '';
  for (let i = 0; i < 26; i++) {
    const x = 220 + r() * 170;
    const y = 10 + r() * 150;
    sparks += `<polygon points="${x},${y} ${x + 3},${y + 9} ${x - 3},${y + 9}" fill="${r() < 0.5 ? '#ffd400' : '#ff6a1a'}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  const fx = `
  <g filter="url(#glow)">
    <path d="M340,104 C312,80 336,52 330,20 C356,44 380,64 366,100 C360,116 346,118 340,104 z" fill="#ff6a1a"/>
    <circle cx="342" cy="100" r="16" fill="#ffd400"/>
  </g>
  <g fill="#ff6a1a" filter="url(#glow)"><polygon points="176,150 212,146 210,158 178,160"/></g>
  ${sparks}`;
  return compose({
    w: 400, h: 400,
    shapes: [tailL, tailR, coat, head, arm],
    rim: [-6, -5],
    shade: 'right',
    hatch: [[100, 320, 130, 280, 4], [270, 290, 300, 330, 3], [60, 240, 80, 200, 3]],
    fx,
  });
}

// ------------------------------------------------------------------------------------- LEADER
// Splash hero, full body in a 3/4 back view: hair whipping, collar popped, coat tails torn back by
// the wind, both hands up at the chest pulling a crimson glove tight.
function leader() {
  const W = 600;
  const H = 900;
  const legs = [
    [[244, 600], [308, 600], [282, 858], [296, 882], [200, 892], [214, 870], [236, 858]],
    [[304, 600], [364, 600], [392, 854], [418, 882], [330, 888], [342, 858]],
  ];
  const coat = [[180, 280], [214, 250], [300, 240], [400, 256], [428, 300], [418, 420], [392, 480], [402, 600], [396, 654], [340, 622], [300, 662], [250, 640], [220, 520], [196, 430], [176, 360]];
  const tails = [[214, 430], [150, 520], [60, 610], [-20, 684], [72, 690], [8, 772], [120, 730], [88, 846], [190, 742], [222, 794], [262, 682], [300, 652], [330, 622], [392, 560], [392, 470]];
  const collarL = [[214, 264], [186, 146], [238, 200], [264, 250]];
  const collarR = [[350, 252], [382, 150], [398, 214], [398, 274]];
  const neck = [[262, 254], [268, 200], [332, 200], [340, 254]];
  const head = [[244, 170], [248, 118], [284, 92], [330, 98], [358, 128], [364, 160], [358, 190], [340, 210], [300, 222], [262, 210]];
  const hair = [
    [352, 140], [390, 172], [360, 120], [394, 98], [348, 104], [352, 50], [318, 86], [292, 30], [290, 84], [234, 44], [262, 100],
    [190, 82], [246, 126], [170, 128], [240, 150], [176, 178], [244, 176], [204, 218], [256, 196], [262, 224], [300, 160], [340, 150],
  ];
  const armR = [[396, 262], [428, 282], [494, 372], [470, 406], [400, 340]];
  const forearmR = [[464, 374], [494, 394], [458, 262], [426, 262]];
  const armL = [[184, 290], [214, 300], [216, 410], [180, 422], [164, 350]];
  const gloves = `
    ${poly([[420, 270], [408, 214], [414, 170], [426, 168], [430, 200], [434, 148], [446, 148], [446, 196], [456, 154], [467, 158], [460, 206], [472, 188], [482, 194], [466, 264]], 'fill="#e8002d" stroke="#050505" stroke-width="5" stroke-linejoin="miter"')}
    ${poly([[414, 262], [468, 256], [474, 280], [416, 288]], 'fill="#a80020" stroke="#050505" stroke-width="4"')}
    ${poly([[368, 278], [420, 262], [446, 276], [434, 304], [384, 308]], 'fill="#e8002d" stroke="#050505" stroke-width="5"')}
    <polygon points="436,156 444,156 442,196 436,200" fill="#fff" opacity=".75"/>
    <polygon points="388,282 424,272 428,280 392,292" fill="#ff6a7a"/>`;
  const hatch = [
    [404, 300, 418, 400, 5], [384, 420, 396, 470, 5], [382, 520, 396, 640, 4], [330, 108, 356, 132, 4], [330, 640, 350, 860, 4], [440, 300, 484, 372, 4], [458, 290, 474, 268, 3],
  ];
  const fx = `${gloves}
  <g stroke="#fff" stroke-width="3" opacity=".9">
    <line x1="60" y1="690" x2="10" y2="712"/><line x1="40" y1="780" x2="-10" y2="800"/><line x1="120" y1="560" x2="40" y2="600"/>
  </g>`;
  return compose({
    w: W, h: H,
    shapes: [...legs, tails, coat, collarL, collarR, neck, head, hair, armR, armL, forearmR],
    rim: [9, -6],
    hatch,
    fx,
  });
}

const BUILD = { jester, queen, oracle, prompter, limelight, leader };
const cache = {};

/** data: URL for the silhouette of `id` (a unit id or 'leader'). */
export function silhouetteURL(id) {
  if (!cache[id]) cache[id] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(BUILD[id]())}`;
  return cache[id];
}

/** Raw SVG markup (used by the preview script). */
export function silhouetteSVG(id) {
  return BUILD[id]();
}
