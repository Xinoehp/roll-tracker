import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from './app';
import { DatabaseService } from './core/db/database.service';
import { StatsService } from './features/analytics/services/stats.service';
import { SessionStateService } from './features/tracker/services/session-state.service';
import { RecapService } from './features/recap/services/recap.service';
import { SettingsService } from './features/settings/services/settings.service';
import { formatRollPosition, formatProbabilityPct } from './features/recap/services/highlight-rules';

// Helper to seed a small mock database for stats validation
async function seedMockDatabase(db: DatabaseService) {
  await db.clearAll();

  // 1. Add campaigns
  const alphaCampaignId = await db.campaigns.add({
    name: 'Campaign Alpha',
    description: 'Alpha campaign',
    createdAt: new Date(),
  });

  const betaCampaignId = await db.campaigns.add({
    name: 'Campaign Beta',
    description: 'Beta campaign',
    createdAt: new Date(),
  });

  // 2. Add global players
  const playerAliceId = await db.players.add({ name: 'Alice', createdAt: new Date() });
  const playerBobId = await db.players.add({ name: 'Bob', createdAt: new Date() });
  const playerCharlieId = await db.players.add({ name: 'Charlie', createdAt: new Date() });
  const playerDavidId = await db.players.add({ name: 'David', createdAt: new Date() });

  // 3. Add campaign-specific characters
  // Campaign 1: Campaign Alpha
  const charAliceAlphaId = await db.characters.add({
    playerId: playerAliceId,
    campaignId: alphaCampaignId,
    name: 'DM',
    color: '#f59e0b',
    isDM: true,
    isActive: true,
    createdAt: new Date(),
  });

  const charBobAlphaId = await db.characters.add({
    playerId: playerBobId,
    campaignId: alphaCampaignId,
    name: 'Fighter',
    color: '#8b5cf6',
    isDM: false,
    isActive: true,
    createdAt: new Date(),
  });

  const charCharlieAlphaId = await db.characters.add({
    playerId: playerCharlieId,
    campaignId: alphaCampaignId,
    name: 'Wizard',
    color: '#3b82f6',
    isDM: false,
    isActive: true,
    createdAt: new Date(),
  });

  // Campaign 2: Campaign Beta
  const charDavidBetaId = await db.characters.add({
    playerId: playerDavidId,
    campaignId: betaCampaignId,
    name: 'DM',
    color: '#ef4444',
    isDM: true,
    isActive: true,
    createdAt: new Date(),
  });

  const charCharlieBetaId = await db.characters.add({
    playerId: playerCharlieId,
    campaignId: betaCampaignId,
    name: 'Wizard',
    color: '#3b82f6',
    isDM: false,
    isActive: true,
    createdAt: new Date(),
  });

  const charBobBetaId = await db.characters.add({
    playerId: playerBobId,
    campaignId: betaCampaignId,
    name: 'Fighter',
    color: '#8b5cf6',
    isDM: false,
    isActive: true,
    createdAt: new Date(),
  });

  // 4. Add Sessions
  const alphaS1 = await db.sessions.add({
    campaignId: alphaCampaignId,
    name: 'Session 1',
    date: '2026-07-01',
    createdAt: new Date(),
  });
  const alphaS2 = await db.sessions.add({
    campaignId: alphaCampaignId,
    name: 'Session 2',
    date: '2026-07-02',
    createdAt: new Date(),
  });
  const betaS1 = await db.sessions.add({
    campaignId: betaCampaignId,
    name: 'Session 1',
    date: '2026-07-01',
    createdAt: new Date(),
  });

  // 5. Add rolls
  await db.rolls.add({ sessionId: alphaS1, characterId: charAliceAlphaId, value: 10, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS1, characterId: charAliceAlphaId, value: 20, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS2, characterId: charAliceAlphaId, value: 15, createdAt: new Date() });

  await db.rolls.add({ sessionId: alphaS1, characterId: charBobAlphaId, value: 1, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS1, characterId: charBobAlphaId, value: 2, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS1, characterId: charBobAlphaId, value: 3, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS2, characterId: charBobAlphaId, value: 4, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS2, characterId: charBobAlphaId, value: 5, createdAt: new Date() });

  await db.rolls.add({ sessionId: alphaS1, characterId: charCharlieAlphaId, value: 10, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS1, characterId: charCharlieAlphaId, value: 11, createdAt: new Date() });
  await db.rolls.add({ sessionId: alphaS1, characterId: charCharlieAlphaId, value: 12, createdAt: new Date() });

  await db.rolls.add({ sessionId: betaS1, characterId: charDavidBetaId, value: 20, createdAt: new Date() });
  await db.rolls.add({ sessionId: betaS1, characterId: charDavidBetaId, value: 20, createdAt: new Date() });
  await db.rolls.add({ sessionId: betaS1, characterId: charDavidBetaId, value: 20, createdAt: new Date() });

  await db.rolls.add({ sessionId: betaS1, characterId: charCharlieBetaId, value: 10, createdAt: new Date() });
  await db.rolls.add({ sessionId: betaS1, characterId: charCharlieBetaId, value: 10, createdAt: new Date() });
  await db.rolls.add({ sessionId: betaS1, characterId: charCharlieBetaId, value: 10, createdAt: new Date() });

  await db.rolls.add({ sessionId: betaS1, characterId: charBobBetaId, value: 1, createdAt: new Date() });
  await db.rolls.add({ sessionId: betaS1, characterId: charBobBetaId, value: 1, createdAt: new Date() });
  await db.rolls.add({ sessionId: betaS1, characterId: charBobBetaId, value: 1, createdAt: new Date() });

  return {
    campaigns: { alphaCampaignId: alphaCampaignId, betaCampaignId: betaCampaignId },
    players: { playerAliceId: playerAliceId, playerBobId: playerBobId, playerCharlieId: playerCharlieId, playerDavidId: playerDavidId },
    characters: { charAliceAlphaId: charAliceAlphaId, charBobAlphaId: charBobAlphaId, charCharlieAlphaId: charCharlieAlphaId, charDavidBetaId: charDavidBetaId, charCharlieBetaId: charCharlieBetaId, charBobBetaId: charBobBetaId }
  };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [DatabaseService, StatsService, SessionStateService]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should correctly map compressed sharedRecapData player array in sharedPlayers computed signal', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.sharedRecapData.set({
      c: 'Campaign Beta',
      s: 'Campaign Summary',
      d: 'All Time',
      r: 'Narrative content',
      p: [
        { n: 'David', c: 'Dungeon Master', dm: true, st: [105, 1177, 11.2, 0.57, 0.07, 6, 9] },
        { n: 'Charlie', c: 'Paladin', dm: false, st: [77, 884, 11.48, 0.60, 0.10, 1, 5] }
      ]
    });

    const mapped = app.sharedPlayers();
    expect(mapped.length).toBe(2);
    expect(mapped[0]).toEqual({
      playerName: 'David',
      characterName: 'Dungeon Master',
      isDM: true,
      stats: [105, 1177, 11.2, 0.57, 0.07, 6, 9]
    });
    expect(mapped[1]).toEqual({
      playerName: 'Charlie',
      characterName: 'Paladin',
      isDM: false,
      stats: [77, 884, 11.48, 0.60, 0.10, 1, 5]
    });
  });

  it('should initialize sidebar width from localStorage or default to 260px', () => {
    localStorage.setItem('sidebar_width', '320');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.sidebarWidth()).toBe(320);

    localStorage.removeItem('sidebar_width');
    const fixtureDefault = TestBed.createComponent(App);
    const appDefault = fixtureDefault.componentInstance;
    expect(appDefault.sidebarWidth()).toBe(260);
  });

  it('should toggle keyboard shortcuts setting and persist state in localStorage', () => {
    const settingsService = TestBed.inject(SettingsService);
    
    settingsService.setKeyboardShortcuts(true);
    expect(settingsService.keyboardShortcutsEnabled()).toBe(true);
    expect(localStorage.getItem('keyboard_shortcuts_enabled')).toBe('true');

    settingsService.setKeyboardShortcuts(false);
    expect(settingsService.keyboardShortcutsEnabled()).toBe(false);
    expect(localStorage.getItem('keyboard_shortcuts_enabled')).toBe('false');
  });

  it('should include formatted session date in formatRollPosition when rollDates is provided', () => {
    const posWithDate = formatRollPosition(5, 10, ['2026-04-24', '2026-04-24', '2026-04-24', '2026-04-24', '2026-04-24', '2026-04-24']);
    expect(posWithDate).toContain('on 24/04/2026');
  });

  it('should format probability numbers to clean percentage strings', () => {
    expect(formatProbabilityPct(0.05)).toBe('5.0%');
    expect(formatProbabilityPct(0.0081)).toBe('0.81%');
    expect(formatProbabilityPct(0.0001)).toBe('0.01%');
    expect(formatProbabilityPct(0.000005)).toBe('<0.01%');
  });
});

