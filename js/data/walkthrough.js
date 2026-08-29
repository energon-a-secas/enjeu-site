// ── Learn: the walkthrough copy ──────────────────────────────
// The teaching layer (the user's fork 1: a First Game ladder on top of the
// rules as written). Short, plain, for a child reading with an adult.
// One idea per slide: a step whose visual will not fit beside its copy is two
// steps, not a slide that scrolls.
// The canonical prose is RULES.md and RULES.es.md, the same document twice;
// each step names the rulebook section it comes from so nothing here can drift
// without a place to check.
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
//
// ── TWO LANGUAGES ────────────────────────────────────────────
// Learn is the default landing view, so a reader who picks Spanish lands here
// first. Every word the deck says is written twice, as { en, es } side by side
// on the field it belongs to, and `bilingual()` below turns each pair into a
// getter that reads js/strings.js AT ACCESS TIME.
//
// The words stay in this file rather than moving to js/strings.js under a
// `walk.` namespace, which is the original reason the deck labels were put here
// and is still the reason:
//
//  1. js/strings.js is written elsewhere in this build. A key added there and
//     not merged renders the literal [walk.x] straight onto the page, and the
//     Spanish half would have to be appended to a table another hand is
//     appending to at the same time.
//  2. The prose is welded to the structure beside it. A step's `visual`, a
//     reaction's `roll` and `glyph`, a Damage Track row's `mark` and `hundreds`
//     are what the drawing reads, and the sentence next to them is what the
//     reader reads. Splitting the words from the numbers across two files is
//     exactly how a drawing comes to say a different number than its caption,
//     which the notes below record happening twice already.
//
// So: structure is written ONCE and prose is written TWICE, in the same object.
// Nothing here is duplicated per language except the words themselves.

import { getLang } from '../strings.js';

/**
 * Turn every translated value in a structure into a getter onto the current
 * language, and copy everything else through untouched.
 *
 * A translated value is any plain object carrying exactly the keys `en` and
 * `es`, which is the one naming rule this file has: no structural field may be
 * called `en` or `es`. A half-written pair ({ en } with no `es`) is not a pair,
 * so it survives as an object and renders [object Object] on the page. That is
 * on purpose: a missing translation should be loud, the way a missing t() key
 * renders [some.key].
 *
 * Getters and not plain strings because the language toggle re-renders the deck
 * IN PLACE (js/events.js, action `lang`) and never reloads the page. A table
 * resolved at module load would be frozen into whichever language the page
 * started in, which is the same trap js/views/learn.js documents on
 * slideTitles(). Reading through a getter means the deck, the rail, the sr-only
 * labels and the rulebook all turn over together on the click.
 *
 * The getters are enumerable, so JSON.stringify and Object.entries see the
 * current language and the exports keep the plain array/object shapes the view
 * and tests/learn.test.mjs already read. No call site had to change.
 */
function bilingual(o) {
  if (Array.isArray(o)) return o.map(bilingual);
  if (!o || typeof o !== 'object') return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'en' in v && 'es' in v) {
      Object.defineProperty(out, k, { get: () => v[getLang()] ?? v.en, enumerable: true });
    } else {
      out[k] = bilingual(v);
    }
  }
  return out;
}

