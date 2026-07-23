import { Component, HostListener, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SessionStateService } from '../../services/session-state.service';
import { StatsService } from '../../../analytics/services/stats.service';
import { SettingsService } from '../../../settings/services/settings.service';
import { Character, Roll } from '../../../../core/db/database.service';

@Component({
  selector: 'app-roll-entry-numpad',
  imports: [DecimalPipe],
  templateUrl: './roll-entry-numpad.html',
  styleUrl: './roll-entry-numpad.css',
})
export class RollEntryNumpadComponent {
  readonly state = inject(SessionStateService);
  readonly stats = inject(StatsService);
  readonly settings = inject(SettingsService);

  // Buffer state for keyboard typing
  inputBuffer = '';
  private bufferTimeout: any = null;

  // Visual effects state
  flashingPlayerId = signal<number | null>(null);
  flashingButtonValue = signal<number | null>(null);
  undoFlashActive = signal<boolean>(false);

  // Keyboard shortcut hints map
  readonly playerHotkeys = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'];

  // Slice of the last 5 rolls for the quick feed
  readonly recentRolls = computed<Roll[]>(() => {
    const list = this.state.rolls();
    return list.slice(-5).reverse(); // Last 5 rolls, newest first
  });

  // Map to resolve player details quickly
  readonly characterMap = computed<Map<number, Character>>(() => {
    const map = new Map<number, Character>();
    for (const char of this.state.activeCharacters()) {
      if (char.id !== undefined) {
        map.set(char.id, char);
      }
    }
    return map;
  });

  // Listen to global window keydown events when focus isn't in an input box
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.settings.keyboardShortcutsEnabled()) return;

    const activeEl = document.activeElement;
    if (
      activeEl && 
      (activeEl.tagName === 'INPUT' || 
       activeEl.tagName === 'TEXTAREA' || 
       activeEl.getAttribute('contenteditable') === 'true')
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    // 1. Check Player hotkeys (Q, W, E, R, T, Y)
    const hotkeyIndex = this.playerHotkeys.map(k => k.toLowerCase()).indexOf(key);
    if (hotkeyIndex !== -1) {
      const playersList = this.state.activeCharactersFiltered();
      if (hotkeyIndex < playersList.length) {
        const targetPlayer = playersList[hotkeyIndex];
        this.selectPlayer(targetPlayer);
        event.preventDefault();
      }
      return;
    }

    // 2. Undo: Backspace or Ctrl+Z
    if (key === 'backspace' || (key === 'z' && event.ctrlKey)) {
      this.triggerUndo();
      event.preventDefault();
      return;
    }

    // 3. Clear buffer: Escape or 'c'
    if (key === 'escape' || key === 'c') {
      this.clearBuffer();
      event.preventDefault();
      return;
    }

    // 4. Digits 0-9
    if (key >= '0' && key <= '9') {
      this.handleDigit(key);
      event.preventDefault();
    }
  }

  selectPlayer(character: Character) {
    this.state.activeCharacter.set(character);
    if (character.id !== undefined) {
      this.flashPlayer(character.id);
    }
  }

  // Visual feedback when a player is selected via shortcut
  private flashPlayer(playerId: number) {
    this.flashingPlayerId.set(playerId);
    setTimeout(() => {
      if (this.flashingPlayerId() === playerId) {
        this.flashingPlayerId.set(null);
      }
    }, 200);
  }

  // Visual feedback when a button is pressed via keyboard
  private flashButton(val: number) {
    this.flashingButtonValue.set(val);
    setTimeout(() => {
      if (this.flashingButtonValue() === val) {
        this.flashingButtonValue.set(null);
      }
    }, 150);
  }

  triggerUndo() {
    this.undoFlashActive.set(true);
    this.state.undoLastRoll();
    setTimeout(() => this.undoFlashActive.set(false), 200);
  }

  private clearBuffer() {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    this.inputBuffer = '';
  }

  private handleDigit(digit: string) {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }

    const val = parseInt(digit);

    // If typing digits 3-9, commit immediately (since they can't be part of 10-20)
    if (val >= 3 && val <= 9) {
      this.commitRoll(val);
      this.clearBuffer();
      return;
    }

    // If buffer is already populated (we have a leading 1 or 2)
    if (this.inputBuffer) {
      const combined = this.inputBuffer + digit;
      const combinedVal = parseInt(combined);
      
      if (combinedVal >= 1 && combinedVal <= 20) {
        this.commitRoll(combinedVal);
      } else {
        // Out of bounds, ignore or flash error
        console.warn('Roll out of bounds (1-20):', combinedVal);
      }
      this.clearBuffer();
    } else {
      // Leading digit is 0, 1 or 2
      if (val === 0) {
        // Cannot have a leading 0, ignore
        return;
      }
      
      this.inputBuffer = digit;
      
      // Wait for a second digit for 400ms. If none typed, commit single digit (1 or 2)
      this.bufferTimeout = setTimeout(() => {
        const commitVal = parseInt(this.inputBuffer);
        if (commitVal === 1 || commitVal === 2) {
          this.commitRoll(commitVal);
        }
        this.clearBuffer();
      }, 400);
    }
  }

  private commitRoll(val: number) {
    this.state.logRoll(val);
    this.flashButton(val);
  }

  // Direct mouse/tap logging on numpad
  onNumpadTap(val: number) {
    this.commitRoll(val);
    this.clearBuffer();
  }

  // Get current player stats helper
  getPlayerStats(characterId: number) {
    const statsMap = this.stats.playerSessionStatsMap();
    return statsMap.get(characterId) || { totalRolls: 0, average: 0, luckAmount: 0 };
  }

  // Resolve player color helper
  getPlayerColor(characterId: number): string {
    return this.characterMap().get(characterId)?.color || '#9ca3af';
  }

  // Resolve player name helper
  getPlayerName(characterId: number): string {
    const char = this.state.activeCharacters().find(c => c.id === characterId);
    if (!char) return 'Unknown';
    return char.isDM
      ? `👑 ${char.playerName}`
      : char.name && char.name !== char.playerName
        ? `${char.playerName} (${char.name})`
        : char.playerName || 'Unknown';
  }
}