describe('Database Schema Validation', () => {
  let db: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DatabaseService, StatsService, SessionStateService]
    });
    db = TestBed.inject(DatabaseService);
  });

  it('should seed mock database and verify exact record counts', async () => {
    const ids = await seedMockDatabase(db);
    expect(ids).toBeDefined();

    const campaigns = await db.campaigns.toArray();
    expect(campaigns.length).toBe(2);
    expect(campaigns.map(c => c.name)).toContain('Campaign Alpha');
    expect(campaigns.map(c => c.name)).toContain('Campaign Beta');

    const players = await db.players.toArray();
    expect(players.length).toBe(4);

    const characters = await db.characters.toArray();
    expect(characters.length).toBe(6);

    const sessions = await db.sessions.toArray();
    expect(sessions.length).toBe(3);

    const rollsCount = await db.rolls.count();
    expect(rollsCount).toBe(20);
  });
});

describe('Stats Service Calculation Validation', () => {
  let db: DatabaseService;
  let statsService: StatsService;
  let stateService: SessionStateService;
  let seedIds: any;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [DatabaseService, StatsService, SessionStateService]
    });
    db = TestBed.inject(DatabaseService);
    statsService = TestBed.inject(StatsService);
    stateService = TestBed.inject(SessionStateService);

    seedIds = await seedMockDatabase(db);
  });

  it('should calculate stats for Campaign Alpha campaign characters correctly', async () => {
    const campaign = await db.campaigns.get(seedIds.campaigns.alphaCampaignId);
    expect(campaign).toBeDefined();
    await stateService.setCampaign(campaign!);

    // Alice (DM) Campaign Stats
    const computedAlice = await statsService.getCharacterCampaignStats(seedIds.characters.charAliceAlphaId);
    expect(computedAlice.totalRolls).toBe(3);
    expect(computedAlice.sum).toBe(45);
    expect(computedAlice.average).toBe(15);
    expect(computedAlice.nat1Count).toBe(0);
    expect(computedAlice.nat20Count).toBe(1);
    expect(computedAlice.luckPercentage).toBeCloseTo(0.66667, 5);
    expect(computedAlice.luckAmount).toBeCloseTo(0.47368, 5);

    // Bob (Fighter) Campaign Stats
    const computedBob = await statsService.getCharacterCampaignStats(seedIds.characters.charBobAlphaId);
    expect(computedBob.totalRolls).toBe(5);
    expect(computedBob.sum).toBe(15);
    expect(computedBob.average).toBe(3);
    expect(computedBob.nat1Count).toBe(1);
    expect(computedBob.nat20Count).toBe(0);
    expect(computedBob.luckPercentage).toBe(0);
    expect(computedBob.luckAmount).toBeCloseTo(-0.78947, 5);
  });

  it('should calculate stats for Campaign Beta campaign characters correctly', async () => {
    const campaign = await db.campaigns.get(seedIds.campaigns.betaCampaignId);
    expect(campaign).toBeDefined();
    await stateService.setCampaign(campaign!);

    // David (DM) Campaign Stats
    const computedDavid = await statsService.getCharacterCampaignStats(seedIds.characters.charDavidBetaId);
    expect(computedDavid.totalRolls).toBe(3);
    expect(computedDavid.sum).toBe(60);
    expect(computedDavid.average).toBe(20);
    expect(computedDavid.nat1Count).toBe(0);
    expect(computedDavid.nat20Count).toBe(3);
    expect(computedDavid.luckPercentage).toBe(1.0);
    expect(computedDavid.luckAmount).toBeCloseTo(1.0, 5);

    // Bob (Fighter) Campaign Stats
    const computedBob = await statsService.getCharacterCampaignStats(seedIds.characters.charBobBetaId);
    expect(computedBob.totalRolls).toBe(3);
    expect(computedBob.sum).toBe(3);
    expect(computedBob.average).toBe(1);
    expect(computedBob.nat1Count).toBe(3);
    expect(computedBob.nat20Count).toBe(0);
    expect(computedBob.luckPercentage).toBe(0);
    expect(computedBob.luckAmount).toBeCloseTo(-1.0, 5);
  });

  it('should calculate global cross-campaign stats for players correctly', async () => {

    const globalStatsBob = await statsService.getPlayerGlobalStats(seedIds.players.playerBobId);
    expect(globalStatsBob.totalRolls).toBe(8);
    expect(globalStatsBob.sum).toBe(18);

    const globalStatsCharlie = await statsService.getPlayerGlobalStats(seedIds.players.playerCharlieId);
    expect(globalStatsCharlie.totalRolls).toBe(6);
    expect(globalStatsCharlie.sum).toBe(63);
  });
});