export const STEPS = bilingual([
  {
    // The cover. Its words are the hero copy in js/strings.js, the one place
    // the pitch is written, so this entry deliberately carries no prose of its
    // own: `cover` tells the view to draw that layout instead of title + body.
    // The title is still needed in both languages: it is this slide's rail
    // label and the name a screen reader reads for the first dot.
    id: 'welcome', rule: '1', chapter: 'basics',
    title: { en: 'What this is', es: 'De qué se trata' },
    body: [],
    visual: 'hero',
    cover: true,
  },
  {
    id: 'one-rule', rule: '2', chapter: 'basics',
    title: { en: 'The one rule', es: 'La única regla' },
    body: {
      en: [
        'Your cards are your attack and your defense at once. You bet them to attack, and they come back next turn. So betting is free.',
        'Then the boss hits. You guard by turning a Ready card sideways (Spent). Free again. But if nothing is Ready, a Spent card breaks for good.',
        'That is the whole game: bet enough to win, and keep enough to guard the next hit. Do not be greedy.',
      ],
      es: [
        'Tus cartas son tu ataque y tu defensa al mismo tiempo. Las apuestas para atacar, y vuelven el próximo turno. Así que apostar sale gratis.',
        'Después el jefe golpea. Te defiendes girando de costado una carta En Pie, y queda De Lado. Gratis otra vez. Pero si no hay ninguna En Pie, una carta De Lado queda Rota para siempre.',
        'Ese es todo el juego: apuesta lo suficiente para ganar, y guarda lo suficiente para defender el próximo golpe. No seas ambicioso.',
      ],
    },
    visual: 'states',
  },
  {
    id: 'three-cards', rule: '5', chapter: 'basics',
    // Five, and derived: data.attack is Strike, Focus, All In, Bubble and Run,
    // and js/game/run.js deals every entry of it. A hardcoded trio in the copy
    // is how Bubble and then Run went missing from the teaching for a while.
    title: { en: 'Your first fight is six cards', es: 'Tu primera pelea son seis cartas' },
    body: {
      en: [
        'Strike always lands for 25. Focus bets one card for 75 on a Sure roll.',
        // 100 per card bet, not four times something the reader has to work out:
        // All In is the one card whose number a slip changes by hundreds.
        // RULES.md section 5 and docs/BALANCE.md are the source of both readings.
        'All In costs two of your three actions and bets as many cards as you like. On a coin flip it pays 100 damage per card you bet, so 1, 2, 3 or 4 cards read as 100, 200, 300 or 400.',
        'Bubble and Run each cost an action and no card. Bubble absorbs the next 25 damage you take this round.',
        'Run puts you Hidden until the boss has acted. Its Strike goes past you for no damage at all, and anything else it does still finds you, but only for half.',
        'Invention is the wild one: invent a spell, say what it does out loud, and a long-shot roll pays 350.',
        'Say the name out loud when you play a card. The picture is the name.',
      ],
      es: [
        'Golpe siempre acierta y hace 25. Puntería apuesta una carta y hace 75 con una tirada Segura.',
        'Todo o Nada cuesta dos de tus tres acciones y apuesta las cartas que quieras. Con una moneda al aire paga 100 de daño por cada carta que apostaste, así que 1, 2, 3 o 4 cartas son 100, 200, 300 o 400.',
        'Burbuja y Escape cuestan una acción y ninguna carta. Burbuja absorbe los próximos 25 de daño que recibas esta ronda.',
        'Escape te deja Escondido hasta que el jefe actúe. Su Golpe pasa de largo y no te hace nada, y todo lo demás igual te encuentra, pero solo por la mitad.',
        'Invención es la carta loca: inventa un hechizo, di en voz alta qué hace, y una tirada difícil paga 350.',
        'Di el nombre en voz alta cuando juegues una carta. El dibujo es el nombre.',
      ],
    },
    visual: 'attacks',
  },
  {
    id: 'a-turn', rule: '4', chapter: 'basics',
    title: { en: 'A turn', es: 'Un turno' },
    body: {
      en: [
        'Recover your Spent cards. Take three actions. Any minions hit you for 25 each. Then the boss rolls a die and does what the table says.',
        'Repeat until the boss falls or you are Down.',
      ],
      es: [
        'Recupera tus cartas De Lado. Toma tres acciones. Cada esbirro en juego te hace 25. Después el jefe tira un dado y hace lo que dice la tabla.',
        'Repite hasta que el jefe caiga o tú quedes Caído.',
      ],
    },
    visual: 'turn',
  },
  {
    id: 'the-check', rule: '5', chapter: 'basics',
    title: { en: 'The check', es: 'La tirada' },
    body: {
      en: [
        'Pips on the card say how likely it is. One pip is Sure, three out of four. Two pips is Even, a coin flip. Roll your die and meet or beat the number for your die.',
        'Any die works. Three d6 track a d20 closely; one d6 is a little kinder to you.',
      ],
      es: [
        'Los puntos de la carta dicen qué tan probable es. Un punto es Segura, tres de cada cuatro. Dos puntos es Pareja, como una moneda al aire. Tira tu dado e iguala o supera el número de tu dado.',
        'Sirve cualquier dado. Tres d6 siguen de cerca a un d20; un solo d6 corre un poco a tu favor.',
      ],
    },
    visual: 'ladder',
  },
  {
    id: 'the-boss', rule: '7', chapter: 'basics',
    title: { en: 'The boss', es: 'El jefe' },
    body: {
      en: [
        'Build it out of bricks. Its card says how big it is, how much each of its life cards is worth, and how hard it hits. Every round it rolls a six-sided die.',
        'From its Rage round its damage doubles and ignores your guard. You cannot win by waiting. Kill it first.',
        'Bubble is the brake for that round: one action, no cards, and the next 25 is absorbed instead of landing.',
      ],
      es: [
        'Ármalo con bloques. Su carta dice qué tamaño tiene, cuánto vale cada una de sus cartas de vida, y qué tan fuerte golpea. Cada ronda tira un dado de seis caras.',
        'Desde su ronda de Furia su daño se dobla y atraviesa tu defensa. No puedes ganar esperando. Tienes que hacerlo caer antes.',
        'Burbuja es el freno para esa ronda: una acción, ninguna carta, y los próximos 25 se absorben en vez de llegar.',
      ],
    },
    visual: 'reactions',
  },
  {
    id: 'keeping-count', rule: '7', chapter: 'basics',
    title: { en: 'Keeping count', es: 'Llevar la cuenta' },
    body: {
      en: [
        "The boss's life is the pile of cards beside its build, so take one off as its value comes off. That is the counter, and most tables need nothing else.",
        'If you would rather read one running number, print the Damage Track. Stand a brick on the total you have dealt and slide it along. Past 100 the brick starts again and a die in the ×100 box remembers the hundreds.',
      ],
      es: [
        'La vida del jefe es la pila de cartas al lado de su construcción, así que saca una carta cuando salga su valor. Ese es el contador, y a casi ninguna mesa le hace falta nada más.',
        'Si prefieres leer un solo número corriendo, imprime la Pista de Daño. Pon un bloque de pie sobre el total que llevas hecho y muévelo. Pasando 100 el bloque vuelve a empezar y un dado en la casilla ×100 se acuerda de las centenas.',
      ],
    },
    visual: 'track',
  },
  {
    id: 'what-you-need', rule: '10', chapter: 'basics',
    title: { en: 'What you need', es: 'Lo que necesitas' },
    body: {
      // A hundred and five: the count comes from data/cards.json, which the
      // grid beside this copy counts for itself. Two numbers on one slide that
      // disagree teach the reader to trust neither.
      en: [
        'A hundred and ten printed cards, one die, and the bricks and figures already on the table. The game ships no dice and no figures on purpose.',
        'Play it on screen first if you like: the Play tab runs the same cards with a stand-in hero and stand-in bosses.',
      ],
      es: [
        'Ciento diez cartas impresas, un dado, y los bloques y las figuras que ya están en la mesa. El juego no trae dados ni figuras, y es a propósito.',
        'Si quieres, primero juégalo en pantalla: la pestaña Jugar usa las mismas cartas con un héroe y unos jefes provisorios.',
      ],
    },
    visual: 'components',
  },
  {
    id: 'elements', rule: '6', chapter: 'advanced',
    title: { en: 'Elements and biomes', es: 'Elementos y biomas' },
    body: {
      // Most, not every: the six Attack cards and five of the skills carry no
      // element in cards.json, and engine.js attackElement falls back to the
      // hero's. A slide that says "every" sends the reader looking for a
      // corner that is not printed.
      en: [
        'Most cards have an element, and each element beats another. A card with none uses yours. A good matchup adds 25 to the hit.',
        'The biome is where the fight happens. It adds 25 more when it matches your attack.',
      ],
      es: [
        'Casi todas las cartas tienen un elemento, y cada elemento le gana a otro. Una carta sin elemento usa el tuyo. Un buen cruce suma 25 al golpe.',
        'El bioma es el lugar donde pasa la pelea. Suma otros 25 cuando calza con tu ataque.',
      ],
    },
    visual: 'elements',
  },
  {
    id: 'levels', rule: '8, 9', chapter: 'advanced',
    title: { en: 'Then the rest unlocks', es: 'Después se abre el resto' },
    body: {
      en: [
        'After level 1 you pick a class. After every level you draft one new skill from three, and draw an Advantage card.',
        'Five levels, each boss bigger than the last.',
      ],
      es: [
        'Después del nivel 1 eliges una clase. Después de cada nivel se destapan tres habilidades, te quedas con una, y robas una carta de Ventaja.',
        'Cinco niveles, y cada jefe es más grande que el anterior.',
      ],
    },
    visual: 'levels',
  },
]);

