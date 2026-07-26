import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Campaign, Session, Character } from '../../../../core/db/database.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  public readonly campaigns = input<Campaign[]>([]);
  public readonly activeCampaign = input<Campaign | null>(null);
  public readonly sessions = input<Session[]>([]);
  public readonly activeSession = input<Session | null>(null);
  public readonly characters = input<Character[]>([]);

  public readonly createCampaign = output<void>();
  public readonly selectCampaign = output<number>();
  public readonly createSession = output<void>();
  public readonly selectSession = output<Session>();
  public readonly editSession = output<{ session: Session; event: MouseEvent }>();
  public readonly deleteSession = output<{ session: Session; event: MouseEvent }>();
  public readonly addCharacter = output<void>();
  public readonly editCharacter = output<{ character: Character; event: MouseEvent }>();
  public readonly toggleCharacterActive = output<{ characterId: number; event: MouseEvent }>();
  public readonly removeCharacter = output<{ characterId: number; event: MouseEvent }>();
  public readonly exportBackup = output<void>();
  public readonly importBackup = output<Event>();

  public onSelectCampaign(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.selectCampaign.emit(+target.value);
    }
  }

  public onCreateCampaign(): void {
    this.createCampaign.emit();
  }

  public onCreateSession(): void {
    this.createSession.emit();
  }

  public onSelectSession(session: Session): void {
    this.selectSession.emit(session);
  }

  public onEditSession(session: Session, event: MouseEvent): void {
    this.editSession.emit({ session, event });
  }

  public onDeleteSession(session: Session, event: MouseEvent): void {
    this.deleteSession.emit({ session, event });
  }

  public onAddCharacter(): void {
    this.addCharacter.emit();
  }

  public onEditCharacter(character: Character, event: MouseEvent): void {
    this.editCharacter.emit({ character, event });
  }

  public onToggleCharacterActive(characterId: number, event: MouseEvent): void {
    this.toggleCharacterActive.emit({ characterId, event });
  }

  public onRemoveCharacter(characterId: number, event: MouseEvent): void {
    this.removeCharacter.emit({ characterId, event });
  }

  public onExportBackup(): void {
    this.exportBackup.emit();
  }

  public onImportBackup(event: Event): void {
    this.importBackup.emit(event);
  }
}
