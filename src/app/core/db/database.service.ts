import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

export interface Campaign {
  id?: number;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface Player {
  id?: number;
  name: string;
  createdAt: Date;
}

export interface Character {
  id?: number;
  playerId: number;
  campaignId: number;
  name: string;
  color: string;
  isDM?: boolean;
  isActive: boolean; // Show/Hide player toggle
  playerName?: string; // Resolved global player name (joined on load)
  createdAt: Date;
}

export interface Session {
  id?: number;
  campaignId: number;
  name: string;
  date: string; // ISO Date YYYY-MM-DD
  notes?: string;
  createdAt: Date;
}

export interface Roll {
  id?: number;
  sessionId: number;
  characterId: number; // References Character table
  value: number;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class DatabaseService extends Dexie {
  campaigns!: Table<Campaign, number>;
  players!: Table<Player, number>;
  characters!: Table<Character, number>;
  sessions!: Table<Session, number>;
  rolls!: Table<Roll, number>;

  constructor() {
    super('DiceTrackerDB');
    
    // Active normalized schema version 2
    this.version(2).stores({
      campaigns: '++id, name, createdAt',
      players: '++id, &name, createdAt', // unique name index
      characters: '++id, playerId, campaignId, name, color, isActive, createdAt',
      sessions: '++id, campaignId, name, date, createdAt',
      rolls: '++id, sessionId, characterId, value, createdAt',
    });

    // Resilient Database Bootstrap:
    // If the database is blocked/corrupted from previous failed runs,
    // catch the open error, wipe it, and open a clean connection.
    this.open().catch(async (err) => {
      console.error('Failed to open database. Wiping and recreating...', err);
      try {
        await Dexie.delete('DiceTrackerDB');
        await this.open();
        console.log('Database successfully wiped and recreated.');
      } catch (deleteErr) {
        console.error('Critical: Could not recreate database.', deleteErr);
      }
    });
  }

  // Clear all database tables
  async clearAll() {
    await this.rolls.clear();
    await this.sessions.clear();
    await this.characters.clear();
    await this.players.clear();
    await this.campaigns.clear();
  }
}
