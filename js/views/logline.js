// ── The fight log's Spanish, at the display seam ─────────────
// The engine writes its log in English BY DESIGN: js/game/engine.js is shared
// with the simulator and tests/engine.test.mjs pins exact lines, so the engine
// is the parity layer and stays monolingual. Translation is a display concern
// and happens here, on the way to the DOM (the log panel, the log-tick, the
// boss bubble). A line no pattern knows passes through unchanged: worst case a
// Spanish player reads one English sentence, never a broken one.
//
// DISCIPLINE: a new say() line in the engine needs a pattern here and a sample
// in tests/logline.test.mjs. The test's sample list is the coverage contract.
import { getLang, STRINGS } from '../strings.js';

/**
 * EN -> ES for the names that ride inside log lines: card names ("Focus fells
 * a minion"), reaction names ("Barrier cancels the boss's Roar"), signature
 * names. Built once at boot from the loaded card data plus the ES string
 * table, injected here so this module needs no data dependency of its own.
 */
let NAMES = {};
export function setLogNames(data) {
  const es = STRINGS.es;
  NAMES = {};
  for (const c of Object.values(data.byId || {})) {
    const localized = es.cards?.name?.[c.id];
    if (c.name && localized && localized !== c.name) NAMES[c.name] = localized;
  }
  for (const table of ['reactionName', 'signatureName']) {
    const en = STRINGS.en.play?.[table] || {};
    const esT = es.play?.[table] || {};
    for (const [id, name] of Object.entries(en)) if (esT[id]) NAMES[name] = esT[id];
  }
  NAMES.Ally = 'El Aliado';
}
const name = (n) => NAMES[n] || n;

