// Runs the batch table off the main thread. Message in: { data, opts, trials }.
// Messages out: { type: 'cell', cell, done, total } then { type: 'done', rows }.
import { useCards } from '../data/cards.js';
import { runTable } from './sim.js';

self.onmessage = (e) => {
  const { data, opts, trials } = e.data;
  const indexed = useCards(data);
  const rows = runTable(indexed, opts, trials, (cell, done, total) => self.postMessage({ type: 'cell', cell, done, total }));
  self.postMessage({ type: 'done', rows });
};
