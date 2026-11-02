// Playable Phantom Thieves. All stats and skills here are original to this fan project.
// Range offsets are authored facing RIGHT as [forward, side] tiles and rotated on deploy.
const rect = (x0, x1, y0, y1) => {
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
  return out;
};

export const ELEMENTS = {
  phys: { label: 'Phys', color: '#d8d8d8' },
  gun: { label: 'Gun', color: '#f0c850' },
  fire: { label: 'Fire', color: '#ff5a2a' },
  ice: { label: 'Ice', color: '#7fe3ff' },
  elec: { label: 'Elec', color: '#ffe933' },
  wind: { label: 'Wind', color: '#6dff9c' },
  psy: { label: 'Psy', color: '#ff7bf0' },
  nuke: { label: 'Nuke', color: '#a6ff3d' },
  bless: { label: 'Bless', color: '#fff3a6' },
  curse: { label: 'Curse', color: '#e0103f' },
};
export const MAGIC_ELEMENTS = new Set(['fire', 'ice', 'elec', 'wind', 'psy', 'nuke', 'bless', 'curse']);

export const CLASSES = {
  vanguard: { label: 'Vanguard', melee: true, desc: 'Cheap frontliner. Generates DP.' },
  guard: { label: 'Guard', melee: true, desc: 'Heavy melee damage.' },
  defender: { label: 'Defender', melee: true, desc: 'Tanky wall that blocks many enemies.' },
  caster: { label: 'Caster', melee: false, desc: 'Magic damage, ignores armor.' },
  sniper: { label: 'Sniper', melee: false, desc: 'Fast, long-range physical fire.' },
  artillery: { label: 'Artillery', melee: false, desc: 'Slow, devastating area blasts.' },
  medic: { label: 'Medic', melee: false, desc: 'Heals allies instead of attacking.' },
  support: { label: 'Support', melee: false, desc: 'Weakens enemies and boosts the team.' },
};

