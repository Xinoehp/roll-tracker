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
  mode = input<'create' | 'edit'>('create');
  session = input<Session | null>(null);
  sessionsCount = input<number>(0);

  save = output<{ name: string; date: string; notes: string }>();
  delete = output<void>();
  cancel = output<void>();

  name = signal<string>('');
  date = signal<string>('');
  notes = signal<string>('');

  constructor() {
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

  onSave(): void {
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

  onDelete(): void {
    this.delete.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
