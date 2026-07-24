import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RecapPlayerData {
  playerName: string;
  characterName: string;
  isDM: boolean;
  stats: number[]; // [rolls, sum, avg, luckPct, luckAmt, nat1, nat20]
}

export interface ParsedHighlightSection {
  emoji: string;
  headerLine: string;
  playerName: string;
  title: string;
  storyText: string;
  probabilityTag: string;
  color: string;
  isDM: boolean;
  characterName: string;
  stats?: number[];
}

export interface ParsedRecapData {
  headerTitle: string;
  introText: string;
  highlights: ParsedHighlightSection[];
  outroText: string;
}

@Component({
  selector: 'app-session-recap-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-recap-view.html',
  styleUrls: ['./session-recap-view.css'],
})
export class SessionRecapViewComponent {
  // Inputs matching our optimized GZIP format
  campaignName = input<string>('');
  sessionName = input<string>('');
  sessionDate = input<string>('');
  recapText = input<string>('');
  playersData = input<RecapPlayerData[]>([]);

  // Active View Mode ('cards' | 'narrative' | 'table')
  viewMode = signal<'cards' | 'narrative' | 'table'>('cards');

  // Preset color list matching the app's theme
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

  // Column Sorting signals
  sortBy = signal<string>('average');
  sortDesc = signal<boolean>(true);

