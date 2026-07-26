import { Component, inject, signal, effect, computed, OnInit } from '@angular/core';
import { DatabaseService, Campaign, Session, Player, Character } from './core/db/database.service';
import { SessionStateService } from './features/tracker/services/session-state.service';
import { RollEntryNumpadComponent } from './features/tracker/components/roll-entry-numpad/roll-entry-numpad';
import { AnalyticsDashboardComponent } from './features/analytics/components/analytics-dashboard/analytics-dashboard';
import { RecentRollsFeedComponent } from './features/tracker/components/recent-rolls-feed/recent-rolls-feed';
import { SessionRecapViewComponent, RecapPlayerData } from './features/recap/components/session-recap-view/session-recap-view';
import { RecapService, StatHighlight, SessionContext } from './features/recap/services/recap.service';
import { SettingsViewComponent } from './features/settings/components/settings-view/settings-view';
import { SessionDialogComponent } from './features/tracker/components/session-dialog/session-dialog.component';
import { CharacterDialogComponent } from './features/tracker/components/character-dialog/character-dialog.component';
import { CampaignDialogComponent } from './features/tracker/components/campaign-dialog/campaign-dialog.component';
import {
  getRandomSessionIntro,
  getRandomSessionOutro,
  getRandomCampaignIntro,
  getRandomCampaignOutro,
} from './features/recap/services/highlight-flavour';

export interface SharedRecapPayload {
  c?: string;
  s?: string;
  d?: string;
  r?: string;
  p?: { c?: string; dm?: boolean; st?: number[] }[];
}

