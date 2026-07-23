import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  keyboardShortcutsEnabled = signal<boolean>(localStorage.getItem('keyboard_shortcuts_enabled') === 'true');

  setKeyboardShortcuts(enabled: boolean) {
    this.keyboardShortcutsEnabled.set(enabled);
    localStorage.setItem('keyboard_shortcuts_enabled', enabled ? 'true' : 'false');
  }
}