describe('Recap Service and URL Sharing Validation', () => {
  let recapService: RecapService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RecapService]
    });
    recapService = TestBed.inject(RecapService);
  });

  it('should compress and decompress recap payloads correctly (round-trip)', async () => {
    const payload = {
      c: 'Campaign Alpha',
      s: 'Session 42',
      d: '2026-07-19',
      r: 'Gather round adventurers! Today was epic.',
      p: [
        { n: 'Alice', c: 'DM', dm: true, st: [12, 140, 11.6, 0.5, 0.05, 1, 2] }
      ]
    };

    const compressed = await recapService.compressRecap(payload);
    expect(compressed).toBeDefined();
    expect(typeof compressed).toBe('string');
    expect(compressed).not.toContain('+');
    expect(compressed).not.toContain('/');
    expect(compressed).not.toContain('=');

    const decompressed = await recapService.decompressRecap(compressed);
    expect(decompressed).toEqual(payload);
  });

  it('should generate appropriate statistical highlights based on roll arrays', () => {
    const context = {
      highestAvgPlayer: 'Charlie',
      lowestAvgPlayer: 'Eve',
      highestAvg: 14.5,
      lowestAvg: 8.2,
      mostRollsPlayer: 'DM',
      mostRollsCount: 45
    };

    // 1. Check average highlight
    const normalRolls = [10, 12, 15, 8, 11, 14];
    const h1 = recapService.generateHighlights('Bob', 'Fighter', false, normalRolls, context);
    expect(h1.length).toBeGreaterThan(0);
    const avgHighlight = h1.find(h => h.id === 'base_average');
    expect(avgHighlight).toBeDefined();
    expect(avgHighlight?.label).toContain('Average roll of 11.7');

    // 2. Check zero rolls highlight
    const hZero = recapService.generateHighlights('Frank', 'Rogue', false, [], context);
    expect(hZero.length).toBe(1);
    expect(hZero[0].id).toBe('zero_rolls');
    expect(hZero[0].emoji).toBe('🤫');

    // 3. Check Crit Master highlight
    const critRolls = [1, 1, 20, 20, 10, 15];
    const hCrit = recapService.generateHighlights('Alice', 'DM', true, critRolls, context);
    const critHighlight = hCrit.find(h => h.id === 'crit_master_both');
    expect(critHighlight).toBeDefined();
    expect(critHighlight?.emoji).toBe('⚡');

    // 4. Check Consistent Crusader highlight
    const consistentRolls = [10, 11, 12, 10, 11, 12];
    const hConst = recapService.generateHighlights('Charlie', 'Wizard', false, consistentRolls, context);
    const constHighlight = hConst.find(h => h.id === 'consistent_crusader');
    expect(constHighlight).toBeDefined();
    expect(constHighlight?.emoji).toBe('🛡️');
  });
});
