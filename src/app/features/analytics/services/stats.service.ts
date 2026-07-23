import { Injectable, inject, computed } from '@angular/core';
import { SessionStateService } from '../../tracker/services/session-state.service';
import { Roll, Character } from '../../../core/db/database.service';

export interface RollStats {
  totalRolls: number;
  sum: number;
  average: number;
  nat1Count: number;
  nat20Count: number;
  avgNat1sPer20: number;
  avgNat20sPer20: number;
  luckPercentage: number;  // rolls > 10
  luckAmount: number;      // average of (2*roll - 21)/19
}

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private readonly state = inject(SessionStateService);

  // Computed stats for the current session (all players combined)
  readonly sessionStats = computed<RollStats>(() => {
    return this.calculateStatsForRolls(this.state.rolls());
  });

  // Computed stats per character in the current session
  readonly playerSessionStatsMap = computed<Map<number, RollStats>>(() => {
    const map = new Map<number, RollStats>();
    const allRolls = this.state.rolls();
    const charactersList = this.state.activeCharacters();

    for (const char of charactersList) {
      if (char.id !== undefined) {
        const charRolls = allRolls.filter(r => r.characterId === char.id);
        map.set(char.id, this.calculateStatsForRolls(charRolls));
      }
    }
    return map;
  });

  // Helper function to calculate stats for any array of rolls
  calculateStatsForRolls(rollsList: Roll[]): RollStats {
    const totalRolls = rollsList.length;
    if (totalRolls === 0) {
      return {
        totalRolls: 0,
        sum: 0,
        average: 0,
        nat1Count: 0,
        nat20Count: 0,
        avgNat1sPer20: 0,
        avgNat20sPer20: 0,
        luckPercentage: 0,
        luckAmount: 0,
      };
    }

    let sum = 0;
    let nat1Count = 0;
    let nat20Count = 0;
    let luckyCount = 0; // rolls > 10
    let luckAmountSum = 0;

    for (const roll of rollsList) {
      const val = roll.value;
      sum += val;
      
      if (val === 1) nat1Count++;
      if (val === 20) nat20Count++;
      if (val > 10.5) luckyCount++; // Excel checks > 10.5, i.e., 11 or higher
      
      // Luck Amount formula: (2 * val - 21) / 19
      luckAmountSum += (2 * val - 21) / 19;
    }

    return {
      totalRolls,
      sum,
      average: sum / totalRolls,
      nat1Count,
      nat20Count,
      avgNat1sPer20: (nat1Count / totalRolls) * 20,
      avgNat20sPer20: (nat20Count / totalRolls) * 20,
      luckPercentage: luckyCount / totalRolls,
      luckAmount: luckAmountSum / totalRolls,
    };
  }

  // Get cumulative stats across the entire active campaign
  async getCampaignStats(): Promise<RollStats> {
    const campaign = this.state.activeCampaign();
    if (!campaign || !campaign.id) {
      return this.calculateStatsForRolls([]);
    }

    const db = (this.state as any).db;
    const sessions = await db.sessions.where('campaignId').equals(campaign.id).toArray();
    const sessionIds = sessions.map((s: any) => s.id).filter((id: any) => id !== undefined);

    if (sessionIds.length === 0) {
      return this.calculateStatsForRolls([]);
    }

    const rollsList = await db.rolls.where('sessionId').anyOf(sessionIds).toArray();
    return this.calculateStatsForRolls(rollsList);
  }

  // Get cumulative stats per character across the entire active campaign
  async getCharacterCampaignStats(characterId: number): Promise<RollStats> {
    const campaign = this.state.activeCampaign();
    if (!campaign || !campaign.id) {
      return this.calculateStatsForRolls([]);
    }

    const db = (this.state as any).db;
    const sessions = await db.sessions.where('campaignId').equals(campaign.id).toArray();
    const sessionIds = sessions.map((s: any) => s.id).filter((id: any) => id !== undefined);

    if (sessionIds.length === 0) {
      return this.calculateStatsForRolls([]);
    }

    const characterCampaignRolls = await db.rolls
      .where('characterId')
      .equals(characterId)
      .filter((roll: Roll) => sessionIds.includes(roll.sessionId))
      .toArray();

    return this.calculateStatsForRolls(characterCampaignRolls);
  }

  // Get cumulative stats globally for a player across all campaigns
  async getPlayerGlobalStats(playerId: number): Promise<RollStats> {
    const db = (this.state as any).db;
    const chars = await db.characters.where('playerId').equals(playerId).toArray();
    const charIds = chars.map((c: any) => c.id).filter((id: any) => id !== undefined);

    if (charIds.length === 0) {
      return this.calculateStatsForRolls([]);
    }

    const rollsList = await db.rolls.where('characterId').anyOf(charIds).toArray();
    return this.calculateStatsForRolls(rollsList);
  }

  // Get cumulative stats globally for all campaigns combined
  async getGlobalOverviewStats(): Promise<RollStats> {
    const db = (this.state as any).db;
    const rollsList = await db.rolls.toArray();
    return this.calculateStatsForRolls(rollsList);
  }
}
