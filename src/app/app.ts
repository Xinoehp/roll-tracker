import { Component, inject, signal, effect, computed, OnInit } from '@angular/core';
import { DatabaseService, Campaign, Session, Player, Character } from './db/database.service';
import { SessionStateService } from './services/session-state.service';
import { RollEntryNumpadComponent } from './components/roll-entry-numpad/roll-entry-numpad';
import { AnalyticsDashboardComponent } from './components/analytics-dashboard/analytics-dashboard';
import { RecentRollsFeedComponent } from './components/recent-rolls-feed/recent-rolls-feed';
import { SessionRecapViewComponent, RecapPlayerData } from './components/session-recap-view/session-recap-view';
import { RecapService, StatHighlight } from './services/recap.service';
import { SettingsViewComponent } from './components/settings-view/settings-view';

@Component({
  selector: 'app-root',
  imports: [
    RollEntryNumpadComponent,
    AnalyticsDashboardComponent,
    RecentRollsFeedComponent,
    SessionRecapViewComponent,
    SettingsViewComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly db = inject(DatabaseService);
  readonly state = inject(SessionStateService);
  private readonly recapService = inject(RecapService);

  // Shell navigation and sidebar state
  activeTab = signal<'numpad' | 'analytics' | 'logs' | 'recap' | 'settings'>('numpad');
  sidebarWidth = signal<number>(parseInt(localStorage.getItem('sidebar_width') || '260'));
  campaignsList = signal<Campaign[]>([]);
  sessionsList = signal<Session[]>([]);

  startResizing(event: MouseEvent) {
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
  showCampaignForm = signal<boolean>(false);
  showSessionForm = signal<boolean>(false);
  showPlayerForm = signal<boolean>(false);

  // Form input bindings (simple string signals)
  newCampaignName = signal<string>('');
  newCampaignDesc = signal<string>('');
  newSessionName = signal<string>('');
  newSessionDate = signal<string>('');
  newPlayerName = signal<string>('');
  newPlayerColor = signal<string>('#3b82f6'); // Default Blue
  newPlayerCharName = signal<string>('');
  newPlayerIsDM = signal<boolean>(false);

  // Dropdown player select bindings
  globalPlayers = signal<Player[]>([]);
  selectedPlayerId = signal<string>('new');

  // Edit player form bindings
  showEditPlayerForm = signal<boolean>(false);
  editingPlayerId = signal<number | null>(null);
  editPlayerName = signal<string>('');
  editPlayerCharName = signal<string>('');
  editPlayerColor = signal<string>('');
  editPlayerIsDM = signal<boolean>(false);

  // Edit session form bindings
  editSessionName = signal<string>('');
  editSessionDate = signal<string>('');
  editSessionNotes = signal<string>('');

  // Colors list for player creation
  readonly presetColors = [
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f97316', // Orange
  ];

  constructor() {
    // Automatically load the sessions list when the active campaign changes
    effect(async () => {
      const activeCamp = this.state.activeCampaign();
      if (activeCamp && activeCamp.id !== undefined) {
        await this.loadSessionsForCampaign(activeCamp.id);
      } else {
        this.sessionsList.set([]);
      }
    });

    // Populate edit session form when state triggers edit modal
    effect(() => {
      if (this.state.showEditSessionModal()) {
        const session = this.state.activeSession();
        if (session) {
          this.editSessionName.set(session.name);
          this.editSessionDate.set(session.date);
          this.editSessionNotes.set(session.notes || '');
        }
      }
    });

    // Automatically load/refresh recap data when activeTab is 'recap', or when campaign/session/recapType/characters change
    effect(async () => {
      const tab = this.activeTab();
      const camp = this.state.activeCampaign();
      const sess = this.state.activeSession();
      const type = this.recapType();
      const chars = this.state.activeCharacters(); // tracks character visibility toggles in the sidebar

      if (tab === 'recap' && camp) {
        await this.loadRecapData(type);
      }
    });
  }

  async ngOnInit() {
    await this.refreshCampaigns();
    await this.loadGlobalPlayers();
    // Default form date to today
    this.newSessionDate.set(new Date().toISOString().split('T')[0]);

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
  async loadGlobalPlayers() {
    const list = await this.db.players.toArray();
    this.globalPlayers.set(list);
  }

  // Load list of all campaigns
  async refreshCampaigns() {
    const list = await this.db.campaigns.orderBy('id').reverse().toArray();
    this.campaignsList.set(list);
  }

  // Load sessions for the active campaign
  async loadSessionsForCampaign(campaignId: number) {
    const list = await this.db.sessions
      .where('campaignId')
      .equals(campaignId)
      .reverse()
      .sortBy('date'); // Sort by date descending
    this.sessionsList.set(list);
  }

  // Select campaign from sidebar by ID
  async selectCampaignById(id: number) {
    const campaign = this.campaignsList().find(c => c.id === id);
    if (campaign) {
      await this.state.setCampaign(campaign);
    }
  }

  // Select session from sidebar
  async selectSession(session: Session) {
    await this.state.setSession(session);
  }

  // Create Campaign
  async handleCreateCampaign() {
    const name = this.newCampaignName().trim();
    if (!name) return;

    const newCamp = await this.state.createCampaign(name, this.newCampaignDesc().trim());
    await this.refreshCampaigns();

    // Clear inputs and hide form
    this.newCampaignName.set('');
    this.newCampaignDesc.set('');
    this.showCampaignForm.set(false);
  }

  // Open New Session Form with auto-numbering
  openNewSessionForm() {
    const nextNum = this.sessionsList().length + 1;
    this.newSessionName.set(`Session ${nextNum}`);
    this.newSessionDate.set(new Date().toISOString().split('T')[0]);
    this.showSessionForm.set(true);
  }

  // Create Session
  async handleCreateSession() {
    const name = this.newSessionName().trim();
    const date = this.newSessionDate().trim();
    if (!name || !date) return;

    const activeCamp = this.state.activeCampaign();
    if (!activeCamp || activeCamp.id === undefined) return;

    await this.state.createSession(name, date);
    await this.loadSessionsForCampaign(activeCamp.id);

    // Clear inputs and hide form
    this.newSessionName.set('');
    this.newSessionDate.set(new Date().toISOString().split('T')[0]);
    this.showSessionForm.set(false);
  }

  // Save session edits
  async handleUpdateSession() {
    const session = this.state.activeSession();
    if (!session || !session.id) return;

    const name = this.editSessionName().trim();
    const date = this.editSessionDate().trim();
    if (!name || !date) return;

    const updatedSession: Session = {
      ...session,
      name,
      date,
      notes: this.editSessionNotes().trim(),
    };

    await this.db.sessions.put(updatedSession);
    this.state.activeSession.set(updatedSession);

    // Refresh the sidebar sessions list
    const activeCamp = this.state.activeCampaign();
    if (activeCamp && activeCamp.id !== undefined) {
      await this.loadSessionsForCampaign(activeCamp.id);
    }

    // Close the modal
    this.state.showEditSessionModal.set(false);
  }

  // Add Character to campaign (with optional new player creation or existing selection)
  async handleAddPlayer() {
    const selectedId = this.selectedPlayerId();
    const charName = this.newPlayerCharName().trim();
    const color = this.newPlayerColor();
    const isDM = this.newPlayerIsDM();

    // Character name is required
    if (!charName) return;

    let playerName = '';
    if (selectedId === 'new') {
      playerName = this.newPlayerName().trim();
      if (!playerName) return; // Player name required if creating new
    } else {
      const player = this.globalPlayers().find(p => p.id === parseInt(selectedId));
      if (!player) return;
      playerName = player.name;
    }

    await this.state.addCharacter(playerName, color, isDM, charName);
    await this.loadGlobalPlayers(); // Refresh dropdown list

    // Clear inputs and hide form
    this.newPlayerName.set('');
    this.newPlayerCharName.set('');
    this.newPlayerIsDM.set(false);
    this.newPlayerColor.set(this.presetColors[0]);
    this.selectedPlayerId.set('new');
    this.showPlayerForm.set(false);
  }

  // Open Edit Player Form
  openEditPlayerForm(player: Character, event: Event) {
    event.stopPropagation(); // Avoid triggering parent item clicks
    if (!player.id) return;
    this.editingPlayerId.set(player.id);
    this.editPlayerName.set(player.name);
    this.editPlayerCharName.set(player.name);
    this.loadPlayerNameForEdit(player);

    this.editPlayerColor.set(player.color);
    this.editPlayerIsDM.set(!!player.isDM);
    this.showEditPlayerForm.set(true);
  }

  private async loadPlayerNameForEdit(character: Character) {
    const player = await this.db.players.get(character.playerId);
    if (player) {
      this.editPlayerName.set(player.name);
      this.editPlayerCharName.set(character.name);
    }
  }

  // Save Player edits
  async handleUpdatePlayer() {
    const characterId = this.editingPlayerId();
    if (characterId === null) return;

    const playerName = this.editPlayerName().trim();
    const color = this.editPlayerColor();
    const characterName = this.editPlayerCharName().trim();
    const isDM = this.editPlayerIsDM();
    if (!playerName || !characterName) return;

    const character = await this.db.characters.get(characterId);
    if (character) {
      // 1. Update global Player name
      const player = await this.db.players.get(character.playerId);
      if (player && player.name !== playerName) {
        player.name = playerName;
        await this.db.players.put(player);
      }

      // 2. Update campaign Character
      const updatedChar: Character = {
        ...character,
        name: characterName,
        color,
        isDM,
      };
      await this.db.characters.put(updatedChar);
      await this.state.refreshCharacters();
      await this.loadGlobalPlayers(); // Sync dropdown
    }

    this.showEditPlayerForm.set(false);
    this.editingPlayerId.set(null);
  }

  // Toggle Character active/inactive status
  toggleCharacterActive(characterId: number, event: Event) {
    event.stopPropagation();
    this.state.toggleCharacterActive(characterId);
  }

  // Remove Player (Character)
  async handleRemovePlayer(characterId: number, event: Event) {
    event.stopPropagation(); // Avoid selecting the player card when clicking delete
    if (confirm('Are you sure you want to delete this player? This will erase all of their historical rolls!')) {
      await this.state.deleteCharacter(characterId);
      await this.loadGlobalPlayers(); // Sync dropdown
    }
  }

  // Set selected player ID from dropdown
  setSelectedPlayerId(e: Event) {
    this.selectedPlayerId.set((e.target as HTMLSelectElement).value);
  }

  // Recap State & Signals
  recapAvailableHighlights = signal<Record<number, StatHighlight[]>>({});
  recapSelectedHighlights = signal<Record<number, string[]>>({});
  recapAttendance = signal<Record<number, boolean>>({});
  recapType = signal<'session' | 'campaign'>('session');
  sharedRecapData = signal<any | null>(null);
  sharedPlayers = computed<RecapPlayerData[]>(() => {
    const data = this.sharedRecapData();
    if (!data || !data.p) return [];
    return data.p.map((player: any) => ({
      playerName: player.n,
      characterName: player.c,
      isDM: !!player.dm,
      stats: player.st
    }));
  });
  recapAlertMessage = signal<string>('');

  recapCharactersList = signal<Character[]>([]);
  recapCharacterRolls = signal<Record<number, number[]>>({});

  activeRecapCharacters = computed(() => {
    return this.recapCharactersList().filter(c => c.isActive);
  });

  hasHiddenPlayers = computed(() => {
    return this.recapCharactersList().some(c => !c.isActive);
  });

  private transientTimer: any = null;
  showTransientMessage(msg: string) {
    if (this.transientTimer) {
      clearTimeout(this.transientTimer);
    }
    this.recapAlertMessage.set(msg);
    this.transientTimer = setTimeout(() => {
      this.recapAlertMessage.set('');
      this.transientTimer = null;
    }, 3000);
  }

  setRecapType(type: 'session' | 'campaign') {
    this.recapType.set(type);
  }

  async loadRecapData(type: 'session' | 'campaign') {
    const campaignId = this.state.activeCampaign()?.id;
    if (!campaignId) return;

    this.recapType.set(type);

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
    const sessionId = type === 'session' ? this.state.activeSession()?.id : undefined;

    for (const char of characters) {
      let charRolls: number[] = [];
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
      }
      rollsMap[char.id!] = charRolls;
    }
    this.recapCharacterRolls.set(rollsMap);
    this.recapCharactersList.set(characters);

    // Calculate averages and context for the RecapService
    let highestAvg = -1;
    let highestAvgPlayer = '';
    let lowestAvg = 21;
    let lowestAvgPlayer = '';
    let mostRollsCount = 0;
    let mostRollsPlayer = '';

    for (const char of characters) {
      const charRolls = rollsMap[char.id!] || [];
      const N = charRolls.length;
      if (N > 0) {
        const charSum = charRolls.reduce((a, b) => a + b, 0);
        const charAvg = charSum / N;
        if (charAvg > highestAvg) {
          highestAvg = charAvg;
          highestAvgPlayer = char.playerName || '';
        }
        if (charAvg < lowestAvg) {
          lowestAvg = charAvg;
          lowestAvgPlayer = char.playerName || '';
        }
        if (N > mostRollsCount) {
          mostRollsCount = N;
          mostRollsPlayer = char.playerName || '';
        }
      }
    }

    const context = {
      highestAvgPlayer,
      lowestAvgPlayer,
      highestAvg,
      lowestAvg,
      mostRollsPlayer,
      mostRollsCount,
    };

    // Generate Highlights and set default selections
    const available: Record<number, StatHighlight[]> = {};
    const selected: Record<number, string[]> = {};
    const attendance: Record<number, boolean> = {};

    for (const char of characters) {
      const charRolls = rollsMap[char.id!] || [];
      const pHighlights = this.recapService.generateHighlights(
        char.playerName || '',
        char.name,
        !!char.isDM,
        charRolls,
        context
      );

      available[char.id!] = pHighlights;
      attendance[char.id!] = charRolls.length > 0 || type === 'campaign'; // Default present if they rolled

      if (pHighlights.length > 0) {
        selected[char.id!] = [pHighlights[0].id];
      } else {
        selected[char.id!] = [];
      }
    }

    this.recapAvailableHighlights.set(available);
    this.recapSelectedHighlights.set(selected);
    this.recapAttendance.set(attendance);
  }

  toggleRecapAttendance(characterId: number) {
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

  toggleRecapHighlight(characterId: number, highlightId: string) {
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

  getRecapPreviewData() {
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

  getCompiledRecapText(): string {
    const lines: string[] = [];
    const type = this.recapType();

    if (type === 'session') {
      const date = this.state.activeSession()?.date;
      lines.push(`🎲 Roll Recap - ${date ? new Date(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Session'} 🎲\n`);
      lines.push(`Gather 'round, brave adventurers, for the recount of our dice-rolling escapades! The results are as unpredictable as ever.\n`);
    } else {
      lines.push(`👑 Campaign Chronicles - ${this.state.activeCampaign()?.name || 'Campaign'} 👑\n`);
      lines.push(`All paths lead to this! Gather 'round as we look back at the grand tally of fate and fortune across our entire campaign!\n`);
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

    lines.push(`Until next time, adventurers, may the dice roll ever in your favor! 🎲`);
    return lines.join('\n');
  }

  copyRawStatsForLLM() {
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

  copyCompiledRecapText() {
    navigator.clipboard.writeText(this.getCompiledRecapText());
    this.showTransientMessage('Recap copied! ✅');
  }

  async generateShareLink() {
    const type = this.recapType();
    const campName = this.state.activeCampaign()?.name || '';
    const sessName = type === 'session' ? (this.state.activeSession()?.name || '') : 'Campaign Summary';
    const sessDate = type === 'session'
      ? (this.state.activeSession()?.date || '')
      : 'All Time';

    const pData = this.getRecapPreviewData().map(p => ({
      n: p.playerName,
      c: p.characterName,
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

  // Utility inputs setters
  setNewCampaignName(e: Event) {
    this.newCampaignName.set((e.target as HTMLInputElement).value);
  }
  setNewCampaignDesc(e: Event) {
    this.newCampaignDesc.set((e.target as HTMLInputElement).value);
  }
  setNewSessionName(e: Event) {
    this.newSessionName.set((e.target as HTMLInputElement).value);
  }
  setNewSessionDate(e: Event) {
    this.newSessionDate.set((e.target as HTMLInputElement).value);
  }
  setNewPlayerName(e: Event) {
    this.newPlayerName.set((e.target as HTMLInputElement).value);
  }
  setNewPlayerColor(color: string) {
    this.newPlayerColor.set(color);
  }

  // Edit Session setters
  setEditSessionName(e: Event) {
    this.editSessionName.set((e.target as HTMLInputElement).value);
  }
  setEditSessionDate(e: Event) {
    this.editSessionDate.set((e.target as HTMLInputElement).value);
  }
  setEditSessionNotes(e: Event) {
    this.editSessionNotes.set((e.target as HTMLInputElement).value);
  }

  // Add/Edit Player setters
  setNewPlayerCharName(e: Event) {
    this.newPlayerCharName.set((e.target as HTMLInputElement).value);
  }
  setNewPlayerIsDM(e: Event) {
    this.newPlayerIsDM.set((e.target as HTMLInputElement).checked);
  }
  setEditPlayerName(e: Event) {
    this.editPlayerName.set((e.target as HTMLInputElement).value);
  }
  setEditPlayerCharName(e: Event) {
    this.editPlayerCharName.set((e.target as HTMLInputElement).value);
  }
  setEditPlayerColor(color: string) {
    this.editPlayerColor.set(color);
  }
  setEditPlayerIsDM(e: Event) {
    this.editPlayerIsDM.set((e.target as HTMLInputElement).checked);
  }

  // Backup entire database state to a JSON file
  async exportDatabase() {
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
  async importDatabase(event: Event) {
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
