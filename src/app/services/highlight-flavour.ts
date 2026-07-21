import type { SessionContext } from './recap.service';
import {
  stdDev, median, formatList,
  longestConsecutiveRun, longestAlternatingRun,
  longestDuplicateRun, longestStraight, luckPct,
} from './highlight-rules';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TextGenerator = (
  rolls: number[],
  ctx: SessionContext,
  playerName: string,
  displayName: string,
) => string;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Pick a random element from a non-empty array */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Award Titles ──────────────────────────────────────────────────────────────
//
// Each highlight rule maps to an array of short, punchy award titles that can be
// shown as a badge or heading in the recap. One is picked at random per recap.

export const HIGHLIGHT_TITLES: Record<string, string[]> = {
  base_average: [
    'Steady Roller',
    'The Reliable',
    'Dice Regular',
    'Holding the Line',
    'Middle of the Pack',
  ],
  highest_avg: [
    'Supreme Roller',
    'The Chosen One',
    'Golden Touch',
    'Dice Whisperer',
    "Fortune's Favourite",
  ],
  lowest_avg: [
    "Fate's Punching Bag",
    'Cursed Dice',
    'The Underdog',
    'Trial by Fire',
    'Hard Luck Hero',
  ],
  most_rolls: [
    'Dice Machine',
    'Roll Addict',
    'The Unstoppable',
    'Dice Hog',
    'Action Junkie',
  ],
  crit_master_both: [
    'Crit Master',
    'Edge Walker',
    "Fortune's Gambit",
    'Hero of Chaos',
    'The Extremist',
  ],
  crit_king_20s: [
    'Crit Royalty',
    'Golden Dice',
    'Nat 20 Machine',
    'The Anointed',
    'Blessed by RNGesus',
  ],
  crit_fumble_1s: [
    'Fumble Royalty',
    'Cursed Hands',
    'Snake Eyes',
    'The Jinxed',
    'Rock Bottom',
  ],
  consistent_crusader: [
    'The Metronome',
    'Steady as Stone',
    'Consistent Crusader',
    'The Predictable',
    'Iron Will',
  ],
  missing_numbers: [
    'Number Dodger',
    'Gap Artist',
    'Statistical Anomaly',
    'Void Walker',
    'The Selective',
  ],
  hot_streak: [
    'On Fire',
    'Blaze Runner',
    'Untouchable',
    'Scorching Streak',
    'The Furnace',
  ],
  cold_snap: [
    'Frozen Fate',
    'Ice Age',
    'The Deep Freeze',
    'Frostbitten',
    "Winter's Grip",
  ],
  bipolar_roller: [
    'The Pendulum',
    'Yo-Yo Roller',
    'Jekyll & Hyde',
    'Emotional Rollercoaster',
    'Mood Swinger',
  ],
  glass_half_full: [
    'The Comeback Kid',
    'Late Bloomer',
    'Second Wind',
    'Rising Phoenix',
    'Slow Starter',
  ],
  downward_spiral: [
    'Fading Star',
    'The Decline',
    'Burned Too Bright',
    'Running on Fumes',
    'Early Bird',
  ],
  median_maverick: [
    'Statistical Enigma',
    'The Outlier',
    'Bell Curve Breaker',
    'The Anomaly',
    'Skewed Perspective',
  ],
  broken_record: [
    'Broken Record',
    'One-Note Wonder',
    'Déjà Vu',
    'Stuck in a Loop',
    'Copy & Paste',
  ],
  perfect_sequence: [
    'The Sequencer',
    'Stairway Builder',
    'The Ladder',
    'Straight Shooter',
    'Counting Steps',
  ],
  bookends: [
    'Full Circle',
    'Alpha & Omega',
    'Poetic Justice',
    'Symmetry Master',
    'The Bookend',
  ],
  agent_of_chaos: [
    'Agent of Chaos',
    'Wild Card',
    'The Unpredictable',
    'Entropy Engine',
    'Chaos Incarnate',
  ],
  true_neutral: [
    'True Neutral',
    'The Balanced',
    'Perfectly Average',
    'The Equaliser',
    'Statistical Perfection',
  ],
  zero_rolls: [
    'The Silent Observer',
    'Ghost at the Table',
    'The Phantom',
    'Spectator Mode',
    'AFK',
  ],
};

