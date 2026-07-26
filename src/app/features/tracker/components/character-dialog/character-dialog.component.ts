import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Character, Player } from '../../../../core/db/database.service';

@Component({
  selector: 'app-character-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './character-dialog.component.html',
  styleUrl: './character-dialog.component.css',
})
export class CharacterDialogComponent {
  public readonly mode = input<'add' | 'edit'>('add');
  public readonly character = input<Character | null>(null);
  public readonly globalPlayers = input<Player[]>([]);

  public readonly save = output<{
    playerName: string;
    characterName: string;
    color: string;
    isDM: boolean;
    selectedPlayerId: string;
  }>();
  public readonly cancelled = output<void>();

  public readonly presetColors: string[] = [
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#10b981',
    '#ec4899',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
  ];

  public readonly selectedPlayerId = signal<string>('new');
  public readonly newPlayerName = signal<string>('');
  public readonly characterName = signal<string>('');
  public readonly color = signal<string>('#3b82f6');
  public readonly isDM = signal<boolean>(false);

  public constructor() {
    effect(() => {
      const m = this.mode();
      const c = this.character();

      if (m === 'add') {
        this.selectedPlayerId.set('new');
        this.newPlayerName.set('');
        this.characterName.set('');
        this.color.set(this.presetColors[0]);
        this.isDM.set(false);
      } else if (m === 'edit' && c) {
        this.characterName.set(c.name || '');
        this.color.set(c.color || this.presetColors[0]);
        this.isDM.set(!!c.isDM);
      }
    });
  }

  public selectColor(c: string): void {
    this.color.set(c);
  }

  public onSave(): void {
    const charName = this.characterName().trim();
    if (!charName) {
      return;
    }

    const selPlayerId = this.selectedPlayerId();
    const newPlayer = this.newPlayerName().trim();

    if (this.mode() === 'add' && selPlayerId === 'new' && !newPlayer) {
      return;
    }

    this.save.emit({
      playerName: newPlayer,
      characterName: charName,
      color: this.color(),
      isDM: this.isDM(),
      selectedPlayerId: selPlayerId,
    });
  }

  public onCancel(): void {
    this.cancelled.emit();
  }
}
