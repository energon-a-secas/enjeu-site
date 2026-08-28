// ── Learn: the walkthrough copy ──────────────────────────────
// The teaching layer (the user's fork 1: a First Game ladder on top of the
// rules as written). Short, plain, for a child reading with an adult.
// One idea per slide: a step whose visual will not fit beside its copy is two
// steps, not a slide that scrolls.
// The canonical prose is RULES.md, the deck's last slide; each step names the
// rulebook section it comes from so nothing here can drift without a place to
// check.
//
// TWO CHAPTERS, and `chapter` is what says which. Basics runs from the cover to
// what you need to own, and a reader who stops there can play a whole fight.
// Advanced is what the fight does not need on the first evening: elements and
// biomes, the campaign, every die. The rail draws the break, so moving a step
// between chapters is this one field and nothing else.
//
// One entry per deck slide, in order, and every basics step must come before
// every advanced one. The slide count is derived from this array
// (js/views/learn.js: SLIDE_COUNT), so adding a step here adds a slide, a rail
// number and a deep link, and nothing else has to be told.

export const STEPS = [
  {
    // The cover. Its words are the hero copy in js/strings.js, the one place
    // the pitch is written, so this entry deliberately carries no prose of its
    // own: `cover` tells the view to draw that layout instead of title + body.
    id: 'welcome', rule: '1', chapter: 'basics',
    title: 'What this is',
    body: [],
    visual: 'hero',
    cover: true,
  },
  {
    id: 'one-rule', rule: '2', chapter: 'basics',
    title: 'The one rule',
    body: [
      'Your cards are your attack and your defense at once. You bet them to attack, and they come back next turn. So betting is free.',
      'Then the boss hits. You guard by turning a Ready card sideways (Spent). Free again. But if nothing is Ready, a Spent card breaks for good.',
      'That is the whole game: bet enough to win, and keep enough to guard the next hit. Do not be greedy.',
    ],
    visual: 'states',
  },
  {
    id: 'three-cards', rule: '5', chapter: 'basics',
    title: 'Your first fight is three cards',
    body: [
      // Four times what you bet, not three: All In is the one card whose number
      // a slip like that changes by hundreds. RULES.md section 5 is the source.
      'Strike always lands for 25. Focus bets one card for 75 on a Sure roll. All In bets as many as you like and pays four times what you bet on a coin flip, and costs two of your three actions.',
      'Say the name out loud when you play a card. The picture is the name.',
    ],
    visual: 'attacks',
  },
  {
    id: 'a-turn', rule: '4', chapter: 'basics',
    title: 'A turn',
    body: [
      'Recover your Spent cards. Take three actions. Any minions hit you for 25 each. Then the boss rolls a die and does what the table says.',
      'Repeat until the boss falls or you are Down.',
    ],
    visual: 'turn',
  },
  {
    id: 'the-check', rule: '5', chapter: 'basics',
    title: 'The check',
    body: [
      'Pips on the card say how likely it is. One pip is Sure, three out of four. Two pips is Even, a coin flip. Roll your die and meet or beat the number for your die.',
      'Any die works. Three d6 track a d20 closely; one d6 is a little kinder to you.',
    ],
    visual: 'ladder',
  },
  {
    id: 'the-boss', rule: '7', chapter: 'basics',
    title: 'The boss',
    body: [
      'Build it out of bricks. Its card says how big it is, how much each of its life cards is worth, and how hard it hits. Every round it rolls a six-sided die.',
      'From its Rage round its damage doubles and ignores your guard. You cannot win by waiting. Kill it first.',
      'Bubble is the brake for that round: one action, no cards, and the next 25 is absorbed instead of landing.',
    ],
    visual: 'reactions',
  },
  {
    id: 'keeping-count', rule: '7', chapter: 'basics',
    title: 'Keeping count',
    body: [
      "The boss's life is the pile of cards beside its build, so take one off as its value comes off. That is the counter, and most tables need nothing else.",
      'If you would rather read one running number, print the Damage Track. Stand a brick on the total you have dealt and slide it along. Past 100 the brick starts again and a die in the ×100 box remembers the hundreds.',
    ],
    visual: 'track',
  },
  {
    id: 'what-you-need', rule: '10', chapter: 'basics',
    title: 'What you need',
    body: [
      // Ninety-four, not ninety: the count comes from data/cards.json, which the
      // grid beside this copy counts for itself. Two numbers on one slide that
      // disagree teach the reader to trust neither.
      'Ninety-four printed cards, one die, and the bricks and figures already on the table. The game ships no dice and no figures on purpose.',
      'Play it on screen first if you like: the Play tab runs the same cards with a stand-in hero and stand-in bosses.',
    ],
    visual: 'components',
  },
  {
    id: 'elements', rule: '6', chapter: 'advanced',
    title: 'Elements and biomes',
    body: [
      'Every card has an element, and each one beats another. A good matchup adds 25 to the hit.',
      'The biome is where the fight happens. It adds 25 more when it matches your attack.',
    ],
    visual: 'elements',
  },
  {
    id: 'levels', rule: '8, 9', chapter: 'advanced',
    title: 'Then the rest unlocks',
    body: [
      'After level 1 you pick a class. After every level you draft one new skill from three, and draw an Advantage card.',
      'Five levels, each boss bigger than the last.',
    ],
    visual: 'levels',
  },
];

