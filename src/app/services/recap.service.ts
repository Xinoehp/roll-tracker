import { Injectable } from '@angular/core';
import { HIGHLIGHT_RULES } from './highlight-rules';
import { HIGHLIGHT_TITLES, HIGHLIGHT_TEXT_VARIANTS, pickRandom } from './highlight-flavour';

export interface StatHighlight {
  id: string;
  emoji: string;
  title?: string;
  label: string;
  textTemplate: string;
  improbabilityScore: number; // 0 to 1
}

export interface SessionContext {
  highestAvgPlayer?: string;
  lowestAvgPlayer?: string;
  highestAvg?: number;
  lowestAvg?: number;
  mostRollsPlayer?: string;
  mostRollsCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class RecapService {
  readonly presetColors = [
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f97316', // Orange
  ];

  // Generate highlight blocks for a single player in a session or campaign
  generateHighlights(
    playerName: string,
    characterName: string,
    isDM: boolean,
    rolls: number[],
    sessionContext: SessionContext
  ): StatHighlight[] {
    const N = rolls.length;
    let displayName = characterName ? characterName : playerName;
    if (displayName === 'Dungeon Master') {
      displayName = 'Our Dungeon Master';
    }

    // Handle zero rolls as a special case
    if (N === 0) {
      const zeroTitles = HIGHLIGHT_TITLES['zero_rolls'];
      const zeroVariants = HIGHLIGHT_TEXT_VARIANTS['zero_rolls'];
      return [{
        id: 'zero_rolls',
        emoji: '🤫',
        title: zeroTitles ? pickRandom(zeroTitles) : 'The Silent Observer',
        label: 'The Silent (0 rolls)',
        textTemplate: zeroVariants
          ? pickRandom(zeroVariants)([], {} as SessionContext, playerName, displayName)
          : `${displayName} was a quiet observer this time, recording 0 rolls. Perhaps staying quiet was a wise choice—silence can sometimes be golden!`,
        improbabilityScore: 0.8,
      }];
    }

    // Run each rule in the registry, collect valid highlights
    const highlights: StatHighlight[] = HIGHLIGHT_RULES
      .filter(rule => rule.isValid(rolls, sessionContext, playerName))
      .map(rule => {
        const titles = HIGHLIGHT_TITLES[rule.id];
        const variants = HIGHLIGHT_TEXT_VARIANTS[rule.id];
        const textFn = variants ? pickRandom(variants) : rule.generateText;
        return {
          id: rule.id,
          emoji: rule.emoji,
          title: titles ? pickRandom(titles) : undefined,
          label: rule.label(rolls, sessionContext, playerName) || rule.id,
          textTemplate: textFn(rolls, sessionContext, playerName, displayName),
          improbabilityScore: rule.improbabilityScore(rolls, sessionContext),
        };
      });

    // Sort by improbabilityScore descending (most impressive first)
    highlights.sort((a, b) => b.improbabilityScore - a.improbabilityScore);
    return highlights;
  }

  // Compress payload using native browser CompressionStream (Deflate)
  async compressRecap(payload: any): Promise<string> {
    const jsonStr = JSON.stringify(payload);

    // Check if CompressionStream is available (runs in browser but might not in test runner)
    if (typeof CompressionStream !== 'undefined') {
      try {
        const stream = new Blob([jsonStr]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
        const response = new Response(compressedStream);
        const buffer = await response.arrayBuffer();
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      } catch (err) {
        console.warn('CompressionStream failed, falling back to base64 uri-encode:', err);
      }
    }

    // Test runner or legacy fallback: base64 uri-encoded
    return btoa(encodeURIComponent(jsonStr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Decompress base64 query param back to JSON payload
  async decompressRecap(base64Str: string): Promise<any> {
    let base64 = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const stream = new Blob([bytes]).stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
        const response = new Response(decompressedStream);
        const text = await response.text();
        return JSON.parse(text);
      } catch (err) {
        console.warn('DecompressionStream failed, falling back to base64 uri-decode:', err);
      }
    }

    // Fallback parser
    try {
      const decoded = decodeURIComponent(atob(base64));
      return JSON.parse(decoded);
    } catch (err) {
      console.error('Failed to parse sharing payload:', err);
      return null;
    }
  }
}
