// ── Learn: the walkthrough copy ──────────────────────────────
// The teaching layer (the user's fork 1: a First Game ladder on top of the
// rules as written). Steps 1 to 5 are everything the First Game needs; step
// 6 is what unlocks after it. Short, plain, for a child reading with an adult.
// The canonical prose is RULES.md, rendered below this on the same page; each
// step names the rulebook section it comes from so nothing here can drift
// without a place to check.

export const STEPS = [
  {
    id: 'one-rule', rule: '2',
    title: 'The one rule',
    body: [
      'Your life is cards. You bet them to attack, and they come back next turn. So betting is free.',
      'Then the boss hits. You guard by turning a Ready card sideways (Spent). Free again. But if nothing is Ready, a Spent card breaks for good.',
      'That is the whole game: how much do you dare bet, knowing the boss swings next?',
    ],
    visual: 'states',
  },
  {
    id: 'three-cards', rule: '5',
    title: 'Your first fight is three cards',
    body: [
      'Strike always lands for 25. Focus bets one card for 75 on a Sure roll. All In bets as many as you like and triples them on a coin flip, and costs two of your three actions.',
      'Say the name out loud when you play a card. The picture is the name.',
    ],
    visual: 'attacks',
  },
  {
    id: 'a-turn', rule: '4',
    title: 'A turn',
    body: [
      'Recover your Spent cards. Take three actions. Any minions hit you for 25 each. Then the boss rolls a die and does what the table says.',
      'Repeat until the boss falls or you are Down.',
    ],
    visual: 'turn',
  },
  {
    id: 'the-check', rule: '5',
    title: 'The check',
    body: [
      'Pips on the card say how likely it is. One pip is Sure, three out of four. Two pips is Even, a coin flip. Roll your die and meet or beat the number for your die.',
      'Any die works. Three d6 track a d20 closely; one d6 is a little kinder to you.',
    ],
    visual: 'ladder',
  },
  {
    id: 'the-boss', rule: '7',
    title: 'The boss',
    body: [
      'Build it out of bricks. Its card says how big it is, how much each of its life cards is worth, and how hard it hits. Every round it rolls a six-sided die.',
      'From its Rage round its damage doubles and ignores your guard. You cannot win by waiting. Kill it first.',
    ],
    visual: 'reactions',
  },
  {
    id: 'unlocks', rule: '6, 8, 9',
    title: 'Then the rest unlocks',
    body: [
      'Elements: each one beats another, and a good matchup adds 25 to every hit. The biome adds 25 more when it matches your attack.',
      'After level 1 you pick a class. After every level you draft one new skill from three, and draw an Advantage card. Five levels, each boss bigger than the last.',
    ],
    visual: 'unlocks',
  },
  {
    id: 'what-you-need', rule: '10',
    title: 'What you need',
    body: [
      'Ninety printed cards, one die, and the bricks and figures already on the table. The game ships no dice and no figures on purpose.',
      'Play it on screen first if you like: the Play tab runs the same cards with a stand-in hero and stand-in bosses.',
    ],
    visual: 'components',
  },
];

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
