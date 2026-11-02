// "Echoes": cognitive replays of regret that the ENCORE signal spawns in the Metaverse.
export const ENEMIES = {
  shade: {
    id: 'shade', name: 'Loop Echo', shape: 'blob', color: '#6a3dff',
    hp: 1200, atk: 230, def: 40, res: 0, speed: 0.9, interval: 1.4, weak: ['fire', 'wind'], resist: [], staggerMax: 70, lifeCost: 1,
    desc: 'A replayed version of a commuter. It walks the same path forever.',
  },
  hound: {
    id: 'hound', name: 'Skip Hound', shape: 'hound', color: '#00e0c6',
    hp: 900, atk: 200, def: 20, res: 0, speed: 1.7, interval: 1.0, weak: ['ice', 'wind'], resist: [], staggerMax: 60, lifeCost: 1,
    desc: 'A scratched record given legs. Fast and fragile.',
  },
  bulwark: {
    id: 'bulwark', name: 'Wall of Sound', shape: 'bulwark', color: '#ff8a1f',
    hp: 3200, atk: 320, def: 480, res: 10, speed: 0.55, interval: 1.8, weak: ['elec', 'nuke'], resist: ['phys'], staggerMax: 90, lifeCost: 1,
    desc: 'Stacked amplifiers. Shrugs off blades; shorts out to lightning.',
  },
  seer: {
    id: 'seer', name: 'Mute Seer', shape: 'seer', color: '#d24bff',
    hp: 1300, atk: 300, def: 30, res: 60, speed: 0.8, interval: 2.2, weak: ['gun', 'phys'], resist: ['psy'], staggerMax: 70, lifeCost: 1,
    ranged: true, range: 2.2, magic: true,
    desc: 'Silent ranged caster. Magic barely scratches it; bullets do.',
  },
  conductor: {
    id: 'conductor', name: 'Conductor Echo', shape: 'conductor', color: '#ff2e63',
    hp: 7000, atk: 420, def: 180, res: 20, speed: 0.5, interval: 1.6, weak: ['curse', 'psy'], resist: [], staggerMax: 160, lifeCost: 2,
    ability: 'summon', summonEvery: 12, summon: 'shade', boss: true,
    desc: 'Directs the loop. Summons Loop Echoes while it marches.',
  },
  maestro: {
    id: 'maestro', name: 'The Maestro', shape: 'maestro', color: '#ffd24a',
    hp: 25000, atk: 560, def: 230, res: 28, speed: 0.4, interval: 1.7, weak: ['bless', 'psy'], resist: [], staggerMax: 260, lifeCost: 3,
    ability: 'crescendo', crescendoEvery: 11, revive: { hpPct: 0.45 }, boss: true, staggerGain: 0.6,
    desc: 'Soren Kuga\'s Palace ruler. Demands an encore every time he falls.',
  },
};