  // Computed parser that splits recapText into structured player cards
  readonly parsedRecap = computed<ParsedRecapData>(() => {
    const raw = this.recapText().trim();
    if (!raw) {
      return { headerTitle: '', introText: '', highlights: [], outroText: '' };
    }

    const paragraphs = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) {
      return { headerTitle: '', introText: '', highlights: [], outroText: '' };
    }

    let headerTitle = '';
    let introText = '';
    let outroText = '';
    const highlights: ParsedHighlightSection[] = [];

    // Header title (usually paragraph 0 if it has 🎲 or 👑 title)
    let pIdx = 0;
    if (paragraphs[0].includes('Roll Recap') || paragraphs[0].includes('Campaign Chronicles')) {
      headerTitle = paragraphs[0];
      pIdx++;
    }

    // Intro text (paragraph 1 if not a player header)
    if (pIdx < paragraphs.length && !paragraphs[pIdx].includes(':')) {
      introText = paragraphs[pIdx];
      pIdx++;
    }

    const players = this.playersData();

    while (pIdx < paragraphs.length) {
      const p = paragraphs[pIdx];

      // Check if this paragraph is an outro (last paragraph or contains "Until next time" / "What an unforgettable")
      if (
        pIdx === paragraphs.length - 1 &&
        (p.includes('Until next time') || p.includes('May the') || p.includes('Keep rolling') || p.includes('👑') || p.includes('🎲'))
      ) {
        outroText = p;
        break;
      }

      // Check if paragraph contains player header line e.g. "🔥 Campbell The Comeback Kid:" followed by story
      // Or combined "🔥 Campbell The Comeback Kid:\nStory text..."
      const lines = p.split('\n');
      let headerLine = '';
      let storyText = '';

      if (lines.length >= 2 && lines[0].includes(':')) {
        headerLine = lines[0].trim();
        storyText = lines.slice(1).join(' ').trim();
      } else if (lines.length === 1 && lines[0].includes(':') && pIdx + 1 < paragraphs.length) {
        headerLine = lines[0].trim();
        pIdx++;
        storyText = paragraphs[pIdx].trim();
      } else if (p.includes(':')) {
        const colonIdx = p.indexOf(':');
        headerLine = p.substring(0, colonIdx + 1).trim();
        storyText = p.substring(colonIdx + 1).trim();
      } else {
        // Fallback for non-header paragraphs
        if (pIdx === paragraphs.length - 1) {
          outroText = p;
        } else if (!introText) {
          introText = p;
        }
        pIdx++;
        continue;
      }

      // Extract Emoji, Name, and Title from headerLine
      // e.g. "🔥 Campbell The Comeback Kid:" -> Emoji: "🔥", Name/Title split
      let emoji = '🛡️';
      let titleLine = headerLine.replace(/:$/, '').trim();

      const emojiMatch = titleLine.match(/^(\p{Extended_Pictographic}+|\S+)\s+/u);
      if (emojiMatch) {
        emoji = emojiMatch[1];
        titleLine = titleLine.substring(emojiMatch[0].length).trim();
      }

      // Extract probability tag from storyText if present (e.g. "(0.10% chance)")
      let probabilityTag = '';
      const probMatch = storyText.match(/\((?:<[\d.]+%|[\d.]+%)\s*chance\)$/i);
      if (probMatch) {
        probabilityTag = probMatch[0];
        storyText = storyText.substring(0, probMatch.index).trim();
      }

      // Match player from playersData
      let matchedPlayer = players.find(pl => titleLine.toLowerCase().startsWith(pl.playerName.toLowerCase()));
      if (!matchedPlayer) {
        matchedPlayer = players.find(pl => pl.characterName && titleLine.toLowerCase().startsWith(pl.characterName.toLowerCase()));
      }

      let playerName = matchedPlayer ? matchedPlayer.playerName : titleLine;
      let characterName = matchedPlayer ? matchedPlayer.characterName : '';
      let isDM = matchedPlayer ? matchedPlayer.isDM : titleLine.toLowerCase().includes('dungeon master');
      let color = matchedPlayer ? this.getPlayerColor(players.indexOf(matchedPlayer)) : '#3b82f6';
      let stats = matchedPlayer ? matchedPlayer.stats : undefined;

      // Extract title after player name if present
      let title = '';
      if (matchedPlayer) {
        const namePart = matchedPlayer.playerName;
        if (titleLine.toLowerCase().startsWith(namePart.toLowerCase())) {
          title = titleLine.substring(namePart.length).trim();
        }
      }

      highlights.push({
        emoji,
        headerLine,
        playerName,
        title,
        storyText,
        probabilityTag,
        color,
        isDM,
        characterName,
        stats,
      });

      pIdx++;
    }

    return { headerTitle, introText, highlights, outroText };
  });

  toggleSort(field: string) {
    if (this.sortBy() === field) {
      this.sortDesc.set(!this.sortDesc());
    } else {
      this.sortBy.set(field);
      this.sortDesc.set(true);
    }
  }

  // Get color dynamically for a player row
  getPlayerColor(index: number): string {
    return this.presetColors[index % this.presetColors.length];
  }

  // Sorted players list
  sortedPlayers = computed(() => {
    const list = [...this.playersData()];
    const field = this.sortBy();
    const desc = this.sortDesc();
    //console.log(list);
    list.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (field === 'name') {
        valA = a.playerName.toLowerCase();
        valB = b.playerName.toLowerCase();
      } else if (field === 'character') {
        valA = (a.characterName || '').toLowerCase();
        valB = (b.characterName || '').toLowerCase();
      } else {
        // Map stats index
        const indexMap: Record<string, number> = {
          rolls: 0,
          sum: 1,
          average: 2,
          luckPct: 3,
          luckAmt: 4,
          nat1: 5,
          nat20: 6,
        };
        const idx = indexMap[field];

        valA = a.stats[idx] ?? 0;
        valB = b.stats[idx] ?? 0;
      }

      if (valA < valB) return desc ? 1 : -1;
      if (valA > valB) return desc ? -1 : 1;
      return 0;
    });

    return list;
  });

  // Highlight extremes for cells: returns 'best', 'worst', or null
  getCellHighlight(player: RecapPlayerData, colType: string): 'best' | 'worst' | null {
    const validPlayers = this.playersData().filter(p => p.stats[0] > 0); // exclude players with 0 rolls from highlights
    if (validPlayers.length < 2) return null;

    const indexMap: Record<string, number> = {
      rolls: 0,
      sum: 1,
      average: 2,
      luckPct: 3,
      luckAmt: 4,
      nat1: 5,
      nat20: 6,
    };
    const idx = indexMap[colType];
    const val = player.stats[idx];

    // If this player didn't roll, do not highlight
    if (player.stats[0] === 0) return null;

    const values = validPlayers.map(p => p.stats[idx]);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);

    if (maxVal === minVal) return null; // No highlight if all are identical

    if (colType === 'nat1') {
      // For natural 1s, fewer is better
      if (val === minVal) return 'best';
      if (val === maxVal) return 'worst';
    } else {
      // For all other stats, higher is better
      if (val === maxVal) return 'best';
      if (val === minVal) return 'worst';
    }

    return null;
  }
}
