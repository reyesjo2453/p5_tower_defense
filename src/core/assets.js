// Optional external art. The game is fully playable with procedural placeholder art;
// drop your own images into /assets and list them in assets/manifest.json to override.
// See docs/ASSETS.md.
const images = new Map();

export const assets = {
  get(key) {
    return images.get(key) || null;
  },
  async load(manifestUrl = 'assets/manifest.json') {
    let manifest;
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) return;
      manifest = await res.json();
    } catch {
      return;
    }
    const jobs = Object.entries(manifest.images || {}).map(
      ([key, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(key, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        }),
    );
    await Promise.all(jobs);
  },
};
