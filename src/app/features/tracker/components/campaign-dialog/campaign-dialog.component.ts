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
  public readonly save = output<{ name: string; description: string }>();
  public readonly cancelled = output<void>();

  public readonly name = signal<string>('');
  public readonly description = signal<string>('');

  public onSave(): void {
    const trimmedName = this.name().trim();
    const trimmedDescription = this.description().trim();

    if (trimmedName) {
      this.save.emit({
        name: trimmedName,
        description: trimmedDescription,
      });
    }
  }

  public onCancel(): void {
    this.cancelled.emit();
  }
}
