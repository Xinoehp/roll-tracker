import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-campaign-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-dialog.component.html',
  styleUrl: './campaign-dialog.component.css',
})
export class CampaignDialogComponent {
  readonly save = output<{ name: string; description: string }>();
  readonly cancel = output<void>();

  readonly name = signal<string>('');
  readonly description = signal<string>('');

  onSave(): void {
    const trimmedName = this.name().trim();
    const trimmedDescription = this.description().trim();

    if (trimmedName) {
      this.save.emit({
        name: trimmedName,
        description: trimmedDescription,
      });
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
