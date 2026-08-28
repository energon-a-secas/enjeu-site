// ── Placeholder roster (contract C5) ─────────────────────────
// Stand-in enemies and heroes for the runner until the real art lands.
// Every entry says so (placeholder: true) so a later pass can find them.
// Names follow the card naming rule: two concrete words, never a brand.
// Boss cards in data/cards.json carry no element, and RULES.md section 7 now
// says so plainly rather than claiming the card prints one. The roster assigns
// it here, which is where it has always actually come from.

export const HEROES = [
  { id: 'hero-fire',  name: 'Ember Scout',  kind: 'hero', element: 'fire',  silhouette: 'minifig', placeholder: true },
  { id: 'hero-water', name: 'Tide Runner',  kind: 'hero', element: 'water', silhouette: 'minifig', placeholder: true },
  { id: 'hero-earth', name: 'Stone Warden', kind: 'hero', element: 'earth', silhouette: 'minifig', placeholder: true },
  { id: 'hero-wind',  name: 'Gale Rider',   kind: 'hero', element: 'wind',  silhouette: 'minifig', placeholder: true },
];

/** One boss per campaign level; `card` is the boss card in cards.json it plays as. */
export const BOSSES = [
  { id: 'ph-boss-1', level: 1, card: 'boss-m',  name: 'Ember Beetle', kind: 'boss', size: 'M',  element: 'fire',  silhouette: 'beetle',  placeholder: true },
  { id: 'ph-boss-2', level: 2, card: 'boss-l',  name: 'Tide Serpent', kind: 'boss', size: 'L',  element: 'water', silhouette: 'serpent', placeholder: true },
  { id: 'ph-boss-3', level: 3, card: 'boss-l2', name: 'Stone Golem',  kind: 'boss', size: 'L',  element: 'earth', silhouette: 'golem',   placeholder: true },
  { id: 'ph-boss-4', level: 4, card: 'boss-xl', name: 'Storm Wyrm',   kind: 'boss', size: 'XL', element: 'wind',  silhouette: 'wyrm',    placeholder: true },
  { id: 'ph-boss-5', level: 5, card: 'boss-um', name: 'Hoard King',   kind: 'boss', size: 'UM', element: null,    silhouette: 'king',    placeholder: true },
];

export const MINION = { id: 'ph-minion', name: 'Spark', kind: 'minion', card: 'boss-s', size: 'S', silhouette: 'minion', placeholder: true };

export const heroFor = (element) => HEROES.find((h) => h.element === element) || HEROES[0];
export const bossFor = (level) => BOSSES.find((b) => b.level === level) || BOSSES[BOSSES.length - 1];
