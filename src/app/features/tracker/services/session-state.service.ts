import { Injectable, inject, signal, computed } from '@angular/core';
import { DatabaseService, Campaign, Player, Character, Session, Roll } from '../../../core/db/database.service';

@Injectable({
  providedIn: 'root',
})
export class SessionStateService {
  private readonly db = inject(DatabaseService);

  // Core Version 2 Signals
  readonly activeCampaign = signal<Campaign | null>(null);
  readonly activeSession = signal<Session | null>(null);
  readonly activeCharacters = signal<Character[]>([]);
  readonly activeCharacter = signal<Character | null>(null);
  readonly rolls = signal<Roll[]>([]);
  readonly showEditSessionModal = signal<boolean>(false);

  // Computed properties
  readonly hasActiveSession = computed(() => this.activeSession() !== null);
  
  // Filters active characters to only show those currently playing
  readonly activeCharactersFiltered = computed(() => 
    this.activeCharacters().filter(c => c.isActive)
  );

  constructor() {
    // Automatically load default campaign on init
    this.initializeDefaultState();
  }

  private async initializeDefaultState() {
    try {
      const campaign = await this.db.campaigns.orderBy('id').first();
      if (campaign) {
        await this.setCampaign(campaign);
      }
    } catch (e) {
      console.error('Error loading default state:', e);
    }
  }

  async setCampaign(campaign: Campaign | null) {
    this.activeCampaign.set(campaign);
    if (!campaign || !campaign.id) {
      this.activeSession.set(null);
      this.rolls.set([]);
      this.activeCharacters.set([]);
      this.activeCharacter.set(null);
      return;
    }

    // Load characters for this campaign
    await this.refreshCharacters();

    // Set default active character to the first active playing character
    const activePlaying = this.activeCharactersFiltered();
    if (activePlaying.length > 0) {
      this.activeCharacter.set(activePlaying[0]);
    } else {
      this.activeCharacter.set(null);
    }

    // Load the latest session for this campaign
    const latestSession = await this.db.sessions
      .where('campaignId')
      .equals(campaign.id)
      .reverse()
      .sortBy('date'); // sorted descending by date
    
    if (latestSession && latestSession.length > 0) {
      await this.setSession(latestSession[0]);
    } else {
      this.activeSession.set(null);
      this.rolls.set([]);
    }
  }

  async setSession(session: Session) {
    this.activeSession.set(session);
    if (!session.id) return;

    // Load rolls for this session, sorted chronologically
    const sessionRolls = await this.db.rolls
      .where('sessionId')
      .equals(session.id)
      .sortBy('createdAt');
    this.rolls.set(sessionRolls);
  }

  async refreshCharacters() {
    const campaign = this.activeCampaign();
    if (!campaign || !campaign.id) return;

    const campaignCharacters = await this.db.characters
      .where('campaignId')
      .equals(campaign.id)
      .toArray();

    // Resolve global player name for each character
    const joinedCharacters = await Promise.all(
      campaignCharacters.map(async c => {
        const player = await this.db.players.get(c.playerId);
        return {
          ...c,
          playerName: player ? player.name : 'Unknown'
        };
      })
    );

    this.activeCharacters.set(joinedCharacters);

    // Sync active selection
    const active = this.activeCharacter();
    if (active && active.id) {
      const updatedActive = joinedCharacters.find(c => c.id === active.id);
      if (updatedActive) {
        this.activeCharacter.set(updatedActive);
      }
    }
  }

  async createCampaign(name: string, description?: string) {
    const id = await this.db.campaigns.add({
      name,
      description,
      createdAt: new Date(),
    });
    const newCampaign = { id, name, description, createdAt: new Date() };
    await this.setCampaign(newCampaign);
    return newCampaign;
  }