/** Ordered: specific shapes before generic ones. $1-style groups carry through. */
const ES = [
  [/^Round (\d+)\. (\d+) Ready\.$/, (m) => `Ronda ${m[1]}. ${m[2]} En Pie.`],
  [/^Rage: double damage, no guard\.$/, () => 'Furia: daño doble, sin defensa.'],
  [/^Rage next round\.$/, () => 'Furia la próxima ronda.'],
  [/^Bubble: the next (\d+) damage is absorbed\.$/, (m) => `Burbuja: los próximos ${m[1]} de daño se absorben.`],
  [/^Taunt: the boss will roll (\d+)\.$/, (m) => `Provocación: el jefe sacará ${m[1]}.`],
  [/^Run: you are Hidden\. The boss has to find you\.$/, () => 'Escape: estás Escondido. El jefe tiene que encontrarte.'],
  [/^(.+?)( \(bet (\d+)\))?: (lands|hit|miss)(, (\d+) damage)?\.$/, (m) => {
    const verb = m[4] === 'lands' ? 'acierta solo' : m[4] === 'hit' ? 'acierta' : 'falla';
    return `${name(m[1])}${m[3] ? ` (apuesta ${m[3]})` : ''}: ${verb}${m[6] ? `, ${m[6]} de daño` : ''}.`;
  }],
  [/^Reroll: hit, (\d+) damage\.$/, (m) => `Repetición: acierta, ${m[1]} de daño.`],
  [/^Reroll: miss\.$/, () => 'Repetición: falla.'],
  [/^It was off balance: \+25\.$/, () => 'Estaba desequilibrado: +25.'],
  [/^(.+?) fells a minion\.$/, (m) => `${name(m[1])} tumba un esbirro.`],
  [/^Necromancer takes one of its cards as a Ready life card\.$/, () => 'El Nigromante toma una de sus cartas como carta de vida En Pie.'],
  [/^The boss falls!$/, () => '¡El jefe cae!'],
  [/^The comeback fails\. You are Down\.$/, () => 'La remontada falla. Estás Caído.'],
  [/^Second Wind holds! Back up with 2 cards\.$/, () => '¡Segundo Aire aguanta! De vuelta con 2 cartas.'],
  [/^Second Wind: you come back free\.$/, () => 'Segundo Aire: vuelves gratis.'],
  [/^You slip into the trees\. The boss has to find you\.$/, () => 'Te deslizas entre los árboles. El jefe tiene que encontrarte.'],
  [/^Cure: two Broken cards return to Ready\.$/, () => 'Cura: dos cartas Rotas vuelven a En Pie.'],
  [/^Ally: a companion joins, Strikes for 25 each turn and draws the boss's Strike behind (\d+) defense\.$/,
    (m) => `Aliado: un compañero se une, Golpea por 25 cada turno y atrae el Golpe del jefe tras ${m[1]} de defensa.`],
  [/^Rune: one check this level succeeds automatically\.$/, () => 'Runa: una tirada de este nivel acierta automáticamente.'],
  [/^Relic: every landed attack deals \+25 this level\.$/, () => 'Reliquia: cada ataque que acierte hace +25 este nivel.'],
  [/^Chest: draw two more Advantage cards\.$/, () => 'Cofre: roba dos cartas de Ventaja más.'],
  [/^A minion strikes for 25\.$/, () => 'Un esbirro golpea por 25.'],
  [/^The Ally takes it: (\d+) defense absorbs all (\d+)\.$/, (m) => `El Aliado lo recibe: ${m[1]} de defensa absorbe los ${m[2]}.`],
  [/^The Ally covers you and falls: (\d+) was more than its (\d+) defense\.$/, (m) => `El Aliado te cubre y cae: ${m[1]} fue más que sus ${m[2]} de defensa.`],
  // Reaction nouns are gendered (el Golpe, la Ruina), so the frame names the
  // move after a neutral colon instead of guessing articles.
  [/^Barrier cancels the boss's (.+)\.$/, (m) => `Barrera cancela la reacción del jefe: ${name(m[1])}.`],
  [/^The boss Braces: no damage, and it halves what it takes until the end of your next turn\.$/,
    () => 'El jefe Aguanta: sin daño, y recibe la mitad hasta el final de tu próximo turno.'],
  [/^The boss Summons: (\d+) of its life moves under a minion\.$/, (m) => `El jefe Invoca: ${m[1]} de su vida pasa bajo un esbirro.`],
  [/^Skitter: it darts aside, no damage, and it is off balance\. Your next landed hit deals \+25\.$/,
    () => 'Correteo: se hace a un lado, sin daño, y queda desequilibrado. Tu próximo acierto hace +25.'],
  [/^Coil: (\d+) of its life moves under a minion, and the minion strikes at once\.$/,
    (m) => `Enroscada: ${m[1]} de su vida pasa bajo un esbirro, y el esbirro golpea de inmediato.`],
  [/^Bedrock: it braces, and 25 of its wall grinds back into place\.$/,
    () => 'Cimiento: aguanta, y 25 de su muro vuelve a su lugar.'],
  [/^Stormbreak! Ruin: (\d+)\.( No card of yours is standing: it Ruins AGAIN\.)?$/,
    (m) => `¡Rompetormentas! Ruina: ${m[1]}.${m[2] ? ' Ninguna carta tuya sigue en pie: hace Ruina OTRA VEZ.' : ''}`],
  [/^Hoard: the boss deals nothing\. It is busy pocketing your life\.$/,
    () => 'Botín: el jefe no hace daño. Está ocupado embolsándose tu vida.'],
  [/^It steals a Ready life card: gone for the level, and its 25 joins the wall\.$/,
    () => 'Roba una carta de vida En Pie: perdida por el nivel, y sus 25 se suman al muro.'],
  [/^Hoard: nothing standing to steal\. It Roars for (\d+) instead\.$/,
    (m) => `Botín: nada en pie que robar. Ruge por ${m[1]} en su lugar.`],
  [/^The boss Roars for (\d+)\. Your next check is one step harder\.$/,
    (m) => `El jefe Ruge por ${m[1]}. Tu próxima tirada es un paso más difícil.`],
  [/^Ruin! The boss deals (\d+)\.$/, (m) => `¡Ruina! El jefe hace ${m[1]}.`],
  [/^The boss Strikes at the Ally for (\d+)\.$/, (m) => `El jefe Golpea al Aliado por ${m[1]}.`],
  [/^The boss Strikes for (\d+)\.$/, (m) => `El jefe Golpea por ${m[1]}.`],
  [/^You break cover to shield the Ally\.$/, () => 'Rompes tu escondite para proteger al Aliado.'],
  [/^You cover the Ally and take it whole\.$/, () => 'Cubres al Aliado y lo recibes entero.'],
  [/^Castle: the boss acts again\. You catch your breath between swings\.$/,
    () => 'Castillo: el jefe actúa de nuevo. Recuperas el aliento entre golpes.'],
  [/^Hidden: the Strike goes past you\. No damage\.$/, () => 'Escondido: el Golpe pasa de largo. Sin daño.'],
  [/^Hidden: Ruin finds you anyway, halved to (\d+)\.$/, (m) => `Escondido: la Ruina te encuentra igual, a la mitad: ${m[1]}.`],
  [/^Hidden: it finds you anyway, halved to (\d+)\.$/, (m) => `Escondido: te encuentra igual, a la mitad: ${m[1]}.`],
  [/^Bubble absorbs (\d+)\.$/, (m) => `Burbuja absorbe ${m[1]}.`],
  [/^Knight guards 25 for free\.$/, () => 'El Caballero defiende 25 gratis.'],
  [/^Guarded (\d+) with (\d+) Ready cards?; they return next round\.$/,
    (m) => `Defendiste ${m[1]} con ${m[2]} ${m[2] === '1' ? 'carta En Pie' : 'cartas En Pie'}; vuelven la próxima ronda.`],
  [/^You are Down\. Second Wind\?$/, () => 'Estás Caído. ¿Segundo Aire?'],
  [/^You are Down\.$/, () => 'Estás Caído.'],
  [/^(\d+) Broken\.$/, (m) => `${m[1]} Rotas.`],
];

/** One engine log line, in the page's language. Unknown lines pass through. */
export function logLine(text) {
  if (getLang() !== 'es' || !text) return text;
  for (const [re, fn] of ES) {
    const m = re.exec(text);
    if (m) return fn(m);
  }
  return text;
}
