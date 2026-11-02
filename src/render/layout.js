// Battle-field geometry shared by renderer and input.
export const TILE = 80;
export const FIELD_X = 0;
export const FIELD_Y = 80;
export const px = (x) => FIELD_X + x * TILE;
export const py = (y) => FIELD_Y + y * TILE;
export const toTile = (mx, my) => ({ c: Math.floor((mx - FIELD_X) / TILE), r: Math.floor((my - FIELD_Y) / TILE) });
