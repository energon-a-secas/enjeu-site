// ── Glyph set (placeholder art, by art-manifest slot id) ─────
// Original artwork on a 24 x 24 stroked grid, one path per glyph. Ids equal
// the slot ids in data/art-manifest.json, so a card asks for a slot and gets
// whichever is available: the attributed Noun Project SVG in art/<id>.svg
// once its manifest row carries creator + licence, else the glyph here.
// That is the user's fork 2: in-house glyphs now, the manifest stays the art
// source of record, and the swap is a file drop plus two manifest fields.
//
// Seed: projects/boardwright-site/js/icons.js (same author, original, MIT).
// The rest were drawn to match: stroked, round caps, legible at 30 mm.
//
// 2026-08-27: the 25 skill cards were given 25 DISTINCT pictures. Before this,
// 12 of them shared 5 pictures (Torrent, Maelstrom and Deluge were one image;
// Tremor, Earthquake and Cataclysm another), and eight more depicted the wrong
// thing entirely because the supplied icon list had no art for the concept:
// Thunderhead was an open book, Landslide a scroll, Hurricane an up arrow.
// On a deck whose rule is that the picture IS the name, that is a defect, not
// a style choice. Each element now escalates as a family, tier 0 to tier 4.
// Run tools/glyph_sheet.py to see the set; --blind runs the CARD-LAYOUT.md
// icon test on a viewer who cannot read the answers.

export const GLYPH_SIZE = 24;
export const GLYPH_STROKE = 2.4;

