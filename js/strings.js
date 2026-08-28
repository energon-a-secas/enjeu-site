// ── UI strings ───────────────────────────────────────────────
// Every word the interface shows lives here, keyed, so a second language is
// a second table and not a rewrite (the user's fork 3). There are two tables
// now, `en` and `es`, and `es` mirrors every key `en` has: a key present in one
// and missing in the other renders the literal [some.key] on the page, which
// tests/content.test.mjs is there to catch.
//
// Card faces carry no text at all, so nothing in here touches them. Rulebook
// prose comes from RULES.md (English) and RULES.es.md (Spanish), not from here.
//
// CARD NAMES. data/cards.json is the single source of truth for a card's
// English name, so `en` deliberately carries NO name table: cardName() falls
// through to card.name and cannot drift from the data. `es` carries the
// overlay, cards.name.<card id>, because the names are spoken out loud and a
// Spanish table needs Spanish names to shout.

export const STRINGS = {
  en: {
    nav: { learn: 'Learn', cards: 'Cards', play: 'Play', about: 'About', balance: 'Balance' },
    about: {
      title: 'About',
      lead: 'Where this game came from, and who drew the pictures on the cards.',

      originTitle: 'It was made for my niece',
      origin1: 'She is small, she likes playing with bricks, and I am usually the one playing with her. The trouble is that made-up rules fall apart fast: they change every few minutes, nobody can lose, and the game stops being a game. So I thought I would write some down and see if that made it funnier.',
      origin2: 'She also wanted to use the dice. All of them, not just the six-sided one. That turned out to be the useful constraint: every die from the d4 to the d20 had to work, so the game had to be built around a roll rather than around a number.',
      origin3: 'What I was after was something shaped like a small Dungeons and Dragons session, where you get to say what happened, with enough mechanics around it that it does not collapse. Rules loose enough to leave room, tight enough to hold. Everything else was built around that.',

      secondTitle: 'This is the second version',
      second1: 'The first one had too many rules, which is the opposite failure and just as bad. We played it, and the parts she found fun were not the parts I had written the most rules for. So the rest came out.',
      second2: 'The cutting is the design. What is left is short because it was played, not because it was hurried.',

      tableTitle: 'It is played on the table you already have',
      table1: 'There is no board. The boss is built out of bricks. The hero is a figure out of the same box. You put them on the table and the cards do the arithmetic.',
      table2: 'That is also why nothing here is studded or brick shaped, and why no card names a toy. The toys are yours, whichever ones you own.',

      spellsTitle: 'The spells that were cut',
      spells1: 'An early version let the player invent spells. You wrote one, you named it, you used it. It was too complicated to keep, so it went.',
      spells2: 'What took its place is the move tabletop roleplaying games make: hand it back to the player instead of writing another rule. No card prints its name, so you say out loud what it was. Run is the clearest of them. The card says you got away and the boss says how well; where you ran and what you hid behind is yours to invent, and the rules never ask.',
      spells3: 'The idea is not dropped. It just does not have a rule yet.',

      artTitle: 'The art',
      artLead: 'Most of the card art comes from The Noun Project, downloaded under CC BY. Attribution is a condition of that licence, not a courtesy. The list below is read from data/art-manifest.json when this page loads, so it cannot drift from what the cards print.',
      artInHouse: 'The rest is drawn in house, on a 24 by 24 stroked grid. That glyph set was drawn first, so the deck could be tested and printed before there was any art at all. The boss size cards still use it on purpose: one figure that grows across five cards tells you which boss is bigger, and five unrelated stock monsters would not.',
      artLoading: 'Reading the art manifest',
      artFail: 'data/art-manifest.json did not load. Serve the folder over HTTP (make serve) and reload.',
      statCredited: 'icons credited',
      statCreators: 'creators',
      statInHouse: 'slots drawn in house',
      creditsNote: 'The same list ships as CREDITS.md, generated from the same file by tools/credits.py. If you pass this game on, that page goes with it.',
      cols: { icon: 'Icon', use: 'Used for', creator: 'Creator', licence: 'Licence', what: 'What' },

      licenceTitle: 'Licence',
      licenceLead: 'Two halves, because they cannot be one.',
      licence: {
        codeWhat: 'Rules, card data, tools, site code and all the text',
        codeIs: 'MIT',
        artWhat: 'The icons in art/',
        artIs: 'CC BY, per the table above',
        glyphsWhat: 'The glyphs drawn in house',
        glyphsIs: 'MIT, original',
      },
      licenceNote: 'A fork inherits the attribution. That is the part to know before you copy the folder.',
    },
    footer: { version: 'v0.1.0' },
    // The page chrome that lives in index.html rather than in a view: the
    // header subtitle, the skip link, the two landmark labels and the footer
    // note. js/events.js writes these onto the elements carrying data-i18n /
    // data-i18n-label, because render.js only ever owns what is inside
    // #viewRoot and none of this is.
    chrome: {
      subtitle: 'Balance your attack and your defense',
      skip: 'Skip to content',
      sections: 'Sections',
      closeDialog: 'Close dialog',
      footerNote: 'Rules and cards are MIT. Card art is CC BY, credited on the About page. Runs save on this device only.',
    },
    common: {
      loading: 'Loading the cards',
      loadFail: 'The card data did not load. Serve the folder over HTTP (make serve) and reload.',
      close: 'Close',
      print: 'Print',
      copied: 'Copied',
      placeholder: 'placeholder art',
      sayIt: 'Say it out loud',
    },
    cards: {
      title: 'The cards',
      lead: 'A hundred and five cards, poker size, no words on any of them. The picture is the name, the corners carry the numbers. Tap a card to see what it does.',
      printAll: 'Print all 105 (12 sheets)',
      printDeck: 'Print this deck',
      printing: 'Filling the print sheet',
      paper: 'Paper',
      a4: 'A4',
      letter: 'Letter',
      backs: { _: 'Card backs', none: 'no backs', few: '4 backs', all: 'a back per card' },
      filterAll: 'All decks',
      copies: 'copies',
      deck: { attack: 'Attack', skill: 'Skills', class: 'Classes', advantage: 'Advantage', boss: 'Bosses', biome: 'Biomes', life: 'Life', mode: 'Gentle mode', aid: 'Player aids' },
      val: { betAny: 'any number of Ready cards', none: 'none', lifeCard: 'life card', lifeCards: 'life cards', xBet: '4 × what you bet', classOnly: 'only' },
      corner: { bet: 'Bet', check: 'Check', tier: 'Tier', damage: 'Damage', actions: 'Actions', element: 'Element', class: 'Class', effect: 'Effect', passive: 'Passive', size: 'Size', life: 'Life cards', rage: 'Rage from round', rule: 'Rule', value: 'Worth', copies: 'Copies', icon: 'Glyph' },
      check: { none: 'always lands', sure: 'Sure, 75%', even: 'Even, 50%', hard: 'Hard, 25%', wild: 'Wild, 15%' },
      // The bare name of a step, with no odds attached. The views used to
      // capitalise the raw id ('sure' -> 'Sure'), which is a name only in
      // English; the ladder needs its own words in every language.
      step: { sure: 'Sure', even: 'Even', hard: 'Hard', wild: 'Wild' },
      sort: { _: 'Sort by', deck: 'Deck', element: 'Element', tier: 'Tier', class: 'Class', check: 'Risk', damage: 'Damage', name: 'Name' },
      element: { _: 'Element', all: 'Any element', none: 'Yours' },
      tier: { _: 'Tier', all: 'Any tier' },
      klass: { _: 'Class', all: 'Any class', none: 'Open to all' },
      showBacks: 'Show backs',
      showFaces: 'Show faces',
      reset: 'Clear filters',
      empty: 'No card matches those filters.',
      face: 'Face',
      back: 'Back',
      printOrder: 'Printing always uses the boxed order, whatever this list is sorted by.',
    },
    learn: {
      heroKicker: 'A print-and-play boss rush for one player',
      heroTitle: 'Balance your <em>attack</em> and your <em>defense</em>.',
      heroLead: 'Build the boss out of bricks. Play your hero as a figure. Spend cards to attack, keep cards to defend, and do not be greedy. One die, a hundred and five cards, and the toys already on the table.',
      ctaPlay: 'Play on screen',
      ctaCards: 'Print the cards',
      ctaFirst: 'First Game: one boss, five cards',
      walkthroughKicker: 'How it plays',
      rulebookTitle: 'The rulebook',
      rulebookLead: 'The complete rules, the same text that ships with the cards. About ten minutes to read.',
      // The rulebook file the deck fetches, per language. It is a string in the
      // table rather than a branch in the view so a third language is a third
      // row here and no code change at all.
      rulebookFile: 'RULES.md',
      rulebookFail: 'RULES.md did not load. It ships in the repo next to this page.',
      // A citation, as it is read: "rules §5". The section NUMBERS are the same
      // in both rulebooks, only the word in front of them changes.
      rulesRef: 'rules §',
      bridgeTitle: 'Any die you own',
      bridgeLead: 'Find your row. Roll. Meet or beat the number. Three d6 track a d20 within 1.2 points at every step.',
      fidelityLead: "Worst gap between a step's stated odds and the die's real odds:",
      fidelityUnit: 'points.',
      step: 'Step',
      odds: 'Odds',
      prev: 'Back',
      next: 'Next',
      slideOf: 'of',
      contents: 'Contents',
      deckHint: 'Arrow keys, or swipe.',
      slide: { dice: 'Any die you own', rulebook: 'The rulebook' },
    },
    play: {
      title: 'Play',
      setupTitle: 'Set up your run',
      firstGame: 'First Game',
      firstGameLead: 'Level 1 only, with Strike, Focus, All In, Bubble and Run. No classes, no skills, no Advantage. The whole game is already in those five cards.',
      fullRun: 'Full run',
      fullRunLead: 'Five bosses. Classes after the first, a new skill after every level, Advantage cards along the way.',
      element: 'Your element',
      die: 'Your die',
      mode: 'Mode',
      story: 'Story', standard: 'Standard', nightmare: 'Nightmare',
      modeHint: { story: 'one rung easier, for a first run or a younger player', standard: 'the table as printed', nightmare: 'one rung harder' },
      start: 'Start',
      resume: 'Resume run',
      abandon: 'Abandon run',
      level: 'Level',
      round: 'Round',
      boss: 'Boss',
      // The screen-reader label on the boss's health bar, read as
      // "Boss life: 300 / 400". Its neighbour bossPile names the physical pile.
      bossLife: 'Boss life',
      hero: 'You',
      minion: 'Minion',
      ready: 'Ready', spent: 'Spent', broken: 'Broken',
      actionsLeft: 'actions left',
      target: 'Target',
      body: 'the boss',
      bet: 'Bet',
      betHint: 'Pick how many Ready cards to stake.',
      needActions: 'needs 2 actions and your turn has fewer left',
      needBet: 'needs a Ready life card to bet',
      roll: 'Roll',
      typeRoll: 'or type your roll',
      need: 'need',
      hit: 'Hit!', miss: 'Miss',
      endTurn: 'End turn',
      bossTurn: 'Boss acts',
      bossRoll: 'The boss rolls',
      hide: 'Hide', move: 'Move',
      reactionName: { brace: 'Brace', strike: 'Strike', summon: 'Summon', roar: 'Roar', ruin: 'Ruin' },
      what: {
        strike: 'Always lands. 25 damage for one action and no cards.',
        focus: 'Bet one life card. 75 damage if the Sure roll lands, and the card is spent either way.',
        'all-in': 'Bet as many Ready cards as you like: 100 for each of them, on a coin flip. Costs two of your three actions.',
        bubble: 'Absorbs the next 25 you take this round. It is only worth an action under Rage: outside Rage a Ready card guards for free and comes back, so a Bubble buys you nothing.',
        run: 'You are Hidden until the boss acts. Its Strike goes right past you for nothing; anything else still finds you, but only for half.',
      },
      hideHint: 'Free in the Forest: you are Hidden until the boss acts.',
      hidden: 'Hidden',
      rage: 'Rage. Double damage, no guard.',
      rageSoon: 'Rage next round.',
      won: 'The boss falls!',
      lost: 'You are Down.',
      runWon: 'You cleared all five levels.',
      nextLevel: 'Next level',
      newRun: 'New run',
      pickClass: 'Choose your class',
      draftTitle: 'Pick one skill',
      draftLead: 'Three revealed, keep one.',
      advDraw: 'You draw an Advantage card',
      advHand: 'Advantage',
      playAdv: 'Play',
      useRune: 'Use the Rune on this check',
      reroll: 'Hunter: reroll',
      knight: 'Knight guard used',
      barrierPrompt: 'Play Barrier to cancel this?',
      letItHappen: 'Let it happen',
      log: 'Log',
      logShow: 'Show the log', logHide: 'Hide the log',
      // The boss speaks above its own head instead of in the log
      bossWatch: 'The boss watches you.',
      aimedAtYou: 'aimed at you',
      aimedAtAlly: 'aimed at your Ally',
      unguardable: 'unguardable',
      // The gear shelf: what you already have in play
      shelf: 'In play',
      relic: 'Relic', rune: 'Rune', bubbleSlot: 'Bubble',
      // The number is ALLY_DEF in game/engine.js, not a word in here: the
      // rulebook can change it and this string must not have to be found.
      ally: 'Ally', allyDef: 'defense',
      allyGone: 'The Ally is gone.',
      cover: 'Cover the Ally',
      coverHint: 'Take the hit yourself, whole, and the Ally stays.',
      slotEmpty: 'empty',
      // The three bands of the action panel
      bandCards: 'Your cards', bandGo: 'Resolve',
      pickHint: 'the die is waiting',
      placeholderNote: 'Enemies and heroes are placeholders drawn from bricks. The real art comes later.',
      // Second Wind, the gentle-mode card
      secondWind: 'Second Wind',
      secondWindHint: 'A safety net. The first comeback each level is free, then the roll climbs: Sure, Even, Hard, Wild. You come back with 2 Broken cards standing.',
      down: 'You are Down',
      downFree: 'Your first comeback this level is free.',
      downLadder: 'The comeback needs',
      reviveTry: 'Take the comeback',
      reviveGiveUp: 'Let the level end',
      // The plan lane
      plan: 'Your turn',
      planHint: 'Click a card once for each action you want it to take. Click a number to drop that step.',
      planEmpty: 'Pick a card. Three actions this turn.',
      resolvePlan: 'Resolve the turn',
      clearPlan: 'Clear',
      planStep: 'Step',
      reaction: 'Reaction',
      reactionHint: 'Barrier waits here for the boss to act.',
      attachTo: 'attached to step',
      tooManyActions: 'That is more than the actions left this turn.',
      notEnoughReady: 'By that step there is no Ready card left to bet.',
      keys: '1 to 9 pick a card · Enter resolves · Backspace undoes',
      // The rest of the table, shown but not played
      table: 'On the table',
      drawPile: 'Skills',
      advPile: 'Advantage',
      extraPile: 'Extra lives',
      biomeCard: 'Biome',
      bossPile: 'Boss life',
      faceDown: 'face down',
      inTheBox: 'in the box',
    },
    balance: {
      title: 'Balance',
      lead: 'The same engine the runner uses, played thousands of times by four stand-in styles. The published table in BALANCE.md comes from tools/sim.py at 20,000 fights per cell; this one is for trying things.',
      trials: 'Fights per cell',
      bonus: 'Affinity bonus',
      run: 'Run',
      running: 'Running',
      stop: 'Stop',
      style: { turtle: 'turtle', safe: 'safe', adaptive: 'adaptive', gamble: 'gamble' },
      fightsPerCell: 'fights per cell', runCompletion: 'Five-level run completion on the adaptive line', thisRun: 'This run', rulebookRules: 'rulebook rules', legacyRules: 'tools/sim.py legacy rules', bonus: 'bonus', publishedCaption: 'Published: docs/BALANCE.md, tools/sim.py, seed 7, no bonus, no classes, no Advantage', adaptiveCol: 'adaptive',
      cols: { level: 'Level', win: 'win', rounds: 'rounds', broken: 'broken' },
      legacy: 'Match tools/sim.py exactly',
      legacyHint: 'Reproduces three simplifications the Python simulator makes (Brace never halves, Summon moves a flat 100, Roar flattens the next check to Even) so its table can be checked. Off, the engine plays the rulebook.',
      advantage: 'Advantage deck',
      klass: 'Class',
      none: 'none',
    },
  },

  // ── Spanish ────────────────────────────────────────────────
  // Neutral Latin American Spanish, read out loud to a child: short sentences,
  // no vosotros, no peninsular vocabulary. Numbers, dice notation (d20, 2d6)
  // and percentages are left exactly as the English has them.
  //
  // The three life-card states are the heart of the game, so they are named for
  // the gesture the card makes on the table rather than for an abstraction:
  // En Pie (upright), De Lado (turned sideways), Rota (broken). Three different
  // lengths, three different stress patterns, no two of them confusable across
  // a table.
  es: {
    nav: { learn: 'Aprender', cards: 'Cartas', play: 'Jugar', about: 'Acerca de', balance: 'Balance' },
    about: {
      title: 'Acerca de',
      lead: 'De dónde salió este juego, y quién dibujó las figuras de las cartas.',

      originTitle: 'Lo hice para mi sobrina',
      origin1: 'Es chica, le gusta jugar con bloques, y normalmente el que juega con ella soy yo. El problema es que las reglas inventadas se caen a pedazos rápido: cambian cada dos minutos, nadie puede perder, y el juego deja de ser un juego. Así que pensé en escribir algunas y ver si así resultaba más entretenido.',
      origin2: 'También quería usar los dados. Todos, no solo el de seis caras. Esa terminó siendo la restricción útil: cada dado, del d4 al d20, tenía que servir, así que el juego tuvo que armarse alrededor de una tirada y no de un número.',
      origin3: 'Lo que buscaba era algo con la forma de una partida chica de Dungeons and Dragons, donde uno cuenta lo que pasó, con la mecánica suficiente alrededor para que no se desarme. Reglas sueltas para dejar espacio, firmes para sostener. Todo lo demás se construyó alrededor de eso.',
      origin2: 'Lo que no podía ser era un juego de guerra completo con el juguete de construcción. Esa complicación era justo lo que estaba evitando. Tenía que empezar rápido, y tenía que dejar espacio para que ella me contara lo que acababa de hacer su figura.',

      secondTitle: 'Esta es la segunda versión',
      second1: 'La primera tenía demasiadas reglas. La jugamos, y las partes que a ella le parecieron divertidas no eran las partes para las que yo había escrito más reglas. Así que el resto se fue.',
      second2: 'Lo que se cortó es el diseño. Lo que queda es corto porque se jugó, no porque se hizo apurado.',

      tableTitle: 'Se juega en la mesa que ya tienes',
      table1: 'No hay tablero. El jefe se arma con bloques. El héroe es una figura de la misma caja. Los pones en la mesa y las cartas hacen las cuentas.',
      table2: 'Por eso mismo nada de esto tiene pivotes ni forma de bloque, y ninguna carta nombra un juguete. Los juguetes son tuyos, los que tengas.',

      spellsTitle: 'Los hechizos que se cortaron',
      spells1: 'Una versión temprana dejaba inventar hechizos. Escribías uno, le ponías nombre, lo usabas. Era demasiado complicado de mantener, así que se fue.',
      spells2: 'En su lugar quedó la jugada que hacen los juegos de rol de mesa: devolvérselo al jugador en vez de escribir otra regla. Ninguna carta imprime su nombre, así que dices en voz alta cuál fue. Escape es la más clara de todas. La carta dice que te safaste y el jefe dice qué tan bien; dónde corriste y detrás de qué te escondiste lo inventas tú, y las reglas nunca preguntan.',
      spells3: 'La idea no está botada. Solo que todavía no tiene regla.',

      artTitle: 'El arte',
      artLead: 'Casi todo el arte de las cartas viene de The Noun Project, descargado bajo CC BY. La atribución es una condición de esa licencia, no un gesto de cortesía. La lista de abajo se lee de data/art-manifest.json cuando carga esta página, así que no puede alejarse de lo que imprimen las cartas.',
      artInHouse: 'El resto está dibujado en casa, sobre una grilla trazada de 24 por 24. Ese juego de glifos se dibujó primero, para poder probar e imprimir el mazo antes de que existiera arte. Las cartas de tamaño del jefe lo siguen usando a propósito: una figura que crece a lo largo de cinco cartas te dice cuál jefe es más grande, y cinco monstruos sueltos de banco de imágenes no.',
      artLoading: 'Leyendo el manifiesto de arte',
      artFail: 'data/art-manifest.json no cargó. Sirve la carpeta por HTTP (make serve) y recarga.',
      statCredited: 'íconos acreditados',
      statCreators: 'autores',
      statInHouse: 'espacios dibujados en casa',
      creditsNote: 'La misma lista se publica como CREDITS.md, generada del mismo archivo por tools/credits.py. Si le pasas este juego a alguien, esa página va con él.',
      cols: { icon: 'Ícono', use: 'Se usa para', creator: 'Autor', licence: 'Licencia', what: 'Qué' },

      licenceTitle: 'Licencia',
      licenceLead: 'Dos mitades, porque no pueden ser una.',
      licence: {
        codeWhat: 'Las reglas, los datos de las cartas, las herramientas, el código del sitio y todo el texto',
        codeIs: 'MIT',
        artWhat: 'Los íconos de art/',
        artIs: 'CC BY, según la tabla de arriba',
        glyphsWhat: 'Los glifos dibujados en casa',
        glyphsIs: 'MIT, original',
      },
      licenceNote: 'Un fork hereda la atribución. Esa es la parte que hay que saber antes de copiar la carpeta.',
    },
    footer: { version: 'v0.1.0' },
    chrome: {
      subtitle: 'Equilibra tu ataque y tu defensa',
      skip: 'Saltar al contenido',
      sections: 'Secciones',
      closeDialog: 'Cerrar el diálogo',
      footerNote: 'Las reglas y las cartas son MIT. El arte de las cartas es CC BY, acreditado en la página Acerca de. Las partidas se guardan solo en este dispositivo.',
    },
    common: {
      loading: 'Cargando las cartas',
      loadFail: 'Los datos de las cartas no cargaron. Sirve la carpeta por HTTP (make serve) y recarga.',
      close: 'Cerrar',
      print: 'Imprimir',
      copied: 'Copiado',
      placeholder: 'arte provisorio',
      sayIt: 'Dilo en voz alta',
    },
    cards: {
      title: 'Las cartas',
      lead: 'Ciento cinco cartas, tamaño póker, sin palabras en ninguna. El dibujo es el nombre, las esquinas llevan los números. Toca una carta para ver qué hace.',
      printAll: 'Imprimir las 105 (12 hojas)',
      printDeck: 'Imprimir este mazo',
      printing: 'Armando la hoja de impresión',
      paper: 'Papel',
      a4: 'A4',
      // El tamaño de papel Letter se deja en inglés a propósito: "carta" ya es
      // la palabra para card en todo el resto de la interfaz.
      letter: 'Letter',
      backs: { _: 'Reversos', none: 'sin reversos', few: '4 reversos', all: 'un reverso por carta' },
      filterAll: 'Todos los mazos',
      copies: 'copias',
      deck: { attack: 'Ataque', skill: 'Habilidades', class: 'Clases', advantage: 'Ventaja', boss: 'Jefes', biome: 'Biomas', life: 'Vida', mode: 'Modo suave', aid: 'Ayudas' },
      val: { betAny: 'las cartas En Pie que quieras', none: 'ninguna', lifeCard: 'carta de vida', lifeCards: 'cartas de vida', xBet: '4 × lo que apuestes', classOnly: 'solamente' },
      corner: { bet: 'Apuesta', check: 'Tirada', tier: 'Rango', damage: 'Daño', actions: 'Acciones', element: 'Elemento', class: 'Clase', effect: 'Efecto', passive: 'Pasiva', size: 'Tamaño', life: 'Cartas de vida', rage: 'Furia desde la ronda', rule: 'Regla', value: 'Vale', copies: 'Copias', icon: 'Glifo' },
      check: { none: 'siempre acierta', sure: 'Segura, 75%', even: 'Pareja, 50%', hard: 'Difícil, 25%', wild: 'Loca, 15%' },
      step: { sure: 'Segura', even: 'Pareja', hard: 'Difícil', wild: 'Loca' },
      sort: { _: 'Ordenar por', deck: 'Mazo', element: 'Elemento', tier: 'Rango', class: 'Clase', check: 'Riesgo', damage: 'Daño', name: 'Nombre' },
      element: { _: 'Elemento', all: 'Cualquier elemento', none: 'El tuyo' },
      tier: { _: 'Rango', all: 'Cualquier rango' },
      klass: { _: 'Clase', all: 'Cualquier clase', none: 'Para todas' },
      showBacks: 'Ver reversos',
      showFaces: 'Ver caras',
      reset: 'Limpiar filtros',
      empty: 'Ninguna carta calza con esos filtros.',
      face: 'Cara',
      back: 'Reverso',
      printOrder: 'La impresión siempre usa el orden de la caja, sin importar cómo esté ordenada esta lista.',
      // ── Los nombres de las cartas ────────────────────────────
      // Ninguna carta imprime su nombre: el nombre se dice en voz alta, así que
      // esta tabla es para gritarla. Va solo en `es`; en inglés manda
      // data/cards.json y cardName() cae ahí sola.
      name: {
        strike: 'Golpe', focus: 'Puntería', 'all-in': 'Todo o Nada', bubble: 'Burbuja', run: 'Escape',

        slash: 'Tajo', ember: 'Brasa', torrent: 'Torrente', tremor: 'Temblor', gale: 'Vendaval',
        piercer: 'Punzón', firebolt: 'Fogonazo', 'ice-spear': 'Lanza de Hielo', boulder: 'Peñasco', cyclone: 'Ciclón',
        'slash-wave': 'Onda Cortante', nova: 'Nova', 'cold-curse': 'Maldición Helada', earthquake: 'Terremoto', tempest: 'Tormenta',
        'soul-strike': 'Filo de Alma', pyre: 'Pira', maelstrom: 'Remolino', landslide: 'Derrumbe', thunderhead: 'Nubarrón',
        meteor: 'Meteoro', deluge: 'Diluvio', cataclysm: 'Cataclismo', hurricane: 'Huracán', reaper: 'Segador',

        knight: 'Caballero', mage: 'Mago', hunter: 'Cazador', necromancer: 'Nigromante',

        cure: 'Cura', barrier: 'Barrera', ally: 'Aliado', rune: 'Runa', relic: 'Reliquia', chest: 'Cofre',

        'boss-s': 'Esbirro', 'boss-m': 'Nivel 1', 'boss-l': 'Nivel 2', 'boss-l2': 'Nivel 3', 'boss-xl': 'Nivel 4', 'boss-um': 'Nivel 5',

        volcano: 'Volcán', river: 'Río', mountain: 'Montaña', desert: 'Desierto', forest: 'Bosque', village: 'Aldea', castle: 'Castillo',

        'life-fire': 'Fuego', 'life-water': 'Agua', 'life-earth': 'Tierra', 'life-wind': 'Viento', 'life-extra': 'Extra', 'life-boss': 'Jefe',

        'second-wind': 'Segundo Aire',

        'aid-checks': 'Puente de Dados', 'aid-turn': 'Orden del Turno', 'aid-boss': 'Reacciones del Jefe', 'aid-track': 'Pista de Daño',
      },
    },
    learn: {
      heroKicker: 'Un desafío de jefes para imprimir y jugar, para un jugador',
      heroTitle: 'Equilibra tu <em>ataque</em> y tu <em>defensa</em>.',
      heroLead: 'Arma el jefe con bloques. Juega tu héroe como una figura. Gasta cartas para atacar, guarda cartas para defender, y no seas ambicioso. Un dado, ciento cinco cartas, y los juguetes que ya están en la mesa.',
      ctaPlay: 'Jugar en pantalla',
      ctaCards: 'Imprimir las cartas',
      ctaFirst: 'Primera Partida: un jefe, cinco cartas',
      walkthroughKicker: 'Cómo se juega',
      rulebookTitle: 'El reglamento',
      rulebookLead: 'Las reglas completas, el mismo texto que viene con las cartas. Unos diez minutos de lectura.',
      rulebookFile: 'RULES.es.md',
      rulebookFail: 'RULES.es.md no cargó. Viene en el repositorio, al lado de esta página.',
      rulesRef: 'reglas §',
      bridgeTitle: 'Cualquier dado que tengas',
      bridgeLead: 'Busca tu fila. Tira. Iguala o supera el número. Tres d6 siguen a un d20 con menos de 1.2 puntos de diferencia en cada paso.',
      fidelityLead: 'Peor diferencia entre la probabilidad que dice un paso y la probabilidad real del dado:',
      fidelityUnit: 'puntos.',
      step: 'Paso',
      odds: 'Probabilidad',
      prev: 'Atrás',
      next: 'Siguiente',
      slideOf: 'de',
      contents: 'Contenido',
      deckHint: 'Usa las flechas, o desliza.',
      slide: { dice: 'Cualquier dado que tengas', rulebook: 'El reglamento' },
    },
    play: {
      title: 'Jugar',
      setupTitle: 'Prepara tu partida',
      firstGame: 'Primera Partida',
      firstGameLead: 'Solo el nivel 1, con Golpe, Puntería, Todo o Nada, Burbuja y Escape. Sin clases, sin habilidades, sin Ventaja. El juego entero ya está en esas cinco cartas.',
      fullRun: 'Partida completa',
      fullRunLead: 'Cinco jefes. Clases después del primero, una habilidad nueva después de cada nivel, cartas de Ventaja por el camino.',
      element: 'Tu elemento',
      die: 'Tu dado',
      mode: 'Modo',
      story: 'Cuento', standard: 'Normal', nightmare: 'Pesadilla',
      modeHint: { story: 'un escalón más fácil, para una primera partida o un jugador más chico', standard: 'la tabla tal como se imprime', nightmare: 'un escalón más difícil' },
      start: 'Empezar',
      resume: 'Seguir la partida',
      abandon: 'Abandonar la partida',
      level: 'Nivel',
      round: 'Ronda',
      boss: 'Jefe',
      bossLife: 'Vida del jefe',
      hero: 'Tú',
      minion: 'Esbirro',
      ready: 'En Pie', spent: 'De Lado', broken: 'Rota',
      actionsLeft: 'acciones restantes',
      target: 'Objetivo',
      body: 'el jefe',
      bet: 'Apuesta',
      betHint: 'Elige cuántas cartas En Pie vas a apostar.',
      needActions: 'necesita 2 acciones y a tu turno le quedan menos',
      needBet: 'necesita una carta de vida En Pie para apostar',
      roll: 'Tirar',
      typeRoll: 'o escribe tu tirada',
      need: 'necesitas',
      hit: '¡Acierto!', miss: 'Fallo',
      endTurn: 'Terminar el turno',
      bossTurn: 'El jefe actúa',
      bossRoll: 'El jefe tira',
      hide: 'Esconderse', move: 'Mover',
      reactionName: { brace: 'Aguante', strike: 'Golpe', summon: 'Invocación', roar: 'Rugido', ruin: 'Ruina' },
      what: {
        strike: 'Siempre acierta. 25 de daño por una acción y ninguna carta.',
        focus: 'Apuesta una carta de vida. 75 de daño si sale la tirada Segura, y la carta se gasta igual.',
        'all-in': 'Apuesta las cartas En Pie que quieras: 100 por cada una, a cara o sello. Cuesta dos de tus tres acciones.',
        bubble: 'Absorbe los próximos 25 que recibas esta ronda. Solo vale una acción bajo Furia: fuera de Furia una carta En Pie te cubre gratis y vuelve, así que la Burbuja no te compra nada.',
        run: 'Quedas Escondido hasta que el jefe actúe. Su Golpe pasa de largo y no te hace nada; todo lo demás igual te encuentra, pero solo por la mitad.',
      },
      hideHint: 'Gratis en el Bosque: quedas Escondido hasta que el jefe actúe.',
      hidden: 'Escondido',
      rage: 'Furia. Daño doble, sin defensa.',
      rageSoon: 'Furia la próxima ronda.',
      won: '¡El jefe cae!',
      lost: 'Estás Caído.',
      runWon: 'Pasaste los cinco niveles.',
      nextLevel: 'Siguiente nivel',
      newRun: 'Partida nueva',
      pickClass: 'Elige tu clase',
      draftTitle: 'Elige una habilidad',
      draftLead: 'Se destapan tres, te quedas con una.',
      advDraw: 'Robas una carta de Ventaja',
      advHand: 'Ventaja',
      playAdv: 'Jugar',
      useRune: 'Usar la Runa en esta tirada',
      reroll: 'Cazador: tira de nuevo',
      knight: 'Defensa de Caballero usada',
      barrierPrompt: '¿Juegas Barrera para cancelar esto?',
      letItHappen: 'Dejar que pase',
      log: 'Registro',
      logShow: 'Ver el registro', logHide: 'Ocultar el registro',
      // El jefe habla sobre su propia cabeza, no en el registro
      bossWatch: 'El jefe te mira.',
      aimedAtYou: 'apunta a ti',
      aimedAtAlly: 'apunta a tu Aliado',
      unguardable: 'no se puede defender',
      // La repisa: lo que ya tienes en juego
      shelf: 'En juego',
      relic: 'Reliquia', rune: 'Runa', bubbleSlot: 'Burbuja',
      // El número es ALLY_DEF en game/engine.js, no una palabra de acá: el
      // reglamento puede cambiarlo y este texto no tiene que salir a buscarse.
      ally: 'Aliado', allyDef: 'de defensa',
      allyGone: 'El Aliado se fue.',
      cover: 'Cubrir al Aliado',
      coverHint: 'Recibes el golpe tú, entero, y el Aliado se queda.',
      slotEmpty: 'vacío',
      // Las tres bandas del panel de acciones
      bandCards: 'Tus cartas', bandGo: 'Resolver',
      pickHint: 'el dado está esperando',
      placeholderNote: 'Los enemigos y los héroes son figuras provisorias hechas de bloques. El arte de verdad viene después.',
      // Segundo Aire, la carta del modo suave
      secondWind: 'Segundo Aire',
      secondWindHint: 'Una red de seguridad. La primera vuelta de cada nivel es gratis, después la tirada sube: Segura, Pareja, Difícil, Loca. Vuelves con 2 de tus cartas Rotas otra vez En Pie.',
      down: 'Estás Caído',
      downFree: 'Tu primera vuelta de este nivel es gratis.',
      downLadder: 'La vuelta pide',
      reviveTry: 'Intentar la vuelta',
      reviveGiveUp: 'Dejar que termine el nivel',
      // El carril del plan
      plan: 'Tu turno',
      planHint: 'Haz clic en una carta una vez por cada acción que quieras darle. Haz clic en un número para sacar ese paso.',
      planEmpty: 'Elige una carta. Tres acciones este turno.',
      resolvePlan: 'Resolver el turno',
      clearPlan: 'Limpiar',
      planStep: 'Paso',
      reaction: 'Reacción',
      reactionHint: 'Barrera espera acá a que el jefe actúe.',
      attachTo: 'unida al paso',
      tooManyActions: 'Eso es más que las acciones que quedan este turno.',
      notEnoughReady: 'Para ese paso ya no queda ninguna carta En Pie que apostar.',
      keys: '1 a 9 eligen carta · Enter resuelve · Retroceso deshace',
      // El resto de la mesa, a la vista pero sin jugar
      table: 'En la mesa',
      drawPile: 'Habilidades',
      advPile: 'Ventaja',
      extraPile: 'Vidas extra',
      biomeCard: 'Bioma',
      bossPile: 'Vida del jefe',
      faceDown: 'boca abajo',
      inTheBox: 'en la caja',
    },
    balance: {
      title: 'Balance',
      lead: 'El mismo motor que usa el juego en pantalla, jugado miles de veces por cuatro estilos de prueba. La tabla publicada en BALANCE.md sale de tools/sim.py con 20,000 peleas por celda; esta es para probar cosas.',
      trials: 'Peleas por celda',
      bonus: 'Bono de afinidad',
      run: 'Ejecutar',
      running: 'Ejecutando',
      stop: 'Detener',
      style: { turtle: 'tortuga', safe: 'prudente', adaptive: 'adaptable', gamble: 'arriesgada' },
      fightsPerCell: 'peleas por celda', runCompletion: 'Partidas de cinco niveles completadas en la línea adaptativa', thisRun: 'Esta corrida', rulebookRules: 'reglas del reglamento', legacyRules: 'reglas antiguas de tools/sim.py', bonus: 'de bono', publishedCaption: 'Publicado: docs/BALANCE.md, tools/sim.py, semilla 7, sin bono, sin clases, sin Ventaja', adaptiveCol: 'adaptativa',
      cols: { level: 'Nivel', win: 'victorias', rounds: 'rondas', broken: 'rotas' },
      legacy: 'Calzar exactamente con tools/sim.py',
      legacyHint: 'Reproduce tres simplificaciones que hace el simulador de Python (Aguante nunca parte a la mitad, Invocación mueve 100 fijos, Rugido aplana la siguiente tirada a Pareja) para poder revisar su tabla. Apagado, el motor juega el reglamento.',
      advantage: 'Mazo de Ventaja',
      klass: 'Clase',
      none: 'ninguna',
    },
  },
};