// The deck's small labels: the three card states, the two die captions, the
// campaign table's column heads. They sit here with the step prose because one
// file holds every word the deck says, which is what the header above explains.
export const COPY = bilingual({
  states: [
    { name: { en: 'Ready', es: 'En Pie' }, note: { en: 'Upright. You may bet it, and it guards you.', es: 'Derecha. La puedes apostar, y te defiende.' } },
    { name: { en: 'Spent', es: 'De Lado' }, note: { en: 'Sideways. You bet it or guarded with it. Back next turn.', es: 'De costado. La apostaste o defendiste con ella. Vuelve el próximo turno.' } },
    { name: { en: 'Broken', es: 'Rota' }, note: { en: 'Face down. Gone for the level.', es: 'Boca abajo. Se fue por el resto del nivel.' } },
  ],
  // {die} is filled in by the view. It is a die name (d20, 3d6), the same word
  // in both languages, so neither sentence may reorder it away from its verb.
  yourDie: {
    en: 'Your die is {die}. Change it in Play; the next slide has every other die.',
    es: 'Tu dado es {die}. Lo cambias en Jugar; la próxima pantalla tiene todos los demás dados.',
  },
  yourColumn: {
    en: 'Your die, {die}, is the highlighted column. Change it in Play.',
    es: 'Tu dado, {die}, es la columna marcada. Lo cambias en Jugar.',
  },
  campaign: {
    en: ['Level', 'Size', 'Life', 'Damage', 'Rage'],
    es: ['Nivel', 'Tamaño', 'Vida', 'Daño', 'Furia'],
  },
  sheets: {
    en: '{n} cards in all, nine to a printed sheet.',
    es: '{n} cartas en total, nueve por hoja impresa.',
  },
  // The two chapter labels, and the line that closes the first one. The reader
  // is told where the basics end so that stopping there feels finished rather
  // than abandoned: the rest is depth, not homework.
  chapter: {
    basics: { en: 'Basics', es: 'Lo básico' },
    try: { en: 'Try it', es: 'Pruébalo' },
    advanced: { en: 'Advanced', es: 'Lo avanzado' },
    reference: { en: 'Reference', es: 'Referencia' },
  },
  basicsEnd: {
    en: 'That is everything you need to play a whole fight. Advanced adds elements and biomes, the five-level run, and every other die.',
    es: 'Eso es todo lo que necesitas para jugar una pelea entera. Lo avanzado agrega los elementos y los biomas, la partida de cinco niveles, y todos los demás dados.',
  },
  // The Damage Track, worked through in the rulebook's own sequence (RULES.md
  // section 7, Keeping count). `mark` is the band the brick stands on and
  // `hundreds` is the die in the x100 box, so the drawing cannot say a different
  // number than the sentence beside it. Both are written once: only the two
  // sentences are translated, so no number here can disagree across languages.
  track: [
    {
      deal: { en: 'Deal 25', es: 'Haces 25' }, mark: 25, hundreds: 0,
      note: { en: 'The brick stands on 25.', es: 'El bloque se para en 25.' },
    },
    {
      deal: { en: 'Deal 50 more', es: 'Haces 50 más' }, mark: 75, hundreds: 0,
      note: { en: 'Slide it to 75.', es: 'Muévelo a 75.' },
    },
    {
      deal: { en: 'Deal 50 more', es: 'Haces 50 más' }, mark: 25, hundreds: 1,
      note: {
        en: 'That is 125, so the brick starts again on 25 and the die turns up to 1.',
        es: 'Eso son 125, así que el bloque vuelve a 25 y el dado sube a 1.',
      },
    },
  ],
});

