import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SessionStateService } from '../../services/session-state.service';
import { Character, Roll } from '../../db/database.service';

@Component({
  selector: 'app-recent-rolls-feed',
  imports: [DatePipe],
  templateUrl: './recent-rolls-feed.html',
  styleUrl: './recent-rolls-feed.css',
})
export class RecentRollsFeedComponent {
  readonly state = inject(SessionStateService);

  // Filters state (filters by characterId)
  selectedCharacterId = signal<number | null>(null);
  rollFilterType = signal<'all' | 'crit-success' | 'crit-fail'>('all');

  // Map to resolve character details quickly
  readonly characterMap = computed<Map<number, Character>>(() => {
    const map = new Map<number, Character>();
    for (const char of this.state.activeCharacters()) {
      if (char.id !== undefined) {
        map.set(char.id, char);
      }
    }
    return map;
  });

  // Filtered rolls computed list (newest first)
  readonly filteredRolls = computed<Roll[]>(() => {
    let rollsList = this.state.rolls();
    const charId = this.selectedCharacterId();
    const filter = this.rollFilterType();

    // Apply character filter
    if (charId !== null) {
      rollsList = rollsList.filter(r => r.characterId === charId);
    }

    // Apply value filter
    if (filter === 'crit-success') {
      rollsList = rollsList.filter(r => r.value === 20);
    } else if (filter === 'crit-fail') {
      rollsList = rollsList.filter(r => r.value === 1);
    }

    // Reverse to show newest rolls at the top
    return [...rollsList].reverse();
  });

  setPlayerFilter(characterId: number | null) {
    this.selectedCharacterId.set(characterId);
  }

  setRollFilter(filter: 'all' | 'crit-success' | 'crit-fail') {
    this.rollFilterType.set(filter);
  }

  deleteRoll(rollId: number) {
    this.state.deleteRoll(rollId);
  }

  getPlayerName(characterId: number): string {
    const char = this.state.activeCharacters().find(c => c.id === characterId);
    if (!char) return 'Unknown';
    return char.isDM
      ? `👑 ${char.playerName}`
      : char.name && char.name !== char.playerName
        ? `${char.playerName} (${char.name})`
        : char.playerName || 'Unknown';
  }

  getPlayerColor(characterId: number): string {
    return this.characterMap().get(characterId)?.color || '#9ca3af';
  }
}