/** @type {Record<string, {d: string, label: string}>} */
export const GLYPHS = {
  // Elements (life-card sigils and skill-card sigils)
  fire:   { label: 'Fire', d: 'M12 2.4C13.3 6.3 15.5 7.5 17 10C18.1 11.7 18.5 13.2 18.5 14.9A6.5 6.5 0 0 1 5.5 14.9C5.5 12.3 6.6 10.1 8.6 8.4C8.7 10.6 9.4 11.9 10.6 12.7C11.2 9.3 11.4 5.8 12 2.4Z' },
  water:  { label: 'Water', d: 'M12 3.5c3.3 4.2 5.4 7 5.4 9.6a5.4 5.4 0 1 1-10.8 0c0-2.6 2.1-5.4 5.4-9.6zM9.6 13.6a2.6 2.6 0 0 0 2.6 2.6' },
  earth:  { label: 'Earth', d: 'M2.5 19.5l6.2-9.6 3.6 5.5 2.6-3.8 6.6 7.9zM9 6.5a2 2 0 1 0 0-.1' },
  wind:   { label: 'Wind', d: 'M3 8.5h8.5a2.6 2.6 0 1 0-2.6-2.6M3 12.5h11.5a2.8 2.8 0 1 1-2.8 2.8M3 16.5h6a2.2 2.2 0 1 1-2.2 2.2' },

  // Attack cards
  strike:  { label: 'Strike', d: 'M6.5 10.5V8a1.8 1.8 0 0 1 3.6 0v1.6M10.1 9.6V7.2a1.8 1.8 0 0 1 3.6 0v2.4M13.7 9.8V8.4a1.8 1.8 0 0 1 3.6 0v5.4a6.2 6.2 0 0 1-6.2 6.2H10a5 5 0 0 1-5-5v-3.2a1.7 1.7 0 0 1 3.4 0' },
  focus:   { label: 'Focus', d: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3' },
  'all-in':{ label: 'All In', d: 'M5 17.5a7 2.6 0 1 0 14 0 7 2.6 0 1 0-14 0M5 17.5v-3.2M19 17.5v-3.2M5 14.3a7 2.6 0 0 0 14 0M5 14.3v-3.2M19 14.3v-3.2M5 11.1a7 2.6 0 0 0 14 0M12 1.5v6M9.2 5l2.8 2.8L14.8 5' },

  // Classes
  knight:       { label: 'Knight', d: 'M5 10a7 7 0 0 1 14 0v6.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM5 12.5h5v3H5zM14 12.5h5v3h-5zM12 9v11.5' },
  mage:         { label: 'Mage', d: 'M12 2.5l5 12.5H7zM4.5 15h15l1 4.5c-5.5 1.5-11.5 1.5-17 0z' },
  hunter:       { label: 'Hunter', d: 'M5 3.5a13 13 0 0 1 0 17M5 3.5l14 8.5L5 20.5M11 12h9M17 9l3 3-3 3' },
  necromancer:  { label: 'Necromancer', d: 'M12 2.8c4.5 0 7.6 3.2 7.6 7.4 0 2.6-1.2 4-2.4 5v3.4H8.8v-3.4c-1.2-1-2.4-2.4-2.4-5C6.4 6 9.5 2.8 12 2.8zM9.4 10.6a1.7 1.7 0 1 0 0-.1M14.6 10.6a1.7 1.7 0 1 0 0-.1' },

  // Advantage
  'adv-cure':   { label: 'Cure', d: 'M9.5 2.5h5M10.5 2.5v5.2l-3.6 6.6a4.4 4.4 0 0 0 3.9 6.5h2.4a4.4 4.4 0 0 0 3.9-6.5l-3.6-6.6V2.5M7.6 14.5h8.8' },
  'adv-barrier':{ label: 'Barrier', d: 'M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z' },
  'adv-ally':   { label: 'Ally', d: 'M4 3.2L8.6 8 12 6.6 15.4 8 20 3.2 18.6 11 16.2 14.6 14.8 15 14.1 19.6 9.9 19.6 9.2 15 7.8 14.6 5.4 11ZM8.6 11L10.6 12.1M15.4 11L13.4 12.1' },
  'adv-rune':   { label: 'Rune', d: 'M7 3.5h10l3.5 5v9l-3 3.5H6.5L3.5 17.5v-9zM10 7.5v9M10 7.5l4 3-4 3' },
  'adv-relic':  { label: 'Relic', d: 'M20.5 3.5l-.6 4.4-8.6 8.6-3.8-3.8 8.6-8.6zM8.4 13.9l-2.6 2.6 2.1 2.1 2.6-2.6M4.5 17.8l1.7 1.7' },
  'adv-chest':  { label: 'Chest', d: 'M3.5 10.5h17v9h-17zM3.5 10.5a8.5 4 0 0 1 17 0M12 8.5v13M9.5 13.5h5' },

  // Biomes
  'biome-volcano': { label: 'Volcano', d: 'M2.5 20.5L8.5 8.5h7L21.5 20.5zM8.5 8.5h7M12 6V2.5M9.5 6.5L8 4M14.5 6.5L16 4' },
  'biome-river':   { label: 'River', d: 'M3 3.5c3 2 5 6 4 9s-1 6 1 8M13 3c3 2 5 6 4 9s-1 6 1 8M7.5 11.5c1-1 2-1 3 0s2 1 3 0' },
  'biome-mountain':{ label: 'Mountain', d: 'M2.5 20.5L9.5 7l4 6.5 3-4.5 5 11.5zM9.5 7l-1.8 3.2h3.4z' },
  'biome-desert':  { label: 'Desert', d: 'M14 6.5a3 3 0 1 0 6 0 3 3 0 1 0-6 0M2.5 18.5c3-4 6-4 9-1s6 3 10 0M2.5 13.5c2.5-3 5-3 7-1' },
  'biome-forest':  { label: 'Forest', d: 'M7 3.5l4.5 7H8.5l3 4.5H2.5l3-4.5H2.5zM7 15v5.5M17 6l3.5 5.5H18l2.5 4h-7l2.5-4h-2.5zM17 15.5v5' },
  'biome-village': { label: 'Village', d: 'M3.5 11.5L12 4l8.5 7.5M6 10v10.5h12V10M10 20.5v-6h4v6M15.5 7.5V4.5h2v4.5' },
  'biome-castle':  { label: 'Castle', d: 'M5 20.5V7h2.5v2.5H10V7h4v2.5h2.5V7H19v13.5zM10.5 20.5v-5h3v5' },

  // Skills: fire, escalating (Ember -> Firebolt -> Nova -> Pyre -> Meteor)
  'skill-ember':   { label: 'Ember', d: 'M6.5 19.3C5.9 17 6.1 14.9 7.5 13.1C7.9 15.3 8.5 16.4 9.6 17.1C8.9 14.1 9.3 10.7 11.2 7.4C11.9 10.2 13.2 13.6 14.3 15.9C14.6 14.4 15.5 13.4 16.6 12.8C17.5 14.9 17.5 17.5 16.5 19.4C14.5 21 8.3 21 6.5 19.3ZM17.5 8.2L19 5.9M14.4 5.6L14.9 3.4' },
  'skill-firebolt':{ label: 'Firebolt', d: 'M14.4 19.3C10.9 17.2 8 14 6.2 9.7C5 7.6 4.2 5.9 3.2 4.4C7.9 7.7 12 10.3 15.1 11.8C13.6 9.7 12.7 7.7 12.7 5.8C15.8 7.3 18.7 10 20.3 12.7C20.8 15.6 17.5 19.6 14.4 19.3Z' },
  'skill-nova':    { label: 'Nova', d: 'M12 3.2L10.3 7.9L5.8 5.8L7.9 10.3L3.2 12L7.9 13.7L5.8 18.2L10.3 16.1L12 20.8L13.7 16.1L18.2 18.2L16.1 13.7L20.8 12L16.1 10.3L18.2 5.8L13.7 7.9zM12 12a1.2 1.2 0 1 0 0-.1' },
  'skill-pyre':    { label: 'Pyre', d: 'M15.4 3.5C16.5 6.5 17.6 9.3 17.6 12.2C17.6 15.7 15.2 18.1 12 18.1C8.8 18.1 6.4 15.7 6.4 11.6C6.4 7.7 11.4 9.3 15.4 3.5zM5 20.7L19 17.9M5 17.9l14 2.8' },
  'skill-meteor':  { label: 'Meteor', d: 'M15.9 10.2a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8zM11.9 11L5.4 4.5M15 7.4L11.4 3.8M8.4 13.9L4.8 10.3M3.4 20.6h17.2' },

  // Skills: water (Torrent -> Ice Spear -> Cold Curse -> Maelstrom -> Deluge)
  'skill-torrent':   { label: 'Torrent', d: 'M4.8 12.4A3.6 3.6 0 0 1 7.6 6.8A5.6 5.6 0 0 1 16.6 6A4 4 0 0 1 19 12.4zM7 15.4L5.6 20.4M11 15.4L9.6 20.4M15 15.4L13.6 20.4M19 15.4L17.6 20.4' },
  'skill-ice-spear': { label: 'Ice Spear', d: 'M9.4 14.6L10.6 9.6 21 3 14.4 13.4zM10.6 9.6L14.4 13.4M4 19.5l3.2-3.2M2.8 14.6l2.6-2.6M9 21.2l2.6-2.6' },
  'skill-cold-curse':{ label: 'Cold Curse', d: 'M3 2.6h18M3.4 2.6l1.3 4.6 1.3-4.6M8 2.6l1 2.2 1-2.2M14 2.6l1 2.2 1-2.2M17.9 2.6l1.3 4.6 1.3-4.6M12 7.6c3.9 0 6.6 2.8 6.6 6.4 0 2.3-1 3.5-2.1 4.4v2.9H9.2v-2.9c-1-.9-2.1-2.1-2.1-4.4C7.1 10.4 9.8 7.6 12 7.6zM9.3 14.4a1.35 1.35 0 1 0 0-.1M14.7 14.4a1.35 1.35 0 1 0 0-.1' },
  'skill-maelstrom': { label: 'Maelstrom', d: 'M20.6 8.4A9.1 9.1 0 1 1 3 12A6.3 6.3 0 0 1 15.4 12A3.7 3.7 0 0 1 8.2 12' },
  'skill-deluge':    { label: 'Deluge', d: 'M2.8 20.6C3.2 11.5 6.5 4.2 12.6 4.2C17 4.2 20.4 7.3 20.4 11.2C20.4 14.4 18.2 16.8 15.2 16.8C13.2 16.8 11.8 15.6 11.6 13.8M2.8 20.6H21' },

  // Skills: earth (Tremor -> Boulder -> Earthquake -> Landslide -> Cataclysm)
  'skill-tremor':    { label: 'Tremor', d: 'M4.6 14h14.8M7 14l2 3.4M11 14l2 3.4M15 14l2 3.4M3.4 7.6c-1.5 3.2-1.5 7.6 0 11M20.6 7.6c1.5 3.2 1.5 7.6 0 11' },
  'skill-boulder':   { label: 'Boulder', d: 'M7.5 12L10 6.5l5.5-2 5.5 3.5v6l-4.5 5-6.5-1.5zM2.6 8h2.8M2.6 13h1.9M3.2 17.6h2.4' },
  'skill-earthquake':{ label: 'Earthquake', d: 'M2.5 10h5.6l2.2 4.6-.9 2.4 2.4 4 3.2-4.2-.9-2.6 2.4-3.4h5' },
  'skill-landslide': { label: 'Landslide', d: 'M2.5 4.5L13.5 21h8M11.4 4.8l2.5 1.8-1 2.9h-3.1l-1-2.9zM17.2 10.7l3 2.1-1.1 3.5h-3.6l-1.1-3.5z' },
  'skill-cataclysm': { label: 'Cataclysm', d: 'M13.4 4.4A7.8 7.8 0 1 0 19.6 10.6L14.9 11.6zM7.6 6.8l3 3-2.8 2.8 4 2.6-1.4 4.6' },

  // Skills: wind (Gale -> Cyclone -> Tempest -> Thunderhead -> Hurricane)
  'skill-gale':       { label: 'Gale', d: 'M3 9.8c4.6-1.7 8.8-2.4 12-2.4a2.4 2.4 0 1 0-2.4-2.4M3 14.6c5.6-1.7 11-2.4 14.6-2.4a2.6 2.6 0 1 1-2.6 2.6M4 19.8c3.8-1.4 7-2 9.2-2' },
  'skill-cyclone':    { label: 'Cyclone', d: 'M3.4 4.8c4 1 12.6 1 17-.2M5.6 8.8c3.4.9 9.6.9 12.8-.2M8 12.8c2.4.8 6.4.8 8.6-.2M10.4 16.6c1.4.6 3.6.6 4.8-.2M12.2 20.2c2.6-.2 3.8-1.8 3.4-4' },
  'skill-tempest':    { label: 'Tempest', d: 'M8 21.4C8.6 15.6 10.4 12 14.2 10.6M14.2 10.6c2-1.6 4.2-1.8 5.8-.8M14.2 10.6c2.6-.2 4.4 1.2 5.4 3M14.2 10.6c1.8 1.8 2.6 3.8 2.2 5.6M14.2 10.6c-1.2-1.4-2.8-1.8-4-1.6M2.6 4.6c3-1.2 5.8-1.4 8-1M2.6 9.6c1.8-.7 3.4-.9 4.6-.7' },
  'skill-thunderhead':{ label: 'Thunderhead', d: 'M5.2 13.2a3.6 3.6 0 0 1 .8-7.1 4.7 4.7 0 0 1 8.8-1A4.6 4.6 0 0 1 18.4 13.2zM13.4 13.4l-2.9 4.2h3.2l-2.5 3.2' },
  'skill-hurricane':  { label: 'Hurricane', d: 'M12 3.2c5 0 8.8 3.7 8.8 7.8 0 2.9-2.2 5-5 4.4M12 20.8c-5 0-8.8-3.7-8.8-7.8 0-2.9 2.2-5 5-4.4M12 9.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6' },

  // Skills: blades and death (Slash -> Piercer -> Slash Wave -> Soul Strike -> Reaper)
  'skill-slash':      { label: 'Slash', d: 'M20.5 3.5L3.5 20.5M20.5 9.5l-11 11M14.5 3.5l-11 11' },
  'skill-piercer':    { label: 'Piercer', d: 'M9 3.2V9.4M9 16.5V20.8M3.2 16.4L13.9 10M12.8 8.1L15.1 11.9 20.6 6z' },
  'skill-slash-wave': { label: 'Slash Wave', d: 'M4 19C4 7 7 4 19 4C12.5 7.8 7.8 12.5 4 19zM10.5 20.5C11 15.8 15.8 11 20.5 10.5' },
  'skill-soul-strike':{ label: 'Soul Strike', d: 'M7.5 12a4.5 4.5 0 0 1 9 0v6.5a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0zM3 20L20 3M20 3L16 4.1M20 3L18.9 7.1' },
  'skill-reaper':     { label: 'Reaper', d: 'M6.5 21L16.8 4.6M16.8 4.6C12.5 3 6.5 3.8 3.5 7.6c3.4-2.2 7.8-2.2 11 .4z' },

  // Boss sizes (one figure escalating; the play runner draws the big ones in figures.js)
  'boss-s': { label: 'Minion', d: 'M7.2 9.4h9.6v7.6H7.2zM9 9.4V7.4h2.2v2M12.8 9.4V7.4h2.2v2M12 13.2a1 1 0 1 0 .1 0M9.8 17v2.6M14.2 17v2.6' },
  'boss-m': { label: 'Boss M', d: 'M9.2 4.4V2.8h2v1.6M12.8 4.4V2.8h2v1.6M6.6 4.4h10.8v7H6.6zM9.8 7.9a.8 .8 0 1 0 .1 0M14.2 7.9a.8 .8 0 1 0 .1 0M4.9 11.4h14.2v6.2H4.9zM4.9 12.8H2.9v4.6M19.1 12.8h2v4.6M8.6 17.6v3M15.4 17.6v3' },
  'boss-l': { label: 'Boss L', d: 'M12 5a3 3 0 1 0 .1 0M9.5 3.5L8 1M14.5 3.5L16 1M6 11h12l1.5 8.5h-15zM8.5 19.5v2M15.5 19.5v2M4 12l-1.5 5M20 12l1.5 5' },
  'boss-xl':{ label: 'Boss XL', d: 'M12 5.5a2.6 2.6 0 1 0 .1 0M9 10h6l1.5 8.5h-9zM9 11L2.5 6v9l6.5-2M15 11l6.5-5v9L15 13M9.5 18.5v3M14.5 18.5v3' },
  'boss-um':{ label: 'Boss UM', d: 'M12 7a2.6 2.6 0 1 0 .1 0M8.5 4.5L10 2.5l2 2 2-2 1.5 2v1.5h-7zM6.5 12.5h11l2 8.5h-15zM9 21v1.5M15 21v1.5' },

  // Markers
  life:   { label: 'Life', d: 'M12 20.5C6 16.4 3 13.2 3 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9 2.6c0 3.6-3 6.8-9 10.9zM4.6 12.6h3.4l2-3.4 2.4 6 1.6-2.6h5.4' },
  crown:  { label: 'Boss', d: 'M4 5.8L8 11 12 3.6 16 11 20 5.8 18.2 19.6H5.8zM6.6 15.8h10.8' },

  // UI only: not manifest slots, so no art file will ever replace these
  book:      { label: 'Book', d: 'M4 4.5h6a3 3 0 0 1 2 .9 3 3 0 0 1 2-.9h6v13h-6a3 3 0 0 0-2 .9 3 3 0 0 0-2-.9H4zM12 5.4v13' },
  'trend-up':{ label: 'Trend up', d: 'M12 20V5M6.5 10.5L12 5l5.5 5.5M4 21h16' },
  skip:      { label: 'Skip', d: 'M6 5l7 7-7 7M13 5l7 7-7 7' },
  dice:      { label: 'Die', d: 'M4.5 4.5h15v15h-15zM9 9a.6.6 0 1 0 0-.1M15 9a.6.6 0 1 0 0-.1M12 12a.6.6 0 1 0 0-.1M9 15a.6.6 0 1 0 0-.1M15 15a.6.6 0 1 0 0-.1' },
  eye:       { label: 'Hide', d: 'M2.5 12c2.5-4.5 5.8-6.5 9.5-6.5s7 2 9.5 6.5c-2.5 4.5-5.8 6.5-9.5 6.5S5 16.5 2.5 12zM12 9.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z' },
  shield:    { label: 'Guard', d: 'M12 3l7.5 2.6v6c0 4.2-3.1 8-7.5 9.4C7.6 19.6 4.5 15.8 4.5 11.6v-6z' },
  skull:     { label: 'Down', d: 'M12 2.8c4.5 0 7.6 3.2 7.6 7.4 0 2.6-1.2 4-2.4 5v3.4H8.8v-3.4c-1.2-1-2.4-2.4-2.4-5C6.4 6 9.5 2.8 12 2.8zM9.4 10.6a1.7 1.7 0 1 0 0-.1M14.6 10.6a1.7 1.7 0 1 0 0-.1' },
  bolt:      { label: 'Rage', d: 'M13.5 2.5L5 13.5h6l-2.5 8L18 10.5h-6z' },
  untap:     { label: 'Recover', d: 'M4 12a8 8 0 1 0 2.3-5.7M4 3.5v5h5' },
  plus:      { label: 'Plus', d: 'M12 4v16M4 12h16' },
  star:      { label: 'Star', d: 'M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z' },
};


export const GLYPH_IDS = Object.keys(GLYPHS);
export const hasGlyph = (id) => Object.prototype.hasOwnProperty.call(GLYPHS, id);

/** The path data for one glyph, or null. */
export function glyphPath(id) { return hasGlyph(id) ? GLYPHS[id].d : null; }

/**
 * A standalone inline SVG for UI use (buttons, tables, the log). Stroke
 * colour is currentColor so it follows the text around it.
 */
export function glyphSvg(id, cls = '', size = GLYPH_SIZE) {
  const d = glyphPath(id);
  if (!d) return '';
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}" fill="none" stroke="currentColor"`
    + ` stroke-width="${GLYPH_STROKE}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// ── Art overrides ────────────────────────────────────────────
// A manifest slot counts as "art present" once it carries creator AND
// licence: the same rule tools/credits.py enforces before it will write
// CREDITS.md. So a downloaded SVG that is not yet attributed keeps rendering
// the glyph, and nothing credited-but-missing can slip onto a sheet.
let _art = {};
export function setArtManifest(manifest) {
  _art = {};
  for (const s of manifest?.slots || []) {
    if (s.source && s.creator && s.licence) _art[s.id] = `art/${s.id}.svg`;
  }
}
export function artSrc(id) { return _art[id] || null; }
export function artCount() { return Object.keys(_art).length; }
