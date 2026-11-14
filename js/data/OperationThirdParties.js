/* Counted non-combatants of each catalogue operation (HW-DEC-90, HW-DEC-100).
 * Read from the preserved audit text `thirdParties`; nothing is invented: an operation
 * whose text gives no figure has no population. These people are outside every combat
 * budget, kill quota and morale rule. */
import { PLAYABLE_OPERATIONS } from './BattleCatalog.js';

const WORDS = Object.freeze({ deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, seize: 16, vingt: 20 });
const number = token => /^\d+$/.test(token) ? Number(token) : WORDS[token.toLowerCase()] ?? null;
const SPECIES = [[/clan/i, 'yautja'], [/spinner/i, 'spinner'], [/synth/i, 'synthetic']];

/** Parses one audit sentence; returns null when no population is counted. */
export function parseThirdParties(text) {
  if (typeof text !== 'string' || /^aucun (combattant tiers ni civil|quatrième camp)/i.test(text.trim())) return null;
  const head = /^(\d+|[A-Za-zÀ-ÿ]+) ((?:[^,;:(]|\((?!\d))+?)(?= \(|,|;|:| en | dont | et \d| hors|\.|$)/.exec(text.trim());
  if (!head) return null;
  const count = number(head[1]);
  if (!Number.isInteger(count) || count <= 0) return null;
  const active = /(\d+|[A-Za-zÀ-ÿ]+) (?:actifs au plus|au plus actifs)|au maximum (\d+) actifs|(\d+) actifs au plus/i.exec(text);
  const maxActive = active ? number(active[1] ?? active[2] ?? active[3]) : null;
  const label = head[2].trim();
  return Object.freeze({ count, maxActive: Number.isInteger(maxActive) ? Math.min(maxActive, count) : Math.min(8, count), label,
    species: SPECIES.find(([pattern]) => pattern.test(label))?.[1] ?? 'human', source: text });
}

export const OPERATION_THIRD_PARTIES = Object.freeze(Object.fromEntries(PLAYABLE_OPERATIONS
  .map(operation => [operation.id, parseThirdParties(operation.thirdParties)]).filter(([, value]) => value)));

export const operationThirdParties = operationId => OPERATION_THIRD_PARTIES[operationId] ?? null;