// ─── Alternative Narrative Text Variants ───────────────────────────────────────
//
// Each rule maps to an array of text-generating functions. The recap service
// picks one at random, so recaps read differently every time.
// The first variant in each array is the original text from highlight-rules.ts.

export const HIGHLIGHT_TEXT_VARIANTS: Record<string, TextGenerator[]> = {

  // ── Base Average ──────────────────────────────────────────────────────────────

  base_average: [
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} maintained a solid presence with an average roll of ${avg.toFixed(1)} across ${rolls.length} rolls.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `With ${rolls.length} dice thrown, ${dn} settled into an average of ${avg.toFixed(1)} — a steady performance throughout the session.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} clocked in with ${rolls.length} rolls and a dependable average of ${avg.toFixed(1)}, keeping things consistent at the table.`;
    },
  ],

  // ── Highest Average ───────────────────────────────────────────────────────────

  highest_avg: [
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} topped the board as our supreme roller, securing the highest average roll of ${avg.toFixed(1)}! The gods have favored their efforts.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `The dice smiled upon ${dn} this session — with a commanding average of ${avg.toFixed(1)}, nobody could match their rolling prowess!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `All hail ${dn}, who claimed the throne with the session's highest average of ${avg.toFixed(1)}! When the dice gods pick a champion, they make it obvious.`;
    },
  ],

  // ── Lowest Average ────────────────────────────────────────────────────────────

  lowest_avg: [
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} grappled with the fickle whims of fate, landing the lowest average roll of ${avg.toFixed(1)}. A true trial of patience, but they fought through it!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `The dice were not kind to ${dn} this time — a session-low average of ${avg.toFixed(1)} tells a tale of resilience in the face of cruel randomness.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `Sometimes the dice just aren't your friend. ${dn} battled through with the table's lowest average of ${avg.toFixed(1)}, but lived to roll another day!`;
    },
  ],

  // ── Most Active Roller ────────────────────────────────────────────────────────

  most_rolls: [
    (rolls, _ctx, _pn, dn) => {
      const sum = rolls.reduce((a, b) => a + b, 0);
      return `${dn} was the most active roller by far, casting the dice a massive ${rolls.length} times for a colossal total sum of ${sum}!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const sum = rolls.reduce((a, b) => a + b, 0);
      return `Nobody rolled more than ${dn}, who threw the dice an impressive ${rolls.length} times for a grand total of ${sum}. When in doubt, roll more dice!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const sum = rolls.reduce((a, b) => a + b, 0);
      return `${dn} dominated the dice tray with ${rolls.length} rolls, racking up a staggering sum of ${sum}. Clearly not one to sit on the sidelines!`;
    },
  ],

  // ── Crit Master (both nat 20s and nat 1s) ─────────────────────────────────────

  crit_master_both: [
    (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return `${dn} lived on the absolute edge, scoring ${n20} natural 20s and ${n1} critical failures! A wild, unpredictable rollercoaster of fate!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return `${dn} experienced the full spectrum of fortune — ${n20} glorious nat 20s clashed against ${n1} devastating nat 1s. Never a dull moment!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      const n1 = rolls.filter(r => r === 1).length;
      return `With ${n20} natural 20s and ${n1} critical fumbles, ${dn} proved that their dice have no concept of moderation. Peak highs and crushing lows!`;
    },
  ],

  // ── Crit King (nat 20s only) ──────────────────────────────────────────────────

  crit_king_20s: [
    (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      return `${dn} was on fire, scoring ${n20} natural 20s and avoiding critical failures entirely! Pure rolling excellence.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      return `${dn} rolled with impunity — ${n20} natural 20s and not a single nat 1 in sight! The dice were clearly enchanted.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const n20 = rolls.filter(r => r === 20).length;
      return `Flawless execution from ${dn}, who landed ${n20} critical successes while dodging every possible fumble. Is this what perfection looks like?`;
    },
  ],

  // ── Crit Fumbles (nat 1s only) ────────────────────────────────────────────────

  crit_fumble_1s: [
    (rolls, _ctx, _pn, dn) => {
      const n1 = rolls.filter(r => r === 1).length;
      return `${dn} faced tough odds, rolling ${n1} critical failures and failing to land a single natural 20. The dice gods were testing their resolve!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const n1 = rolls.filter(r => r === 1).length;
      return `${dn} weathered a storm of bad luck — ${n1} nat 1s and zero nat 20s. The dice gods clearly had other plans for them this session.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const n1 = rolls.filter(r => r === 1).length;
      return `It was a rough night at the table for ${dn}: ${n1} critical fumbles and not one natural 20 to soften the blow. True grit in the face of terrible odds!`;
    },
  ],

  // ── Consistent Crusader ───────────────────────────────────────────────────────

  consistent_crusader: [
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn}, ever the steady hand, kept rolls strictly between ${Math.min(...rolls)} and ${Math.max(...rolls)} (average ${avg.toFixed(1)}). Not a single 1 or 20 in sight, showing remarkable consistency in the face of chaos!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `While others rode the highs and lows, ${dn} stayed locked in a narrow band of ${Math.min(...rolls)} to ${Math.max(...rolls)} with an average of ${avg.toFixed(1)}. No crits, no fumbles — just pure, unbreakable consistency.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} played it tight, rolling exclusively between ${Math.min(...rolls)} and ${Math.max(...rolls)} (avg ${avg.toFixed(1)}). With zero nat 1s or 20s, they were the most predictable roller at the table — and sometimes, predictable is powerful.`;
    },
  ],

  // ── Missing Numbers ───────────────────────────────────────────────────────────

  missing_numbers: [
    (rolls, _ctx, _pn, dn) => {
      const rolled = new Set(rolls);
      const missing = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n));
      const display = missing.slice(0, 10);
      const suffix = missing.length > 10 ? ' among others' : '';
      const odds = Math.pow((20 - missing.length) / 20, rolls.length);
      return `${dn} managed to complete the session without rolling a single ${formatList(display)}${suffix} across ${rolls.length} rolls. The mathematical odds of avoiding those numbers are roughly 1 in ${Math.round(1 / odds).toLocaleString()}!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const rolled = new Set(rolls);
      const missing = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n));
      const display = missing.slice(0, 10);
      const suffix = missing.length > 10 ? ' among others' : '';
      const odds = Math.pow((20 - missing.length) / 20, rolls.length);
      return `Against all odds, ${dn} never once rolled ${formatList(display)}${suffix} in ${rolls.length} attempts. The probability of dodging those numbers? About 1 in ${Math.round(1 / odds).toLocaleString()}!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const rolled = new Set(rolls);
      const missing = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !rolled.has(n));
      const display = missing.slice(0, 10);
      const suffix = missing.length > 10 ? ' among others' : '';
      const odds = Math.pow((20 - missing.length) / 20, rolls.length);
      return `${dn}'s dice had a curious blind spot — ${formatList(display)}${suffix} never appeared across all ${rolls.length} rolls. Statistically, this should happen roughly 1 in ${Math.round(1 / odds).toLocaleString()} times!`;
    },
  ],

  // ── Hot Streak ────────────────────────────────────────────────────────────────

  hot_streak: [
    (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r >= 15);
      return `${dn} hit an incredible hot streak, landing ${run} consecutive rolls of 15 or higher! When the dice are on fire, you don't stop rolling!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r >= 15);
      return `${dn} caught fire with ${run} straight rolls of 15+! That's the kind of streak that changes the course of entire campaigns.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r >= 15);
      return `The table watched in awe as ${dn} strung together ${run} consecutive high rolls (15 or above). When you're hot, you're hot!`;
    },
  ],

  // ── Cold Snap ─────────────────────────────────────────────────────────────────

  cold_snap: [
    (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r <= 5);
      return `${dn} endured a brutal cold snap, suffering ${run} consecutive rolls of 5 or lower. Sometimes fate just isn't on your side!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r <= 5);
      return `${dn} hit a devastating skid — ${run} rolls in a row at 5 or below. Even the most seasoned adventurers have rough patches.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestConsecutiveRun(rolls, r => r <= 5);
      return `A merciless cold streak gripped ${dn}, who rolled 5 or lower ${run} times consecutively. The dice tray felt more like an ice rink.`;
    },
  ],

  // ── Yo-Yo Roller ────────────────────────────────────────────────────────────────────────────

  bipolar_roller: [
    (rolls, _ctx, _pn, dn) => {
      const run = longestAlternatingRun(rolls);
      return `${dn} was the ultimate wildcard, swinging between extremes with ${run} alternating high (≥15) and low (≤5) rolls! A truly chaotic energy at the table.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestAlternatingRun(rolls);
      return `${dn}'s dice couldn't make up their mind — ${run} rolls alternating between brilliant highs and crushing lows. A thrilling but nauseating ride!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestAlternatingRun(rolls);
      return `Extreme after extreme! ${dn} ping-ponged between rolls of 15+ and 5 or less a total of ${run} times in a row. Utterly unpredictable!`;
    },
  ],

  // ── Glass Half Full ───────────────────────────────────────────────────────────

  glass_half_full: [
    (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `${dn} started slow but finished strong! Their luck surged from ${firstPct}% in the first half to ${secondPct}% in the second half. A classic comeback story written in dice!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `A slow burn turned into a blaze — ${dn}'s luck climbed from ${firstPct}% early on to ${secondPct}% in the back half. The best stories have great second acts!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `${dn} warmed up as the session went on, their luck jumping from ${firstPct}% to ${secondPct}% between halves. Proof that patience pays off at the dice tray!`;
    },
  ],

  // ── Downward Spiral ───────────────────────────────────────────────────────────

  downward_spiral: [
    (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `${dn} started the session riding high at ${firstPct}% luck, but fate turned cruel in the second half, dropping to just ${secondPct}%. The dice giveth, and the dice taketh away.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `${dn} blazed through the first half at ${firstPct}% luck, only to watch it crumble to ${secondPct}% down the stretch. A cautionary tale of fleeting fortune.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const mid = Math.floor(rolls.length / 2);
      const firstPct = (luckPct(rolls.slice(0, mid)) * 100).toFixed(0);
      const secondPct = (luckPct(rolls.slice(mid)) * 100).toFixed(0);
      return `Things started so well for ${dn} (${firstPct}% luck), but the second half told a very different story at just ${secondPct}%. The dice gods are fickle masters.`;
    },
  ],

  // ── Median Maverick ───────────────────────────────────────────────────────────

  median_maverick: [
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      const direction = avg > med
        ? 'a few massive rolls pulling their average skyward'
        : 'a handful of devastating low rolls dragging them down';
      return `${dn} is a statistical enigma! Their average of ${avg.toFixed(1)} tells a very different story from their median of ${med}, thanks to ${direction}. The outliers defined their session!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      const direction = avg > med
        ? 'some explosive high rolls inflating the mean'
        : 'a cluster of rock-bottom rolls weighing things down';
      return `Numbers don't lie — but they can mislead. ${dn}'s average of ${avg.toFixed(1)} versus a median of ${med} reveals ${direction}. A session shaped by extremes!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      const med = median(rolls);
      const direction = avg > med
        ? 'outlier crits skewing the numbers upward'
        : 'a string of poor rolls pulling the average into the gutter';
      return `${dn}'s rolls were anything but straightforward: an average of ${avg.toFixed(1)} paired with a median of ${med} points to ${direction}. The gap tells the real story!`;
    },
  ],

  // ── Broken Record ─────────────────────────────────────────────────────────────

  broken_record: [
    (rolls, _ctx, _pn, dn) => {
      const dup = longestDuplicateRun(rolls);
      const odds = Math.round(Math.pow(20, dup.length - 1));
      return `${dn} got stuck in a loop, rolling a ${dup.value} an astonishing ${dup.length} times in a row! The odds of this for any specific number are roughly 1 in ${odds.toLocaleString()}!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const dup = longestDuplicateRun(rolls);
      const odds = Math.round(Math.pow(20, dup.length - 1));
      return `${dn} rolled a ${dup.value} not once, not twice, but ${dup.length} times consecutively! The mathematical odds? A staggering 1 in ${odds.toLocaleString()}!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const dup = longestDuplicateRun(rolls);
      const odds = Math.round(Math.pow(20, dup.length - 1));
      return `The dice had one answer for ${dn}: ${dup.value}. They rolled it ${dup.length} times straight, an event with odds of roughly 1 in ${odds.toLocaleString()}. Glitch in the matrix?`;
    },
  ],

  // ── Perfect Sequence ──────────────────────────────────────────────────────────

  perfect_sequence: [
    (rolls, _ctx, _pn, dn) => {
      const run = longestStraight(rolls);
      const odds = Math.round(Math.pow(20, run - 1) / Math.pow(2, run - 1));
      return `${dn} defied probability by rolling a perfect ${run}-number straight sequence! The mathematical odds of landing this are approximately 1 in ${odds.toLocaleString()}!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestStraight(rolls);
      const odds = Math.round(Math.pow(20, run - 1) / Math.pow(2, run - 1));
      return `Like counting steps on a staircase, ${dn} rolled a perfect ${run}-number sequence! The odds of such a clean run are roughly 1 in ${odds.toLocaleString()}.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const run = longestStraight(rolls);
      const odds = Math.round(Math.pow(20, run - 1) / Math.pow(2, run - 1));
      return `${dn}'s dice went in perfect order — a ${run}-roll straight that defies all probability at approximately 1 in ${odds.toLocaleString()} odds. Calculated chaos!`;
    },
  ],

  // ── Bookends ──────────────────────────────────────────────────────────────────

  bookends: [
    (rolls, _ctx, _pn, dn) => {
      return `${dn} rolled a perfect bookend, starting and ending the session with the same roll: ${rolls[0]}! A poetic symmetry that the dice gods clearly orchestrated.`;
    },
    (rolls, _ctx, _pn, dn) => {
      return `${dn} opened with a ${rolls[0]} and closed with a ${rolls[0]} — a satisfying symmetry that bookends the session perfectly.`;
    },
    (rolls, _ctx, _pn, dn) => {
      return `First roll: ${rolls[0]}. Last roll: ${rolls[0]}. ${dn}'s session came full circle in the most poetic way possible.`;
    },
  ],

  // ── Agent of Chaos ────────────────────────────────────────────────────────────

  agent_of_chaos: [
    (rolls, _ctx, _pn, dn) => {
      const sd = stdDev(rolls);
      return `${dn} was the session's agent of chaos with a standard deviation of ${sd.toFixed(1)} (well above the expected ~5.8 for a d20). They rolled at the extremes, avoiding the middle ground entirely!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const sd = stdDev(rolls);
      return `With a wild standard deviation of ${sd.toFixed(1)} (the expected is ~5.8), ${dn} avoided the middle ground like it was cursed. Pure chaotic energy!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const sd = stdDev(rolls);
      return `${dn}'s rolls were all over the place — a standard deviation of ${sd.toFixed(1)} versus the normal ~5.8 tells you everything. Moderation was never an option!`;
    },
  ],

  // ── True Neutral ──────────────────────────────────────────────────────────────

  true_neutral: [
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} achieved near-statistical perfection with an average of ${avg.toFixed(2)} across ${rolls.length} rolls—remarkably close to the mathematical mean of 10.5. Balance in all things!`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `With an average of ${avg.toFixed(2)} over ${rolls.length} rolls, ${dn} came eerily close to the theoretical mean of 10.5. The universe demands balance, and ${dn} delivered.`;
    },
    (rolls, _ctx, _pn, dn) => {
      const avg = rolls.reduce((a, b) => a + b, 0) / rolls.length;
      return `${dn} rolled like a textbook — an average of ${avg.toFixed(2)} across ${rolls.length} rolls, practically kissing the mathematical expectation of 10.5. Perfectly balanced, as all things should be.`;
    },
  ],

  // ── Zero Rolls (special case) ─────────────────────────────────────────────────

  zero_rolls: [
    (_rolls, _ctx, _pn, dn) => {
      return `${dn} was a quiet observer this time, recording 0 rolls. Perhaps staying quiet was a wise choice—silence can sometimes be golden!`;
    },
    (_rolls, _ctx, _pn, dn) => {
      return `${dn} watched from the sidelines this session, letting the others tempt fate. Sometimes the smartest move is no move at all.`;
    },
    (_rolls, _ctx, _pn, dn) => {
      return `Not a single roll from ${dn} this time — a true ghost at the table. But every great story needs its silent witnesses.`;
    },
  ],
};