@Component({
  selector: 'app-root',
  imports: [
    RollEntryNumpadComponent,
    AnalyticsDashboardComponent,
    RecentRollsFeedComponent,
    SessionRecapViewComponent,
    SettingsViewComponent,
    SessionDialogComponent,
    CharacterDialogComponent,
    CampaignDialogComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly db = inject(DatabaseService);
  public readonly state = inject(SessionStateService);
  private readonly recapService = inject(RecapService);

  // Shell navigation and sidebar state
  public readonly activeTab = signal<'numpad' | 'analytics' | 'logs' | 'recap' | 'settings'>('numpad');
  public readonly sidebarWidth = signal<number>(parseInt(localStorage.getItem('sidebar_width') || '260'));
  public readonly campaignsList = signal<Campaign[]>([]);
  public readonly sessionsList = signal<Session[]>([]);

  public startResizing(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.sidebarWidth();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, startWidth + (moveEvent.clientX - startX)));
      this.sidebarWidth.set(newWidth);
    };

    const onMouseUp = () => {
      localStorage.setItem('sidebar_width', this.sidebarWidth().toString());
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // Modal / Form toggle states
  public readonly showCampaignForm = signal<boolean>(false);
  public readonly showSessionForm = signal<boolean>(false);
  public readonly showPlayerForm = signal<boolean>(false);
  public readonly showEditPlayerForm = signal<boolean>(false);
  public readonly editingCharacter = signal<Character | null>(null);

  // Dropdown player select bindings
  public readonly globalPlayers = signal<Player[]>([]);

  public constructor() {
    // Automatically load the sessions list when the active campaign changes
    effect(async () => {
      const activeCamp = this.state.activeCampaign();
      if (activeCamp && activeCamp.id !== undefined) {
        await this.loadSessionsForCampaign(activeCamp.id);
      } else {
        this.sessionsList.set([]);
      }
    });

    // Automatically load/refresh recap data when activeTab is 'recap', or when campaign/session/recapType/characters change
    effect(async () => {
      const tab = this.activeTab();
      const camp = this.state.activeCampaign();
      const type = this.recapType();
      this.state.activeSession();
      this.state.activeCharacters(); // tracks character visibility toggles in the sidebar

      if (tab === 'recap' && camp) {
        await this.loadRecapData(type);
      }
    });
  }

  public async ngOnInit() {
    await this.refreshCampaigns();
    await this.loadGlobalPlayers();

    // Check for sharing URL query param "?share="
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (shareParam) {
      try {
        const decoded = await this.recapService.decompressRecap(shareParam);
        if (decoded) {
          this.sharedRecapData.set(decoded);
          console.log('Successfully loaded shared recap data:', decoded);
        }
      } catch (err) {
        console.error('Failed to decompress shared recap URL:', err);
      }
    }
  }

  // Load all global players from database
  public async loadGlobalPlayers() {
    const list = await this.db.players.toArray();
    this.globalPlayers.set(list);
  }

  // Load list of all campaigns
  public async refreshCampaigns() {
    const list = await this.db.campaigns.orderBy('id').reverse().toArray();
    this.campaignsList.set(list);
  }

  // Load sessions for the active campaign
  public async loadSessionsForCampaign(campaignId: number) {
    const list = await this.db.sessions
      .where('campaignId')
      .equals(campaignId)
      .reverse()
      .sortBy('date'); // Sort by date descending
    this.sessionsList.set(list);
  }

  // Select campaign from sidebar by ID
  public async selectCampaignById(id: number) {
    const campaign = this.campaignsList().find(c => c.id === id);
    if (campaign) {
      await this.state.setCampaign(campaign);
    }
  }

  // Select session from sidebar
  public async selectSession(session: Session) {
    await this.state.setSession(session);
  }

  // Create Campaign handler from CampaignDialogComponent
  public async handleCreateCampaign(data: { name: string; description: string }) {
    if (!data.name.trim()) return;

    await this.state.createCampaign(data.name.trim(), data.description.trim());
    await this.refreshCampaigns();
    this.showCampaignForm.set(false);
    this.showTransientMessage(`Campaign "${data.name}" created! ✅`);
  }

  // Open New Session Form
  public openNewSessionForm() {
    this.showSessionForm.set(true);
  }

  // Create Session handler from SessionDialogComponent
  public async handleCreateSession(data: { name: string; date: string; notes: string }) {
    const activeCamp = this.state.activeCampaign();
    if (!activeCamp || activeCamp.id === undefined) return;

    await this.state.createSession(data.name.trim(), data.date.trim(), data.notes.trim());
    await this.loadSessionsForCampaign(activeCamp.id);
    this.showSessionForm.set(false);
    this.showTransientMessage(`Session "${data.name}" created! ✅`);
  }

  // Open edit modal for a session
  public openEditSessionModal(session: Session, event?: Event) {
    if (event) event.stopPropagation();
    this.state.activeSession.set(session);
    this.state.showEditSessionModal.set(true);
  }

  // Save session edits handler from SessionDialogComponent
  public async handleUpdateSession(data: { name: string; date: string; notes: string }) {
    const session = this.state.activeSession();
    if (!session || !session.id) return;

    const updatedSession: Session = {
      ...session,
      name: data.name.trim(),
      date: data.date.trim(),
      notes: data.notes.trim(),
    };

    await this.db.sessions.put(updatedSession);
    this.state.activeSession.set(updatedSession);

    const activeCamp = this.state.activeCampaign();
    if (activeCamp && activeCamp.id !== undefined) {
      await this.loadSessionsForCampaign(activeCamp.id);
    }

    this.state.showEditSessionModal.set(false);
    this.showTransientMessage(`Session details updated.`);
  }

  // Delete a session and its associated rolls
  public async handleDeleteSession(session?: Session | null, event?: Event) {
    if (event) event.stopPropagation();
    const targetSession = session || this.state.activeSession();
    if (!targetSession || !targetSession.id) return;

    const confirmMsg = `Are you sure you want to delete session "${targetSession.name}"? All rolls recorded in this session will be permanently deleted.`;
    if (!confirm(confirmMsg)) return;

    await this.db.rolls.where('sessionId').equals(targetSession.id).delete();
    await this.db.sessions.delete(targetSession.id);

    const activeCamp = this.state.activeCampaign();
    if (activeCamp && activeCamp.id !== undefined) {
      await this.loadSessionsForCampaign(activeCamp.id);
    }

    if (this.state.activeSession()?.id === targetSession.id) {
      const remaining = this.sessionsList();
      if (remaining.length > 0) {
        await this.selectSession(remaining[0]);
      } else {
        this.state.activeSession.set(null);
        this.state.rolls.set([]);
      }
    }

    this.state.showEditSessionModal.set(false);
    this.showTransientMessage(`Session "${targetSession.name}" deleted.`);
  }

  // Add Character handler from CharacterDialogComponent
  public async handleAddPlayer(data: { playerName: string; characterName: string; color: string; isDM: boolean; selectedPlayerId: string }) {
    let playerName = data.playerName;
    if (data.selectedPlayerId !== 'new') {
      const p = this.globalPlayers().find(pl => pl.id === parseInt(data.selectedPlayerId));
      if (p) playerName = p.name;
    }

    await this.state.addCharacter(playerName, data.color, data.isDM, data.characterName);
    await this.loadGlobalPlayers();
    this.showPlayerForm.set(false);
    this.showTransientMessage(`Character "${data.characterName}" added! ✅`);
  }

  // Open Edit Player Form
  public openEditPlayerForm(player: Character, event: Event) {
    event.stopPropagation();
    if (!player.id) return;
    this.editingCharacter.set(player);
    this.showEditPlayerForm.set(true);
  }

  // Save Player edits handler from CharacterDialogComponent
  public async handleUpdatePlayer(data: { playerName: string; characterName: string; color: string; isDM: boolean; selectedPlayerId: string }) {
    const character = this.editingCharacter();
    if (!character || !character.id) return;

    const updatedChar: Character = {
      ...character,
      name: data.characterName,
      color: data.color,
      isDM: data.isDM,
    };

    if (data.playerName) {
      const player = await this.db.players.get(character.playerId);
      if (player && player.name !== data.playerName) {
        player.name = data.playerName;
        await this.db.players.put(player);
      }
    }

    await this.db.characters.put(updatedChar);
    await this.state.refreshCharacters();
    await this.loadGlobalPlayers();

    this.showEditPlayerForm.set(false);
    this.editingCharacter.set(null);
    this.showTransientMessage(`Character updated.`);
  }

  // Toggle Character active/inactive status
  public toggleCharacterActive(characterId: number, event: Event) {
    event.stopPropagation();
    this.state.toggleCharacterActive(characterId);
  }

  // Remove Player (Character)
  public async handleRemovePlayer(characterId: number, event: Event) {
    event.stopPropagation(); // Avoid selecting the player card when clicking delete
    if (confirm('Are you sure you want to delete this player? This will erase all of their historical rolls!')) {
      await this.state.deleteCharacter(characterId);
      await this.loadGlobalPlayers(); // Sync dropdown
    }
  }



  // Recap State & Signals
  public readonly recapAvailableHighlights = signal<Record<number, StatHighlight[]>>({});
  public readonly recapSelectedHighlights = signal<Record<number, string[]>>({});
  public readonly recapAttendance = signal<Record<number, boolean>>({});
  public readonly recapType = signal<'session' | 'campaign'>('session');
  public readonly sharedRecapData = signal<SharedRecapPayload | null>(null);
  public readonly sharedPlayers = computed<RecapPlayerData[]>(() => {
    const data = this.sharedRecapData();
    if (!data || !data.p) return [];
    return data.p.map((player) => {
      const charName = player.c || (player.dm ? 'Our Dungeon Master' : 'Adventurer');
      return {
        playerName: charName,
        characterName: charName,
        isDM: !!player.dm,
        stats: player.st || []
      };
    });
  });
  public readonly recapAlertMessage = signal<string>('');

  public readonly recapCharactersList = signal<Character[]>([]);
  public readonly recapCharacterRolls = signal<Record<number, number[]>>({});

  public readonly activeRecapCharacters = computed(() => {
    return this.recapCharactersList().filter(c => c.isActive);
  });

  public readonly hasHiddenPlayers = computed(() => {
    return this.recapCharactersList().some(c => !c.isActive);
  });

  private transientTimer: ReturnType<typeof setTimeout> | null = null;
  public showTransientMessage(msg: string) {
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
    }
    this.recapAlertMessage.set(msg);
    this.transientTimer = setTimeout(() => {
      this.recapAlertMessage.set('');
      this.transientTimer = null;
    }, 3000);
  }

  public setRecapType(type: 'session' | 'campaign') {
    this.recapType.set(type);
  }

  public async loadRecapData(type: 'session' | 'campaign') {
    const campaignId = this.state.activeCampaign()?.id;
    if (!campaignId) return;

    this.recapType.set(type);
    this.rerollIntroOutro();

    // Fetch all characters in the campaign and resolve playerName from the Players table
    const rawCharacters = await this.db.characters.where('campaignId').equals(campaignId).toArray();
    const characters = await Promise.all(
      rawCharacters.map(async c => {
        const player = await this.db.players.get(c.playerId);
        return { ...c, playerName: player ? player.name : 'Unknown' };
      })
    );

    // Fetch rolls per character in the selected scope
    const rollsMap: Record<number, number[]> = {};
    const rollDatesMap: Record<number, string[]> = {};
    const sessionId = type === 'session' ? this.state.activeSession()?.id : undefined;

    // Pre-fetch session dates if generating a campaign-wide recap
    const sessionDateMap = new Map<number, string>();
    if (type === 'campaign') {
      const campaignId = this.state.activeCampaign()?.id;
      if (campaignId) {
        const campaignSessions = await this.db.sessions.where('campaignId').equals(campaignId).toArray();
        campaignSessions.forEach(s => sessionDateMap.set(s.id!, s.date));
      }
    }

    for (const char of characters) {
      let charRolls: number[] = [];
      let charRollDates: string[] = [];
      if (type === 'session') {
        if (sessionId) {
          const rawRolls = await this.db.rolls
            .where('sessionId')
            .equals(sessionId)
            .filter(r => r.characterId === char.id)
            .toArray();
          charRolls = rawRolls.map(r => r.value);
        }
      } else {
        const rawRolls = await this.db.rolls.where('characterId').equals(char.id!).toArray();
        charRolls = rawRolls.map(r => r.value);
        charRollDates = rawRolls.map(r => sessionDateMap.get(r.sessionId) || '');
      }
      rollsMap[char.id!] = charRolls;
      rollDatesMap[char.id!] = charRollDates;
    }
    this.recapCharacterRolls.set(rollsMap);
    this.recapCharactersList.set(characters);

    // Calculate averages and context for the RecapService
    // Generate Highlights and set default selections
    const highlightsMap: Record<number, StatHighlight[]> = {};
    const attendance: Record<number, boolean> = {};
    const selected: Record<number, string[]> = {};

    let totalRollsCount = 0;
    const rollsCountMap: Record<number, number> = {};

    for (const char of characters) {
      if (!char.id) continue;

      let rVals: number[];

      if (type === 'session') {
        const sessId = this.state.activeSession()?.id;
        if (!sessId) continue;
        const rolls = await this.db.rolls.where('sessionId').equals(sessId).toArray();
        rVals = rolls.filter(r => r.characterId === char.id).map(r => r.value);
      } else {
        const sessions = await this.db.sessions.where('campaignId').equals(campaignId).sortBy('date');
        const sessIds = sessions.map(s => s.id!).filter(id => id !== undefined);

        const allSessRolls = await this.db.rolls
          .where('characterId')
          .equals(char.id)
          .filter(r => sessIds.includes(r.sessionId))
          .toArray();

        rVals = allSessRolls.map(r => r.value);
      }

      rollsMap[char.id] = rVals;
      rollsCountMap[char.id] = rVals.length;
      totalRollsCount += rVals.length;
    }

    const sessContext: SessionContext = {
      totalRollsInSession: totalRollsCount,
      playerRollCounts: rollsCountMap,
    };

    for (const char of characters) {
      if (!char.id) continue;
      const rVals = rollsMap[char.id] || [];

      const highlights = this.recapService.generateHighlights(
        char.playerName || 'Player',
        char.name,
        !!char.isDM,
        rVals,
        sessContext
      );

      highlightsMap[char.id] = highlights;
      attendance[char.id] = true;
      selected[char.id] = highlights.length > 0 ? [highlights[0].id] : [];
    }

    this.recapCharacterRolls.set(rollsMap);
    this.recapAvailableHighlights.set(highlightsMap);
    this.recapSelectedHighlights.set(selected);
    this.recapAttendance.set(attendance);
  }

  public toggleRecapAttendance(characterId: number) {
    const att = { ...this.recapAttendance() };
    att[characterId] = !att[characterId];
    this.recapAttendance.set(att);

    if (att[characterId]) {
      const selected = { ...this.recapSelectedHighlights() };
      const available = this.recapAvailableHighlights()[characterId] || [];
      if ((selected[characterId] || []).length === 0 && available.length > 0) {
        selected[characterId] = [available[0].id];
        this.recapSelectedHighlights.set(selected);
      }
    }
  }

  public toggleRecapHighlight(characterId: number, highlightId: string) {
    const selected = { ...this.recapSelectedHighlights() };
    const list = selected[characterId] ? [...selected[characterId]] : [];
    const idx = list.indexOf(highlightId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(highlightId);
    }
    selected[characterId] = list;
    this.recapSelectedHighlights.set(selected);
  }

  public getRecapPreviewData() {
    const list: RecapPlayerData[] = [];
    const characters = this.activeRecapCharacters();
    const rollsMap = this.recapCharacterRolls();

    for (const char of characters) {
      if (!this.recapAttendance()[char.id!]) continue;

      const rolls = rollsMap[char.id!] || [];
      const N = rolls.length;
      const sum = rolls.reduce((a, b) => a + b, 0);
      const avg = N > 0 ? sum / N : 0;
      const luckyPct = N > 0 ? rolls.filter(r => r >= 11).length / N : 0;
      const luckAmt = N > 0 ? rolls.reduce((acc, r) => acc + (r - 10.5), 0) / (N * 9.5) : 0;
      const nat1 = rolls.filter(r => r === 1).length;
      const nat20 = rolls.filter(r => r === 20).length;

      list.push({
        playerName: char.playerName || '',
        characterName: char.name,
        isDM: !!char.isDM,
        stats: [N, sum, avg, luckyPct, luckAmt, nat1, nat20]
      });
    }

    return list;
  }

  // Selected intro & outro text signals
  public readonly recapIntro = signal<string>('');
  public readonly recapOutro = signal<string>('');

  public rerollIntroOutro() {
    const type = this.recapType();
    if (type === 'session') {
      this.recapIntro.set(getRandomSessionIntro());
      this.recapOutro.set(getRandomSessionOutro());
    } else {
      this.recapIntro.set(getRandomCampaignIntro());
      this.recapOutro.set(getRandomCampaignOutro());
    }
  }

  public getCompiledRecapText(): string {
    const lines: string[] = [];
    const type = this.recapType();

    if (!this.recapIntro() || !this.recapOutro()) {
      this.rerollIntroOutro();
    }

    if (type === 'session') {
      const date = this.state.activeSession()?.date;
      lines.push(`🎲 Roll Recap - ${date ? new Date(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Session'} 🎲\n`);
      lines.push(`${this.recapIntro()}\n`);
    } else {
      lines.push(`👑 Campaign Chronicles - ${this.state.activeCampaign()?.name || 'Campaign'} 👑\n`);
      lines.push(`${this.recapIntro()}\n`);
    }

    const characters = this.activeRecapCharacters();
    for (const char of characters) {
      if (!this.recapAttendance()[char.id!]) continue;

      const pSelected = this.recapSelectedHighlights()[char.id!] || [];
      const pAvailable = this.recapAvailableHighlights()[char.id!] || [];

      const activeTexts = pAvailable
        .filter(h => pSelected.includes(h.id))
        .map(h => h.textTemplate);

      const activeEmoji = pAvailable
        .filter(h => pSelected.includes(h.id))
        .map(h => h.emoji);

      if (activeTexts.length > 0) {
        const name = char.name || char.playerName;
        const topHighlight = pAvailable.find(h => pSelected.includes(h.id));
        const titleSuffix = topHighlight?.title ? ` ${topHighlight.title}` : '';
        lines.push(`${activeEmoji} ${name}${titleSuffix}:`);
        lines.push(`${activeTexts.join(' ')}\n`);
      }
    }

    lines.push(this.recapOutro());
    return lines.join('\n');
  }

  public copyRawStatsForLLM() {
    const lines: string[] = [];
    const type = this.recapType();
    const campName = this.state.activeCampaign()?.name || 'Campaign';
    const sessName = type === 'session' ? (this.state.activeSession()?.name || 'Session') : 'All Sessions Summary';

    lines.push(`Raw rolls statistics for ${campName} - ${sessName}:`);

    const characters = this.activeRecapCharacters();
    const rollsMap = this.recapCharacterRolls();

    for (const char of characters) {
      if (!this.recapAttendance()[char.id!]) continue;
      const rolls = rollsMap[char.id!] || [];
      const N = rolls.length;
      if (N === 0) {
        lines.push(`- Player: ${char.playerName} (${char.name || 'DM'}), 0 rolls recorded.`);
        continue;
      }
      const sum = rolls.reduce((a, b) => a + b, 0);
      const avg = sum / N;
      const nat1 = rolls.filter(r => r === 1).length;
      const nat20 = rolls.filter(r => r === 20).length;

      lines.push(`- Player: ${char.playerName} (${char.name || 'DM'})`);
      lines.push(`  - Rolls Count: ${N}`);
      lines.push(`  - Rolls Sum: ${sum}`);
      lines.push(`  - Rolls Average: ${avg.toFixed(2)}`);
      lines.push(`  - Critical Hits (20s): ${nat20}`);
      lines.push(`  - Critical Fails (1s): ${nat1}`);
      lines.push(`  - Raw rolls: [${rolls.join(', ')}]`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    this.showTransientMessage('Stats copied! ✅');
  }

  public copyCompiledRecapText() {
    navigator.clipboard.writeText(this.getCompiledRecapText());
    this.showTransientMessage('Recap copied! ✅');
  }

  public async generateShareLink() {
    const type = this.recapType();
    const campName = this.state.activeCampaign()?.name || '';
    const sessName = type === 'session' ? (this.state.activeSession()?.name || '') : 'Campaign Summary';
    const sessDate = type === 'session'
      ? (this.state.activeSession()?.date || '')
      : 'All Time';

    const pData = this.getRecapPreviewData().map(p => ({
      c: p.characterName || (p.isDM ? 'Our Dungeon Master' : p.playerName),
      dm: p.isDM,
      st: p.stats
    }));

    const payload = {
      c: campName,
      s: sessName,
      d: sessDate,
      r: this.getCompiledRecapText(),
      p: pData
    };

    const compressed = await this.recapService.compressRecap(payload);
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${compressed}`;

    await navigator.clipboard.writeText(shareUrl);
    this.showTransientMessage('Share link copied! ✅');
  }



  // Backup entire database state to a JSON file
  public async exportDatabase() {
    try {
      const campaigns = await this.db.campaigns.toArray();
      const players = await this.db.players.toArray();
      const characters = await this.db.characters.toArray();
      const sessions = await this.db.sessions.toArray();
      const rolls = await this.db.rolls.toArray();

      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        campaigns,
        players,
        characters,
        sessions,
        rolls
      };

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `dice_tracker_backup_${dateStr}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export database:', err);
      alert('Failed to export database.');
    }
  }

  // Restore database state from a previously exported JSON backup file
  public async importDatabase(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonText = e.target?.result as string;
        const backup = JSON.parse(jsonText);

        if (!backup.campaigns || !backup.players || !backup.characters || !backup.sessions || !backup.rolls) {
          throw new Error('Invalid backup file structure.');
        }

        const confirmRestore = confirm(
          'Are you sure you want to restore this backup? This will completely overwrite your current database!'
        );
        if (!confirmRestore) return;

        await this.db.clearAll();

        if (backup.campaigns.length > 0) await this.db.campaigns.bulkAdd(backup.campaigns);
        if (backup.players.length > 0) await this.db.players.bulkAdd(backup.players);
        if (backup.characters.length > 0) await this.db.characters.bulkAdd(backup.characters);
        if (backup.sessions.length > 0) await this.db.sessions.bulkAdd(backup.sessions);
        if (backup.rolls.length > 0) await this.db.rolls.bulkAdd(backup.rolls);

        // Refresh app state
        await this.refreshCampaigns();
        await this.loadGlobalPlayers();

        const list = this.campaignsList();
        if (list.length > 0) {
          await this.state.setCampaign(list[0]);
        } else {
          await this.state.setCampaign(null);
        }

        alert('Database successfully restored from backup!');
      } catch (err) {
        console.error('Failed to import backup file:', err);
        alert(`Failed to restore backup: ${err instanceof Error ? err.message : 'Invalid JSON content'}`);
      } finally {
        input.value = '';
      }
    };

    reader.readAsText(file);
  }
}
