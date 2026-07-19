import { Component, inject, signal, computed, effect } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { SessionStateService } from '../../services/session-state.service';
import { StatsService, RollStats } from '../../services/stats.service';
import { DatabaseService, Player, Character } from '../../db/database.service';

@Component({
  selector: 'app-analytics-dashboard',
  imports: [DecimalPipe, PercentPipe],
  templateUrl: './analytics-dashboard.html',
  styleUrl: './analytics-dashboard.css',
})
export class AnalyticsDashboardComponent {
  readonly state = inject(SessionStateService);
  readonly stats = inject(StatsService);
  private readonly db = inject(DatabaseService);

  // 'session', 'campaign', or 'global' (cross-campaign)
  statsScope = signal<'session' | 'campaign' | 'global'>('session');

  // Stats cache (reused for campaign & global scopes)
  playerCampaignStats = signal<Record<number, RollStats>>({});
  campaignOverviewStats = signal<RollStats | null>(null);
  isLoadingCampaignStats = signal<boolean>(false);

  // Global scope player listing
  globalPlayers = signal<Player[]>([]);

  // Sort State signals (Default sort by average descending)
  sortField = signal<string>('average');
  sortAscending = signal<boolean>(false);

  constructor() {
    effect(async () => {
      // React to changes in rolls, campaign, or scope
      const rolls = this.state.rolls();
      const campaign = this.state.activeCampaign();
      const scope = this.statsScope();
      
      if (scope === 'campaign' && campaign) {
        await this.loadCampaignStats();
      } else if (scope === 'global') {
        await this.loadGlobalStats();
      }
    });
  }

  async setScope(scope: 'session' | 'campaign' | 'global') {
    this.statsScope.set(scope);
    if (scope === 'campaign') {
      await this.loadCampaignStats();
    } else if (scope === 'global') {
      await this.loadGlobalStats();
    }
  }

  private async loadCampaignStats() {
    const campaign = this.state.activeCampaign();
    if (!campaign || !campaign.id) return;

    this.isLoadingCampaignStats.set(true);
    try {
      // 1. Load Campaign Overview
      const overview = await this.stats.getCampaignStats();
      this.campaignOverviewStats.set(overview);

      // 2. Load Per-Character Stats
      const playerStatsRecord: Record<number, RollStats> = {};
      for (const char of this.state.activeCharacters()) {
        if (char.id !== undefined) {
          playerStatsRecord[char.id] = await this.stats.getCharacterCampaignStats(char.id);
        }
      }
      this.playerCampaignStats.set(playerStatsRecord);
    } catch (e) {
      console.error('Error loading campaign stats:', e);
    } finally {
      this.isLoadingCampaignStats.set(false);
    }
  }

  private async loadGlobalStats() {
    this.isLoadingCampaignStats.set(true);
    try {
      // 1. Load Global Overview (all rolls)
      const overview = await this.stats.getGlobalOverviewStats();
      this.campaignOverviewStats.set(overview);

      // 2. Load players and their global combined stats
      const players = await this.db.players.toArray();
      this.globalPlayers.set(players);

      const playerStatsRecord: Record<number, RollStats> = {};
      for (const p of players) {
        if (p.id !== undefined) {
          playerStatsRecord[p.id] = await this.stats.getPlayerGlobalStats(p.id);
        }
      }
      this.playerCampaignStats.set(playerStatsRecord);
    } catch (e) {
      console.error('Error loading global stats:', e);
    } finally {
      this.isLoadingCampaignStats.set(false);
    }
  }

  // Reactive Stats getter based on scope
  readonly currentStats = computed<RollStats | null>(() => {
    if (this.statsScope() === 'session') {
      return this.stats.sessionStats();
    } else {
      return this.campaignOverviewStats();
    }
  });

