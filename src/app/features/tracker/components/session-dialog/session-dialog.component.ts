import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Session } from '../../../../core/db/database.service';

@Component({
  selector: 'app-session-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-dialog.component.html',
  styleUrl: './session-dialog.component.css',
})
export class SessionDialogComponent {
  public readonly mode = input<'create' | 'edit'>('create');
  public readonly session = input<Session | null>(null);
  public readonly sessionsCount = input<number>(0);

  public readonly save = output<{ name: string; date: string; notes: string }>();
  public readonly deleteSession = output<void>();
  public readonly cancelled = output<void>();

  public readonly name = signal<string>('');
  public readonly date = signal<string>('');
  public readonly notes = signal<string>('');

  public constructor() {
    effect(() => {
      const currentMode = this.mode();
      const currentSession = this.session();
      const count = this.sessionsCount();

      if (currentMode === 'create') {
        this.name.set(`Session ${count + 1}`);
        this.date.set(new Date().toISOString().split('T')[0]);
        this.notes.set('');
      } else if (currentMode === 'edit' && currentSession) {
        this.name.set(currentSession.name || '');
        this.date.set(currentSession.date || '');
        this.notes.set(currentSession.notes || '');
      }
    });
  }

  public onSave(): void {
    const trimmedName = this.name().trim();
    const trimmedDate = this.date().trim();
    const trimmedNotes = this.notes().trim();

    if (trimmedName && trimmedDate) {
      this.save.emit({
        name: trimmedName,
        date: trimmedDate,
        notes: trimmedNotes,
      });
    }
  }

  public onDelete(): void {
    this.deleteSession.emit();
  }

  public onCancel(): void {
    this.cancelled.emit();
  }
}