// The deck's small labels: the three card states, the two die captions, the
// campaign table's column heads. They sit here with the step prose rather than
// in js/strings.js because that file is written elsewhere in this build and t()
// renders an unmerged key as `[learn.x]` straight onto the page. One file still
// holds every word the deck says, which is what the i18n seam is for.
export const COPY = {
  states: [
    { name: 'Ready', note: 'Upright. You may bet it, and it guards you.' },
    { name: 'Spent', note: 'Sideways. You bet it or guarded with it. Back next turn.' },
    { name: 'Broken', note: 'Face down. Gone for the level.' },
  ],
  yourDie: 'Your die is {die}. Change it in Play; the next slide has every other die.',
  yourColumn: 'Your die, {die}, is the highlighted column. Change it in Play.',
  campaign: ['Level', 'Size', 'Life', 'Damage', 'Rage'],
  sheets: '{n} cards in all, nine to a printed sheet.',
  // The two chapter labels, and the line that closes the first one. The reader
  // is told where the basics end so that stopping there feels finished rather
  // than abandoned: the rest is depth, not homework.
  chapter: { basics: 'Basics', advanced: 'Advanced' },
  basicsEnd: 'That is everything you need to play a whole fight. Advanced adds elements and biomes, the five-level run, and every other die.',
  // The Damage Track, worked through in the rulebook's own sequence (RULES.md
  // section 7, Keeping count). `mark` is the band the brick stands on and
  // `hundreds` is the die in the x100 box, so the drawing cannot say a different
  // number than the sentence beside it.
  track: [
    { deal: 'Deal 25', mark: 25, hundreds: 0, note: 'The brick stands on 25.' },
    { deal: 'Deal 50 more', mark: 75, hundreds: 0, note: 'Slide it to 75.' },
    { deal: 'Deal 50 more', mark: 25, hundreds: 1, note: 'That is 125, so the brick starts again on 25 and the die turns up to 1.' },
  ],
};

export const REACTIONS = [
  { roll: 1, name: 'Brace', glyph: 'shield', note: 'no damage, halves what it takes next turn' },
  { roll: 2, name: 'Strike', glyph: 'strike', note: 'its Damage' },
  { roll: 3, name: 'Strike', glyph: 'strike', note: 'its Damage' },
  { roll: 4, name: 'Summon', glyph: 'boss-s', note: 'two life cards become a minion' },
  { roll: 5, name: 'Roar', glyph: 'bolt', note: 'its Damage, your next check is harder' },
  { roll: 6, name: 'Ruin', glyph: 'skull', note: 'double Damage' },
];

export const TURN = [
  { glyph: 'untap', name: 'Recover', note: 'Spent cards stand up' },
  { glyph: 'strike', name: 'Act', note: 'three actions' },
  { glyph: 'boss-s', name: 'Minions', note: '25 each' },
  { glyph: 'dice', name: 'Boss acts', note: 'roll the table' },
];