export const OPERATORS = {
  joker: {
    id: 'joker', name: 'Joker', title: 'The Wild Card', class: 'vanguard', element: 'phys',
    persona: 'arsene', personaName: 'Arsène', color: '#e8002d',
    hp: 1750, atk: 470, def: 160, res: 0, interval: 1.05, range: rect(0, 1, 0, 0), block: 2, cost: 11, redeploy: 20,
    passive: { name: 'Wild Card', desc: 'Gains 1 DP whenever he defeats an Echo.' },
    skill: {
      id: 'arsene_eiha', name: 'Arsène · Eiha Rebellion', spType: 'auto', spCost: 22, initSp: 8, duration: 0, needsTarget: true,
      desc: 'Arsène erupts and shreds every Echo near Joker for 260% Curse damage, then grants 8 DP.',
    },
    unlock: null,
    bio: 'Returned to Tokyo for the summer. Calm on the surface, always three moves ahead.',
  },
  skull: {
    id: 'skull', name: 'Skull', title: 'The Thunderclap', class: 'guard', element: 'phys',
    persona: 'kidd', personaName: 'Captain Kidd', color: '#f2c200',
    hp: 2100, atk: 640, def: 180, res: 0, interval: 1.25, range: rect(0, 1, 0, 0), block: 2, cost: 15, redeploy: 25,
    passive: { name: 'Never Backs Down', desc: 'Skill SP is gained by attacking.' },
    skill: {
      id: 'kidd_thunder', name: 'Captain Kidd · Thunder Reign', spType: 'attack', spCost: 8, initSp: 3, duration: 10, needsTarget: true,
      desc: 'Lightning rains on 3 Echoes. For 10s ATK +45% and attacks chain Elec damage to 2 more targets.',
    },
    unlock: null,
    bio: 'Loud, loyal and impossible to knock down for long.',
  },
  panther: {
    id: 'panther', name: 'Panther', title: 'The Crimson Blossom', class: 'caster', element: 'fire',
    persona: 'carmen', personaName: 'Carmen', color: '#ff2e63',
    hp: 1150, atk: 780, def: 60, res: 15, interval: 1.9, range: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [1, -1], [2, -1]], block: 0, cost: 17, redeploy: 40,
    passive: { name: 'Fire Dance', desc: 'Fire attacks exploit Echo weaknesses easily.' },
    skill: {
      id: 'carmen_agneyastra', name: 'Carmen · Agneyastra', spType: 'auto', spCost: 30, initSp: 14, duration: 0, needsTarget: true,
      desc: 'A pillar of fire engulfs the densest cluster: 330% Fire damage in an area plus Burn for 5s.',
    },
    unlock: null,
    bio: 'Runway-ready and ruthless. Her flames never miss a weakness.',
  },
  mona: {
    id: 'mona', name: 'Mona', title: 'The Gentleman Cat', class: 'medic', element: 'wind',
    persona: 'zorro', personaName: 'Zorro', color: '#3aa0ff',
    hp: 1050, atk: 420, def: 55, res: 10, interval: 1.85, range: rect(0, 2, -1, 1), block: 0, cost: 10, redeploy: 30,
    passive: { name: 'Rear Guard', desc: 'Heals the most wounded ally in range.' },
    skill: {
      id: 'zorro_mediarama', name: 'Zorro · Mediarama Gale', spType: 'auto', spCost: 24, initSp: 12, duration: 0, needsTarget: false,
      desc: 'A healing gale restores all deployed allies for 140% ATK, raises DEF 20% for 8s, and cuts Echoes for 90% Wind damage.',
    },
    unlock: null,
    bio: 'Insists he is not a cat. Keeps the whole team standing.',
  },
  fox: {
    id: 'fox', name: 'Fox', title: 'The Aesthete', class: 'sniper', element: 'gun',
    persona: 'goemon', personaName: 'Goemon', color: '#29b6f6',
    hp: 1250, atk: 560, def: 90, res: 0, interval: 1.0, range: [...rect(0, 4, 0, 0), ...rect(1, 3, -1, 1)], block: 0, cost: 12, redeploy: 35,
    passive: { name: 'Keen Eye', desc: 'Rapid fire at long range.' },
    skill: {
      id: 'goemon_diamond', name: 'Goemon · Diamond Dust', spType: 'auto', spCost: 26, initSp: 10, duration: 12, needsTarget: true,
      desc: 'For 12s attacks are 80% faster, become Ice damage, and slow targets by 40%.',
    },
    unlock: '1-1',
    bio: 'Sees the world as a canvas, and Echoes as poorly composed ones.',
  },
  oracle: {
    id: 'oracle', name: 'Oracle', title: 'The Navigator', class: 'support', element: 'psy',
    persona: 'alazif', personaName: 'Al Azif', color: '#ff9f1c',
    hp: 1000, atk: 340, def: 50, res: 20, interval: 1.6, range: rect(0, 3, -1, 1), block: 0, cost: 12, redeploy: 40,
    passive: { name: 'Hacker\'s Edge', desc: 'Generates +0.12 DP per second while deployed.' },
    skill: {
      id: 'alazif_scan', name: 'Al Azif · Full Scan', spType: 'auto', spCost: 34, initSp: 20, duration: 14, needsTarget: false,
      desc: 'For 14s every Echo on the field is Analyzed: takes +20% damage and moves 25% slower.',
    },
    unlock: '1-2',
    bio: 'The world\'s best navigator. Has seen the whole map, and is still talking.',
  },
  noir: {
    id: 'noir', name: 'Noir', title: 'The Velvet Axe', class: 'defender', element: 'phys',
    persona: 'milady', personaName: 'Milady', color: '#c8326e',
    hp: 3400, atk: 310, def: 560, res: 5, interval: 1.4, range: rect(0, 1, 0, 0), block: 3, cost: 16, redeploy: 30,
    passive: { name: 'Iron Composure', desc: 'Blocks up to 3 enemies.' },
    skill: {
      id: 'milady_aegis', name: 'Milady · Gran Aegis', spType: 'auto', spCost: 28, initSp: 14, duration: 12, needsTarget: false,
      desc: 'Axe slam stuns blocked Echoes. For 12s DEF x2, regenerates 4% HP/s and counters hits for 80% ATK.',
    },
    unlock: '1-2',
    bio: 'Gentle smile, immovable stance. Do not test the axe.',
  },
  queen: {
    id: 'queen', name: 'Queen', title: 'The Iron Strategist', class: 'artillery', element: 'nuke',
    persona: 'johanna', personaName: 'Johanna', color: '#b266ff',
    hp: 1400, atk: 980, def: 120, res: 0, interval: 2.8, range: rect(1, 5, -1, 1), block: 0, cost: 20, redeploy: 45, splash: 0.9,
    passive: { name: 'Calculated Blast', desc: 'Normal attacks explode in a small area.' },
    skill: {
      id: 'anat_atomic', name: 'Johanna · Atomic Overdrive', spType: 'auto', spCost: 40, initSp: 18, duration: 1.4, needsTarget: true,
      desc: 'Charge for 1.4s, then drop a 550% Nuke strike on the toughest Echo in range (50% pierce) with a huge blast.',
    },
    unlock: '1-3',
    bio: 'Plans every angle. When she commits, the whole map feels it.',
  },
};

export const OPERATOR_ORDER = ['joker', 'skull', 'panther', 'mona', 'fox', 'oracle', 'noir', 'queen'];
export const isMelee = (def) => CLASSES[def.class].melee;