// The boss's six faces. `roll` and `glyph` are the drawing and are written once;
// the name is the word the player says out loud, so it is translated with the
// same vocabulary as the rulebook's reaction table (RULES.es.md section 7).
export const REACTIONS = bilingual([
  { roll: 1, name: { en: 'Brace', es: 'Aguante' }, glyph: 'shield', note: { en: 'no damage, halves what it takes next turn', es: 'no hace daño, parte a la mitad lo que reciba el próximo turno' } },
  { roll: 2, name: { en: 'Strike', es: 'Golpe' }, glyph: 'strike', note: { en: 'its Damage', es: 'su Daño' } },
  { roll: 3, name: { en: 'Strike', es: 'Golpe' }, glyph: 'strike', note: { en: 'its Damage', es: 'su Daño' } },
  { roll: 4, name: { en: 'Summon', es: 'Invocación' }, glyph: 'boss-s', note: { en: 'two life cards become a minion', es: 'dos cartas de vida se vuelven un esbirro' } },
  { roll: 5, name: { en: 'Roar', es: 'Rugido' }, glyph: 'bolt', note: { en: 'its Damage, your next check is harder', es: 'su Daño, y tu próxima tirada sube de dificultad' } },
  { roll: 6, name: { en: 'Ruin', es: 'Ruina' }, glyph: 'skull', note: { en: 'double Damage', es: 'el doble de Daño' } },
]);

export const TURN = bilingual([
  { glyph: 'untap', name: { en: 'Recover', es: 'Recuperar' }, note: { en: 'Spent cards stand up', es: 'las cartas De Lado se paran' } },
  { glyph: 'strike', name: { en: 'Act', es: 'Actuar' }, note: { en: 'three actions', es: 'tres acciones' } },
  { glyph: 'boss-s', name: { en: 'Minions', es: 'Esbirros' }, note: { en: '25 each', es: '25 cada uno' } },
  { glyph: 'dice', name: { en: 'Boss acts', es: 'El jefe actúa' }, note: { en: 'roll the table', es: 'tira en la tabla' } },
]);
