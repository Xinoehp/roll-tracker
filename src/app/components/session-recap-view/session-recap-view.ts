import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RecapPlayerData {
  playerName: string;
  characterName: string;
  isDM: boolean;
  stats: number[]; // [rolls, sum, avg, luckPct, luckAmt, nat1, nat20]
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
