import { SessionContext } from './recap.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HighlightRule {
  id: string;
  emoji: string;
  /** Returns the label string, or null to skip */
  label: (rolls: number[], ctx: SessionContext, playerName: string) => string | null;
  /** Returns the narrative text */
  generateText: (rolls: number[], ctx: SessionContext, playerName: string, displayName: string, rollDates?: string[]) => string;
  /** Returns the raw probability between 0 and 1 */
  rawProbability: (rolls: number[], ctx: SessionContext) => number;
  /** Returns a score from 0 to 1 */
  improbabilityScore: (rolls: number[], ctx: SessionContext) => number;
  /** Returns true if this highlight is applicable */
  isValid: (rolls: number[], ctx: SessionContext, playerName: string) => boolean;
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const sqDiffs = values.map(v => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((s, d) => s + d, 0) / values.length);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function formatList(items: any[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return String(items[0]);
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

export function longestConsecutiveRunDetails(rolls: number[], predicate: (r: number) => boolean): { max: number; values: number[]; startIndex: number } {
  let cur = 0, curStart = 0;
  let best = { max: 0, values: [] as number[], startIndex: 0 };
  for (let i = 0; i < rolls.length; i++) {
    if (predicate(rolls[i])) {
      if (cur === 0) curStart = i;
      cur++;
      if (cur > best.max) {
        best = { max: cur, values: rolls.slice(curStart, i + 1), startIndex: curStart };
      }
    } else {
      cur = 0;
    }
  }
  return best;
}

export function longestConsecutiveRun(rolls: number[], predicate: (r: number) => boolean): number {
  return longestConsecutiveRunDetails(rolls, predicate).max;
}

export function longestAlternatingRunDetails(rolls: number[]): { max: number; values: number[]; startIndex: number } {
  let count = 0, curStart = 0;
  let best = { max: 0, values: [] as number[], startIndex: 0 };
  for (let i = 0; i < rolls.length; i++) {
    const isHigh = rolls[i] >= 15;
    const isLow = rolls[i] <= 5;
    if (i === 0) {
      if (isHigh || isLow) { count = 1; curStart = 0; }
      else { count = 0; }
    } else if (count > 0) {
      const prevHigh = rolls[i - 1] >= 15;
      const prevLow = rolls[i - 1] <= 5;
      if ((isHigh && prevLow) || (isLow && prevHigh)) {
        count++;
      } else {
        if (count > best.max) {
          best = { max: count, values: rolls.slice(curStart, i), startIndex: curStart };
        }
        count = (isHigh || isLow) ? 1 : 0;
        curStart = i;
      }
    } else {
      if (isHigh || isLow) { count = 1; curStart = i; }
      else { count = 0; }
    }
    if (count > best.max) {
      best = { max: count, values: rolls.slice(curStart, i + 1), startIndex: curStart };
    }
  }
  return best;
}

export function longestAlternatingRun(rolls: number[]): number {
  return longestAlternatingRunDetails(rolls).max;
}

export function longestDuplicateRunDetails(rolls: number[]): { value: number; length: number; startIndex: number } {
  let best = { value: 0, length: 0, startIndex: 0 };
  let cur = { value: 0, length: 0, startIndex: 0 };
  for (let i = 0; i < rolls.length; i++) {
    const r = rolls[i];
    if (r === cur.value) { cur.length++; }
    else { cur = { value: r, length: 1, startIndex: i }; }
    if (cur.length > best.length) { best = { ...cur }; }
  }
  return best;
}

export function longestDuplicateRun(rolls: number[]): { value: number; length: number } {
  const d = longestDuplicateRunDetails(rolls);
  return { value: d.value, length: d.length };
}

export function longestStraightDetails(rolls: number[]): { max: number; values: number[]; startIndex: number } {
  let max = 1, cur = 1, curStart = 0;
  let best = { max: rolls.length > 0 ? 1 : 0, values: rolls.length > 0 ? [rolls[0]] : [], startIndex: 0 };
  for (let i = 1; i < rolls.length; i++) {
    const diff = rolls[i] - rolls[i - 1];
    if (diff === 1 || diff === -1) {
      if (cur === 1) {
        curStart = i - 1;
        cur++;
      } else {
        const prevDiff = rolls[i - 1] - rolls[i - 2];
        if ((diff > 0 && prevDiff > 0) || (diff < 0 && prevDiff < 0)) {
          cur++;
        } else {
          curStart = i - 1;
          cur = 2;
        }
      }
    } else {
      cur = 1;
    }
    if (cur > best.max) {
      best = { max: cur, values: rolls.slice(curStart, i + 1), startIndex: curStart };
    }
  }
  return best;
}

export function longestStraight(rolls: number[]): number {
  return longestStraightDetails(rolls).max;
}

export function luckPct(rolls: number[]): number {
  return rolls.filter(r => r >= 11).length / rolls.length;
}

export function formatDateStr(rawDate?: string): string {
  if (!rawDate) return '';
  const parts = rawDate.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return rawDate;
}

export function formatRollPosition(startIndex: number, totalRolls: number, rollDates?: string[]): string {
  const rollNum = startIndex + 1;
  let dateSuffix = '';
  if (rollDates && rollDates[startIndex]) {
    const d = formatDateStr(rollDates[startIndex]);
    if (d) dateSuffix = ` on ${d}`;
  }

  if (totalRolls <= 5) return `at roll #${rollNum}${dateSuffix}`;
  const ratio = rollNum / totalRolls;
  if (ratio <= 0.35) return `early in the session (roll #${rollNum})${dateSuffix}`;
  if (ratio >= 0.65) return `late in the session (roll #${rollNum})${dateSuffix}`;
  return `midway through the session (roll #${rollNum})${dateSuffix}`;
}

export function formatRollIndices(indices: number[], rollDates?: string[]): string {
  if (indices.length === 0) return '';
  const rollNums = indices.map(i => {
    const num = `#${i + 1}`;
    if (rollDates && rollDates[i]) {
      const d = formatDateStr(rollDates[i]);
      if (d) return `${num} on ${d}`;
    }
    return num;
  });
  if (rollNums.length === 1) return `roll ${rollNums[0]}`;
  if (rollNums.length === 2) return `rolls ${rollNums[0]} and ${rollNums[1]}`;
  return `rolls ${rollNums.slice(0, -1).join(', ')}, and ${rollNums[rollNums.length - 1]}`;
}

export function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function binomialTailProb(k: number, n: number, p: number): number {
  const mu = n * p;
  const sigma = Math.sqrt(n * p * (1 - p));
  if (sigma === 0) return k <= mu ? 1 : 0;
  const z = (k - 0.5 - mu) / sigma;
  return 1 - normalCDF(z);
}

export function pValueToScore(p: number): number {
  if (p >= 1) return 0.1;
  if (p <= 0) return 0.95;
  const logP = -Math.log10(Math.max(p, 1e-10));
  return Math.min(0.95, Math.max(0.1, 0.1 + logP * 0.25));
}

export function formatProbabilityPct(p: number): string {
  if (p >= 1) return '100%';
  if (p <= 0) return '<0.01%';
  const pct = p * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  if (pct >= 0.001) return `${pct.toFixed(3)}%`;
  return '<0.01%';
}

// ─── Rule Registry ─────────────────────────────────────────────────────────────

export const HIGHLIGHT_RULES: HighlightRule[] = [
  // ── Base Average (always present fallback) ──
  {
    id: 'base_average',
    emoji: '🎲',
    label: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `Average roll of ${avg.toFixed(1)} (${rolls.length} rolls)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} maintained a solid presence with an average roll of ${avg.toFixed(1)} across ${rolls.length} rolls.`;
    },
    rawProbability: () => 1.0,
    improbabilityScore: () => 0.1,
    isValid: (rolls) => rolls.length > 0,
  },

  // ── Highest Average ──
  {
    id: 'highest_avg',
    emoji: '👑',
    label: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `Highest average roll of ${avg.toFixed(1)}! 🌟`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} topped the board as our supreme roller, securing the highest average roll of ${avg.toFixed(1)}! The gods have favored their efforts.`;
    },
    rawProbability: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const z = (avg - 10.5) / (5.77 / Math.sqrt(rolls.length));
      return Math.max(1e-6, 1 - normalCDF(z));
    },
    improbabilityScore: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const z = (avg - 10.5) / (5.77 / Math.sqrt(rolls.length));
      return pValueToScore(1 - normalCDF(z));
    },
    isValid: (rolls, ctx, playerName) => ctx.highestAvgPlayer === playerName && rolls.length >= 3 && !!ctx.highestAvg,
  },

  // ── Lowest Average ──
  {
    id: 'lowest_avg',
    emoji: '💀',
    label: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `Lowest average roll of ${avg.toFixed(1)} 📉`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} grappled with the fickle whims of fate, landing the lowest average roll of ${avg.toFixed(1)}. A true trial of patience, but they fought through it!`;
    },
    rawProbability: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const z = (avg - 10.5) / (5.77 / Math.sqrt(rolls.length));
      return Math.max(1e-6, normalCDF(z));
    },
    improbabilityScore: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const z = (avg - 10.5) / (5.77 / Math.sqrt(rolls.length));
      return pValueToScore(normalCDF(z));
    },
    isValid: (rolls, ctx, playerName) => ctx.lowestAvgPlayer === playerName && rolls.length >= 3 && !!ctx.lowestAvg,
  },

  // ── Most Active Roller ──
  {
    id: 'most_rolls',
    emoji: '📖',
    label: (rolls) => `Most active roller with ${rolls.length} rolls`,
    generateText: (rolls, _ctx, _pn, dn) => {
      const sum = rolls.reduce((a, b) => a + b, 0);
      return `${dn} was the most active roller by far, casting the dice a massive ${rolls.length} times for a colossal total sum of ${sum}!`;
    },
    rawProbability: () => 0.25,
    improbabilityScore: () => 0.7,
    isValid: (rolls, ctx, playerName) => ctx.mostRollsPlayer === playerName && rolls.length > 15,
  },

  // ── Crit Master (both nat 20s and nat 1s) ──
  {
    id: 'crit_master_both',
    emoji: '⚡',
    label: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return `Crit Master (${n20} nat 20s, ${n1} nat 1s)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return `${dn} lived on the absolute edge, scoring ${n20} natural 20s and ${n1} critical failures! A wild, unpredictable rollercoaster of fate!`;
    },
    rawProbability: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return Math.max(1e-6, binomialTailProb(n20, rolls.length, 0.05) * binomialTailProb(n1, rolls.length, 0.05));
    },
    improbabilityScore: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return pValueToScore(binomialTailProb(n20, rolls.length, 0.05) * binomialTailProb(n1, rolls.length, 0.05));
    },
    isValid: (rolls) => rolls.filter(r => r === 20).length >= 2 && rolls.filter(r => r === 1).length >= 2,
  },

  // ── Crit King (nat 20s only) ──
  {
    id: 'crit_king_20s',
    emoji: '🔥',
    label: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      return `Crit King (${n20} nat 20s, 0 nat 1s)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      return `${dn} was on fire, scoring ${n20} natural 20s and avoiding critical failures entirely! Pure rolling excellence.`;
    },
    rawProbability: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      return Math.max(1e-6, binomialTailProb(n20, rolls.length, 0.05) * Math.pow(0.95, rolls.length));
    },
    improbabilityScore: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      return pValueToScore(binomialTailProb(n20, rolls.length, 0.05) * Math.pow(0.95, rolls.length));
    },
    isValid: (rolls) => rolls.filter(r => r === 20).length >= 2 && rolls.filter(r => r === 1).length === 0,
  },

  // ── Crit Fumbles (nat 1s only) ──
  {
    id: 'crit_fumble_1s',
    emoji: '🪵',
    label: (rolls) => {
      const n1 = rolls.filter(r => r === 1).length;
      return `Crit Fumbles (${n1} nat 1s, 0 nat 20s)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const n1 = rolls.filter(r => r === 1).length;
      return `${dn} faced tough odds, rolling ${n1} critical failures and failing to land a single natural 20. The dice gods were testing their resolve!`;
    },
    rawProbability: (rolls) => {
      const n1 = rolls.filter(r => r === 1).length;
      return Math.max(1e-6, binomialTailProb(n1, rolls.length, 0.05) * Math.pow(0.95, rolls.length));
    },
    improbabilityScore: (rolls) => {
      const n1 = rolls.filter(r => r === 1).length;
      return pValueToScore(binomialTailProb(n1, rolls.length, 0.05) * Math.pow(0.95, rolls.length));
    },
    isValid: (rolls) => rolls.filter(r => r === 1).length >= 2 && rolls.filter(r => r === 20).length === 0,
  },

  // ── Consistent Crusader ──
  {
    id: 'consistent_crusader',
    emoji: '🛡️',
    label: (rolls) => {
      const sd = stdDev(rolls);
      return `Consistent Crusader (rolls: ${Math.min(...rolls)}-${Math.max(...rolls)}, SD: ${sd.toFixed(1)})`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn}, ever the steady hand, kept rolls strictly between ${Math.min(...rolls)} and ${Math.max(...rolls)} (average ${avg.toFixed(1)}). Not a single 1 or 20 in sight, showing remarkable consistency in the face of chaos!`;
    },
    rawProbability: (rolls) => Math.max(1e-6, Math.pow(0.9, rolls.length)),
    improbabilityScore: (rolls) => pValueToScore(Math.pow(0.9, rolls.length)),
    isValid: (rolls) => rolls.length >= 5 && rolls.filter(r => r === 1).length === 0 && rolls.filter(r => r === 20).length === 0,
  },

  // ── Missing Numbers ──
  {
    id: 'missing_numbers',
    emoji: '🧙‍♂️',
    label: (rolls) => {
      const rolled = new Set(rolls);
      const K = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n)).length;
      const odds = Math.pow((20 - K) / 20, rolls.length);
      return `Missed ${K} numbers (1 in ${Math.round(1 / odds).toLocaleString()} odds)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const rolled = new Set(rolls);
      const missing = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n));
      const display = missing.slice(0, 10);
      const suffix = missing.length > 10 ? ' among others' : '';
      const odds = Math.pow((20 - missing.length) / 20, rolls.length);
      return `${dn} managed to complete the session without rolling a single ${formatList(display)}${suffix} across ${rolls.length} rolls. The mathematical odds of avoiding those numbers are roughly 1 in ${Math.round(1 / odds).toLocaleString()}!`;
    },
    rawProbability: (rolls) => {
      const rolled = new Set(rolls);
      const K = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n)).length;
      return Math.max(1e-6, Math.pow((20 - K) / 20, rolls.length));
    },
    improbabilityScore: (rolls) => {
      const rolled = new Set(rolls);
      const K = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n)).length;
      return pValueToScore(Math.pow((20 - K) / 20, rolls.length));
    },
    isValid: (rolls) => {
      if (rolls.length < 6) return false;
      const rolled = new Set(rolls);
      const K = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n)).length;
      return K >= 8 && Math.pow((20 - K) / 20, rolls.length) < 0.1;
    },
  },

  // ── Hot Streak / Heater ──
  {
    id: 'hot_streak',
    emoji: '🔥',
    label: (rolls) => {
      const run = longestConsecutiveRun(rolls, r => r >= 15);
      return `Hot Streak! ${run} consecutive rolls ≥ 15`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r >= 15);
      return `${dn} hit an incredible hot streak, landing ${run} consecutive rolls of 15 or higher! When the dice are on fire, you don't stop rolling!`;
    },
    rawProbability: (rolls) => Math.max(1e-6, Math.pow(0.3, longestConsecutiveRun(rolls, r => r >= 15))),
    improbabilityScore: (rolls) => pValueToScore(Math.pow(0.3, longestConsecutiveRun(rolls, r => r >= 15))),
    isValid: (rolls) => longestConsecutiveRun(rolls, r => r >= 15) >= 3,
  },

  // ── Cold Snap ──
  {
    id: 'cold_snap',
    emoji: '🥶',
    label: (rolls) => {
      const run = longestConsecutiveRun(rolls, r => r <= 5);
      return `Cold Snap! ${run} consecutive rolls ≤ 5`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r <= 5);
      return `${dn} endured a brutal cold snap, suffering ${run} consecutive rolls of 5 or lower. Sometimes fate just isn't on your side!`;
    },
    rawProbability: (rolls) => Math.max(1e-6, Math.pow(0.25, longestConsecutiveRun(rolls, r => r <= 5))),
    improbabilityScore: (rolls) => pValueToScore(Math.pow(0.25, longestConsecutiveRun(rolls, r => r <= 5))),
    isValid: (rolls) => longestConsecutiveRun(rolls, r => r <= 5) >= 3,
  },

  // ── Yo-Yo Roller ──
  {
    id: 'bipolar_roller',
    emoji: '🎭',
    label: (rolls) => {
      const run = longestAlternatingRun(rolls);
      return `Yo-Yo Roller! ${run} alternating high/low rolls`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const run = longestAlternatingRun(rolls);
      return `${dn} was the ultimate wildcard, swinging between extremes with ${run} alternating high (≥15) and low (≤5) rolls! A truly chaotic energy at the table.`;
    },
    rawProbability: (rolls) => Math.max(1e-6, Math.pow(0.075, Math.floor(longestAlternatingRun(rolls) / 2))),
    improbabilityScore: (rolls) => pValueToScore(Math.pow(0.075, Math.floor(longestAlternatingRun(rolls) / 2))),
    isValid: (rolls) => longestAlternatingRun(rolls) >= 3,
  },

  // ── Glass Half Full (upward trend) ──
  {
    id: 'glass_half_full',
    emoji: '📈',
    label: (rolls) => {
      const mid = Math.floor(rolls.length / 2);
      const firstHalfLuck = luckPct(rolls.slice(0, mid));
      const secondHalfLuck = luckPct(rolls.slice(mid));
      const gain = ((secondHalfLuck - firstHalfLuck) * 100).toFixed(0);
      return `Glass Half Full (+${gain}% luck in 2nd half)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `${dn} started slow but finished strong! Their luck surged from ${firstPct}% in the first half to ${secondPct}% in the second half. A classic comeback story written in dice!`;
    },
    rawProbability: (rolls) => {
      const mid = Math.floor(rolls.length / 2);
      const secondHalf = rolls.slice(mid);
      const luckyCount = secondHalf.filter(r => r >= 11).length;
      return Math.max(1e-6, binomialTailProb(luckyCount, secondHalf.length, 0.5));
    },
    improbabilityScore: (rolls) => {
      const mid = Math.floor(rolls.length / 2);
      const secondHalf = rolls.slice(mid);
      const luckyCount = secondHalf.filter(r => r >= 11).length;
      return pValueToScore(binomialTailProb(luckyCount, secondHalf.length, 0.5));
    },
    isValid: (rolls) => {
      if (rolls.length < 6) return false;
      const mid = Math.floor(rolls.length / 2);
      const diff = luckPct(rolls.slice(mid)) - luckPct(rolls.slice(0, mid));
      return diff >= 0.25;
    },
  },

  // ── Downward Spiral ──
  {
    id: 'downward_spiral',
    emoji: '📉',
    label: (rolls) => {
      const mid = Math.floor(rolls.length / 2);
      const firstHalfLuck = luckPct(rolls.slice(0, mid));
      const secondHalfLuck = luckPct(rolls.slice(mid));
      const drop = ((firstHalfLuck - secondHalfLuck) * 100).toFixed(0);
      return `Downward Spiral (−${drop}% luck in 2nd half)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `${dn} started the session riding high at ${firstPct}% luck, but fate turned cruel in the second half, dropping to just ${secondPct}%. The dice giveth, and the dice taketh away.`;
    },
    rawProbability: (rolls) => {
      const mid = Math.floor(rolls.length / 2);
      const firstHalf = rolls.slice(0, mid);
      const luckyCount = firstHalf.filter(r => r >= 11).length;
      return Math.max(1e-6, binomialTailProb(luckyCount, firstHalf.length, 0.5));
    },
    improbabilityScore: (rolls) => {
      const mid = Math.floor(rolls.length / 2);
      const firstHalf = rolls.slice(0, mid);
      const luckyCount = firstHalf.filter(r => r >= 11).length;
      return pValueToScore(binomialTailProb(luckyCount, firstHalf.length, 0.5));
    },
    isValid: (rolls) => {
      if (rolls.length < 6) return false;
      const mid = Math.floor(rolls.length / 2);
      const diff = luckPct(rolls.slice(0, mid)) - luckPct(rolls.slice(mid));
      return diff >= 0.25;
    },
  },

  // ── Median Maverick ──
  {
    id: 'median_maverick',
    emoji: '🃏',
    label: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      return `Median Maverick (avg ${avg.toFixed(1)} vs median ${med})`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      const direction = avg > med ? 'a few massive rolls pulling their average skyward' : 'a handful of devastating low rolls dragging them down';
      return `${dn} is a statistical enigma! Their average of ${avg.toFixed(1)} tells a very different story from their median of ${med}, thanks to ${direction}. The outliers defined their session!`;
    },
    rawProbability: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      const z = Math.abs(avg - med) * Math.sqrt(rolls.length) / 5.77;
      return Math.max(1e-6, 2 * (1 - normalCDF(z)));
    },
    improbabilityScore: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      const z = Math.abs(avg - med) * Math.sqrt(rolls.length) / 5.77;
      return pValueToScore(2 * (1 - normalCDF(z)));
    },
    isValid: (rolls) => {
      if (rolls.length < 6) return false;
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      return Math.abs(avg - med) >= 3;
    },
  },

  // ── Broken Record ──
  {
    id: 'broken_record',
    emoji: '🔁',
    label: (rolls) => {
      const dup = longestDuplicateRun(rolls);
      return `Broken Record! Rolled ${dup.value} ${dup.length}× in a row`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const dup = longestDuplicateRun(rolls);
      const odds = Math.round(Math.pow(20, dup.length - 1));
      return `${dn} got stuck in a loop, rolling a ${dup.value} an astonishing ${dup.length} times in a row! The odds of this for any specific number are roughly 1 in ${odds.toLocaleString()}!`;
    },
    rawProbability: (rolls) => Math.max(1e-6, Math.pow(1 / 20, longestDuplicateRun(rolls).length - 1)),
    improbabilityScore: (rolls) => pValueToScore(Math.pow(1 / 20, longestDuplicateRun(rolls).length - 1)),
    isValid: (rolls) => longestDuplicateRun(rolls).length >= 3,
  },

  // ── Perfect Sequence (Straight) ──
  {
    id: 'perfect_sequence',
    emoji: '🎰',
    label: (rolls) => {
      const run = longestStraight(rolls);
      return `Perfect Sequence! ${run}-roll straight`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const run = longestStraight(rolls);
      const odds = Math.round(Math.pow(20, run - 1) / Math.pow(2, run - 1));
      return `${dn} defied probability by rolling a perfect ${run}-number straight sequence! The mathematical odds of landing this are approximately 1 in ${odds.toLocaleString()}!`;
    },
    rawProbability: (rolls) => Math.max(1e-6, Math.pow(0.1, longestStraight(rolls) - 1)),
    improbabilityScore: (rolls) => pValueToScore(Math.pow(0.1, longestStraight(rolls) - 1)),
    isValid: (rolls) => longestStraight(rolls) >= 3,
  },

  // ── Bookends ──
  {
    id: 'bookends',
    emoji: '📚',
    label: (rolls) => `Bookends! First & last roll: ${rolls[0]}`,
    generateText: (rolls, _ctx, _pn, dn) => {
      return `${dn} rolled a perfect bookend, starting and ending the session with the same roll: ${rolls[0]}! A poetic symmetry that the dice gods clearly orchestrated.`;
    },
    rawProbability: () => 0.05,
    improbabilityScore: () => pValueToScore(0.05),
    isValid: (rolls) => rolls.length >= 5 && rolls[0] === rolls[rolls.length - 1],
  },

  // ── Agent of Chaos (High Variance) ──
  {
    id: 'agent_of_chaos',
    emoji: '🌪️',
    label: (rolls) => {
      const sd = stdDev(rolls);
      return `Agent of Chaos (SD: ${sd.toFixed(1)}, expected: ~5.8)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const sd = stdDev(rolls);
      return `${dn} was the session's agent of chaos with a standard deviation of ${sd.toFixed(1)} (well above the expected ~5.8 for a d20). They rolled at the extremes, avoiding the middle ground entirely!`;
    },
    rawProbability: (rolls) => {
      const sd = stdDev(rolls);
      const z = (sd - 5.77) / (5.77 / Math.sqrt(2 * rolls.length));
      return Math.max(0.001, 1 - normalCDF(z));
    },
    improbabilityScore: (rolls) => Math.min(0.85, 0.5 + (stdDev(rolls) - 5.77) * 0.3),
    isValid: (rolls) => rolls.length >= 6 && stdDev(rolls) >= 6.5,
  },

  // ── True Neutral ──
  {
    id: 'true_neutral',
    emoji: '⚖️',
    label: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `True Neutral (avg ${avg.toFixed(2)} ≈ 10.5)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} achieved near-statistical perfection with an average of ${avg.toFixed(2)} across ${rolls.length} rolls—remarkably close to the mathematical mean of 10.5. Balance in all things!`;
    },
    rawProbability: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const z = Math.abs(avg - 10.5) / (5.77 / Math.sqrt(rolls.length));
      return Math.max(0.01, 2 * (1 - normalCDF(z)));
    },
    improbabilityScore: (rolls) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return Math.min(0.85, 0.6 + (1 - Math.abs(avg - 10.5) / 0.5) * 0.2);
    },
    isValid: (rolls) => {
      if (rolls.length < 8) return false;
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return avg >= 10.2 && avg <= 10.8;
    },
  },

  // ── Fortune Blessed ──
  {
    id: 'fortune_blessed',
    emoji: '🍀',
    label: (rolls) => {
      const luck = (luckPct(rolls) * 100).toFixed(0);
      return `Fortune Blessed (${luck}% lucky rolls)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const luck = (luckPct(rolls) * 100).toFixed(0);
      return `${dn} was blessed by fortune with ${luck}% of their rolls landing at 11 or above! Lady Luck was clearly in their corner.`;
    },
    rawProbability: (rolls) => {
      const luckyCount = rolls.filter(r => r >= 11).length;
      return Math.max(1e-6, binomialTailProb(luckyCount, rolls.length, 0.5));
    },
    improbabilityScore: (rolls) => {
      const luckyCount = rolls.filter(r => r >= 11).length;
      return pValueToScore(binomialTailProb(luckyCount, rolls.length, 0.5));
    },
    isValid: (rolls) => rolls.length >= 8 && luckPct(rolls) >= 0.65,
  },

  // ── Fortune Cursed ──
  {
    id: 'fortune_cursed',
    emoji: '😈',
    label: (rolls) => {
      const luck = (luckPct(rolls) * 100).toFixed(0);
      return `Fortune Cursed (only ${luck}% lucky rolls)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const luck = (luckPct(rolls) * 100).toFixed(0);
      return `${dn} was cursed by the dice gods — only ${luck}% of their rolls hit 11 or above. A truly unlucky session!`;
    },
    rawProbability: (rolls) => {
      const unluckyCount = rolls.filter(r => r <= 10).length;
      return Math.max(1e-6, binomialTailProb(unluckyCount, rolls.length, 0.5));
    },
    improbabilityScore: (rolls) => {
      const unluckyCount = rolls.filter(r => r <= 10).length;
      return pValueToScore(binomialTailProb(unluckyCount, rolls.length, 0.5));
    },
    isValid: (rolls) => rolls.length >= 8 && luckPct(rolls) <= 0.35,
  },

  // ── Nat 20 Magnet ──
  {
    id: 'nat20_magnet',
    emoji: '✨',
    label: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      const rate = (n20 / rolls.length * 20).toFixed(1);
      return `Nat 20 Magnet (${rate} per 20 rolls, expected 1.0)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      const rate = (n20 / rolls.length * 20).toFixed(1);
      return `${dn} pulled nat 20s at an extraordinary rate of ${rate} per 20 rolls (expected: 1.0), landing ${n20} total across ${rolls.length} rolls! Are those dice loaded?`;
    },
    rawProbability: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      return Math.max(1e-6, binomialTailProb(n20, rolls.length, 0.05));
    },
    improbabilityScore: (rolls) => {
      const n20 = rolls.filter(r => r === 20).length;
      return pValueToScore(binomialTailProb(n20, rolls.length, 0.05));
    },
    isValid: (rolls) => {
      if (rolls.length < 10) return false;
      const n20 = rolls.filter(r => r === 20).length;
      return (n20 / rolls.length * 20) >= 2.0;
    },
  },

  // ── Nat 1 Magnet ──
  {
    id: 'nat1_magnet',
    emoji: '💥',
    label: (rolls) => {
      const n1 = rolls.filter(r => r === 1).length;
      const rate = (n1 / rolls.length * 20).toFixed(1);
      return `Nat 1 Magnet (${rate} per 20 rolls, expected 1.0)`;
    },
    generateText: (rolls, _ctx, _pn, dn) => {
      const n1 = rolls.filter(r => r === 1).length;
      const rate = (n1 / rolls.length * 20).toFixed(1);
      return `${dn} attracted nat 1s like a magnet — ${rate} per 20 rolls (expected: 1.0), with ${n1} critical failures across ${rolls.length} rolls! The dice clearly had a grudge.`;
    },
    rawProbability: (rolls) => {
      const n1 = rolls.filter(r => r === 1).length;
      return Math.max(1e-6, binomialTailProb(n1, rolls.length, 0.05));
    },
    improbabilityScore: (rolls) => {
      const n1 = rolls.filter(r => r === 1).length;
      return pValueToScore(binomialTailProb(n1, rolls.length, 0.05));
    },
    isValid: (rolls) => {
      if (rolls.length < 10) return false;
      const n1 = rolls.filter(r => r === 1).length;
      return (n1 / rolls.length * 20) >= 2.0;
    },
  },
];