/** The languages the interface has a full table for, in the order the toggle shows them. */
export const LANGS = ['en', 'es'];

let lang = 'en';
export function setLang(l) { if (STRINGS[l]) lang = l; }
export function getLang() { return lang; }

/** t('play.start') -> 'Start'. Missing keys return the key, loudly. */
export function t(path) {
  const v = path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), STRINGS[lang]);
  return v === undefined ? `[${path}]` : v;
}

/**
 * The name a player says out loud for a card, in the current language.
 *
 * No card face prints its name, so this is a spoken label and nothing else. In
 * English it is data/cards.json's own `name`, which is why there is no English
 * name table to drift from it; in another language it is the overlay in that
 * language's `cards.name`, keyed by card id, falling back to the English name
 * so an untranslated card is still readable rather than a raw [key].
 */
/**
 * The five boss reactions as an id-to-name map for the current language. A
 * table, not a string, so it does not go through t(): t() is contracted to
 * return a STRING and tests/content.test.mjs enforces that by scanning every
 * call, which is a contract worth keeping rather than widening.
 */
export function reactionNames() {
  return { ...(STRINGS[lang]?.play?.reactionName || STRINGS.en.play.reactionName) };
}

export function cardName(card) {
  if (!card) return '';
  const table = STRINGS[lang]?.cards?.name;
  return (card.id && table?.[card.id]) || card.name || '';
}
