import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public readonly keyboardShortcutsEnabled = signal<boolean>(localStorage.getItem('keyboard_shortcuts_enabled') === 'true');

  public setKeyboardShortcuts(enabled: boolean) {
    this.keyboardShortcutsEnabled.set(enabled);
    localStorage.setItem('keyboard_shortcuts_enabled', enabled ? 'true' : 'false');
  }
}