  // Reactive computed list for standings with sorting applied
  readonly standingsList = computed(() => {
    const scope = this.statsScope();
    let list: { player: { id: number; name: string; characterName?: string; color: string; isDM: boolean; isActive: boolean }; stats: RollStats }[] = [];

    if (scope === 'session') {
      const sessionMap = this.stats.playerSessionStatsMap();
      list = this.state.activeCharacters().map(c => ({
        player: {
          id: c.id!,
          name: c.playerName || 'Unknown',
          characterName: c.name !== c.playerName ? c.name : undefined,
          color: c.color,
          isDM: !!c.isDM,
          isActive: c.isActive,
        },
        stats: sessionMap.get(c.id!) || this.stats.calculateStatsForRolls([]),
      }));
    } else if (scope === 'campaign') {
      const campStats = this.playerCampaignStats();
      list = this.state.activeCharacters().map(c => ({
        player: {
          id: c.id!,
          name: c.playerName || 'Unknown',
          characterName: c.name !== c.playerName ? c.name : undefined,
          color: c.color,
          isDM: !!c.isDM,
          isActive: c.isActive,
        },
        stats: campStats[c.id!] || this.stats.calculateStatsForRolls([]),
      }));
    } else {
      // Global Scope (aggregated players across all campaigns)
      const playersList = this.globalPlayers();
      const campStats = this.playerCampaignStats();
      
      // Look up colors/DM tags from characters list
      const chars = this.state.activeCharacters();

      list = playersList.map(p => {
        const repChar = chars.find(c => c.playerId === p.id);
        const color = repChar?.color || '#3b82f6';
        const isDM = p.name.toUpperCase() === 'DM' || !!repChar?.isDM;

        return {
          player: {
            id: p.id!,
            name: p.name,
            characterName: undefined, // no single character name globally
            color,
            isDM,
            isActive: true,
          },
          stats: campStats[p.id!] || this.stats.calculateStatsForRolls([]),
        };
      });
    }

    const field = this.sortField();
    const asc = this.sortAscending();
    const multiplier = asc ? 1 : -1;

    return [...list].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (field) {
        case 'player':
          valA = a.player.name.toLowerCase();
          valB = b.player.name.toLowerCase();
          break;
        case 'rolls':
          valA = a.stats.totalRolls;
          valB = b.stats.totalRolls;
          break;
        case 'sum':
          valA = a.stats.sum;
          valB = b.stats.sum;
          break;
        case 'average':
          valA = a.stats.average;
          valB = b.stats.average;
          break;
        case 'lucky':
          valA = a.stats.luckPercentage;
          valB = b.stats.luckPercentage;
          break;
        case 'luckFactor':
          valA = a.stats.luckAmount;
          valB = b.stats.luckAmount;
          break;
        case 'nat1':
          valA = a.stats.nat1Count;
          valB = b.stats.nat1Count;
          break;
        case 'nat1_20':
          valA = a.stats.avgNat1sPer20;
          valB = b.stats.avgNat1sPer20;
          break;
        case 'nat20':
          valA = a.stats.nat20Count;
          valB = b.stats.nat20Count;
          break;
        case 'nat20_20':
          valA = a.stats.avgNat20sPer20;
          valB = b.stats.avgNat20sPer20;
          break;
        default:
          valA = a.stats.average;
          valB = b.stats.average;
      }

      if (valA < valB) return -1 * multiplier;
      if (valA > valB) return 1 * multiplier;
      return 0;
    });
  });

  // Returns list to render in HTML
  getStandingsList() {
    return this.standingsList();
  }

  // Toggle column sorting
  toggleSort(field: string) {
    if (this.sortField() === field) {
      this.sortAscending.set(!this.sortAscending());
    } else {
      this.sortField.set(field);
      this.sortAscending.set(false); // Default descending for new fields
    }
  }

  // Reactive computed extremes (min/max) for column highlighting
  readonly columnExtremes = computed(() => {
    const list = this.standingsList();
    // Only calculate extremes for players who actually have rolls logged (ignores 0 rolls skewing averages)
    const activePlayers = list.filter(item => item.stats.totalRolls > 0);
    if (activePlayers.length < 2) return null; // Need at least 2 players with data to highlight extremes

    const getExtremes = (arr: number[]) => {
      const allSame = arr.every(v => v === arr[0]);
      if (allSame) return { min: null, max: null };
      return {
        min: Math.min(...arr),
        max: Math.max(...arr),
      };
    };

    return {
      rolls: getExtremes(activePlayers.map(item => item.stats.totalRolls)),
      sum: getExtremes(activePlayers.map(item => item.stats.sum)),
      average: getExtremes(activePlayers.map(item => item.stats.average)),
      lucky: getExtremes(activePlayers.map(item => item.stats.luckPercentage)),
      luckFactor: getExtremes(activePlayers.map(item => item.stats.luckAmount)),
      nat1: getExtremes(activePlayers.map(item => item.stats.nat1Count)),
      nat1_20: getExtremes(activePlayers.map(item => item.stats.avgNat1sPer20)),
      nat20: getExtremes(activePlayers.map(item => item.stats.nat20Count)),
      nat20_20: getExtremes(activePlayers.map(item => item.stats.avgNat20sPer20)),
    };
  });

  // Calculate if cell should be highlighted as extreme best (green) or worst (red)
  getCellClass(playerId: number, metric: string, value: number): string {
    const extremes = this.columnExtremes();
    if (!extremes) return '';

    const ext = (extremes as any)[metric];
    if (!ext || ext.min === null || ext.max === null) return '';

    // Ignore players with 0 rolls
    const pStats = this.standingsList().find(item => item.player.id === playerId);
    if (!pStats || pStats.stats.totalRolls === 0) return '';

    if (metric === 'nat1' || metric === 'nat1_20') {
      // Lower is best (lucky), higher is worst (unlucky)
      if (value === ext.min) return 'extreme-best';
      if (value === ext.max) return 'extreme-worst';
    } else {
      // Higher is best, lower is worst
      if (value === ext.max) return 'extreme-best';
      if (value === ext.min) return 'extreme-worst';
    }

    return '';
  }
}