  async createSession(name: string, dateStr: string) {
    const campaign = this.activeCampaign();
    if (!campaign || !campaign.id) throw new Error('No active campaign');

    const id = await this.db.sessions.add({
      campaignId: campaign.id,
      name,
      date: dateStr,
      createdAt: new Date(dateStr),
    });

    const newSession = {
      id,
      campaignId: campaign.id,
      name,
      date: dateStr,
      createdAt: new Date(dateStr),
    };
    await this.setSession(newSession);
    return newSession;
  }

  async addCharacter(playerName: string, color: string, isDM?: boolean, characterName?: string) {
    const campaign = this.activeCampaign();
    if (!campaign || !campaign.id) throw new Error('No active campaign');

    // 1. Find or create global Player
    let player = await this.db.players.where('name').equalsIgnoreCase(playerName).first();
    let playerId: number;
    if (!player) {
      try {
        playerId = await this.db.players.add({
          name: playerName,
          createdAt: new Date(),
        });
      } catch (err) {
        const existing = await this.db.players.where('name').equalsIgnoreCase(playerName).first();
        if (existing && existing.id) {
          playerId = existing.id;
        } else {
          throw err;
        }
      }
    } else {
      playerId = player.id!;
    }

    // 2. Add campaign-specific Character
    const newCharRecord: Character = {
      playerId,
      campaignId: campaign.id,
      name: characterName || playerName,
      color,
      isDM,
      isActive: true, // Default to currently playing
      createdAt: new Date(),
    };

    const id = await this.db.characters.add(newCharRecord);
    const newChar = { id, ...newCharRecord, playerName };

    this.activeCharacters.update(prev => [...prev, newChar]);
    if (!this.activeCharacter()) {
      this.activeCharacter.set(newChar);
    }
    return newChar;
  }

  async deleteCharacter(characterId: number) {
    const campaign = this.activeCampaign();
    if (!campaign || !campaign.id) return;

    // Delete character
    await this.db.characters.delete(characterId);
    
    // Delete character's rolls in this campaign's sessions
    const sessions = await this.db.sessions.where('campaignId').equals(campaign.id).toArray();
    const sessionIds = sessions.map(s => s.id).filter((id): id is number => id !== undefined);
    
    for (const sessionId of sessionIds) {
      await this.db.rolls.where({ sessionId, characterId }).delete();
    }

    // Refresh list
    await this.refreshCharacters();
    
    // If active character was deleted, default to first active playing character
    if (this.activeCharacter()?.id === characterId) {
      const activePlaying = this.activeCharactersFiltered();
      this.activeCharacter.set(activePlaying[0] || null);
    }

    // Refresh current session rolls
    const currentSession = this.activeSession();
    if (currentSession) {
      await this.setSession(currentSession);
    }
  }

  // Toggle Character show/hide playing status
  async toggleCharacterActive(characterId: number) {
    const char = await this.db.characters.get(characterId);
    if (char) {
      char.isActive = !char.isActive;
      await this.db.characters.put(char);
      await this.refreshCharacters();

      // If active selection was set to a newly deactivated character, switch to another active playing character
      if (this.activeCharacter()?.id === characterId && !char.isActive) {
        const activePlaying = this.activeCharactersFiltered();
        this.activeCharacter.set(activePlaying[0] || null);
      }
    }
  }

  async logRoll(value: number) {
    const session = this.activeSession();
    const char = this.activeCharacter();
    if (!session || !session.id || !char || !char.id) return;

    const rollRecord: Roll = {
      sessionId: session.id,
      characterId: char.id,
      value,
      createdAt: new Date(),
    };

    const id = await this.db.rolls.add(rollRecord);
    rollRecord.id = id;

    this.rolls.update(prev => [...prev, rollRecord]);
  }

  async undoLastRoll() {
    const list = this.rolls();
    if (list.length === 0) return;

    const lastRoll = list[list.length - 1];
    if (lastRoll.id) {
      await this.db.rolls.delete(lastRoll.id);
      this.rolls.update(prev => prev.slice(0, -1));
    }
  }

  async deleteRoll(rollId: number) {
    await this.db.rolls.delete(rollId);
    this.rolls.update(prev => prev.filter(r => r.id !== rollId));
  }
}
