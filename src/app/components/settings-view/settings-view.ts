import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../../db/database.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-settings-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-view.html',
  styleUrls: ['./settings-view.css']
})
export class SettingsViewComponent {
  private readonly db = inject(DatabaseService);
  readonly settings = inject(SettingsService);

  toggleShortcuts(event: Event) {
    const input = event.target as HTMLInputElement;
    this.settings.setKeyboardShortcuts(input.checked);
  }

  async clearAllData() {
    const confirmed = confirm(
      'WARNING: This will permanently delete all campaigns, players, characters, sessions, and rolls. This action cannot be undone.\n\nAre you sure you want to clear all data?'
    );
    
    if (confirmed) {
      const doubleConfirmed = confirm(
        'Are you absolutely sure you want to wipe the entire database? All local history will be lost.'
      );
      if (doubleConfirmed) {
        await this.db.clearAll();
        // Clear settings too
        localStorage.removeItem('keyboard_shortcuts_enabled');
        localStorage.removeItem('sidebar_width');
        alert('Database successfully cleared. Reloading application...');
        window.location.reload();
      }
    }
  }
}
