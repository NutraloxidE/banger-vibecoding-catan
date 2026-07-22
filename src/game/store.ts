import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  BuildKind, MatchConfig, MatchState, PlayerState, Resource, RESOURCES,
  TERRAIN_RESOURCE, Toast, PlayerStats,
} from './types';
import { generateBoard, desertTileId, pickGoldenTile, vertexScore } from './board';
import {
  COSTS, VP, canAfford, payCost, validSettlementSpots, validRoadSpots, validSpots,
  computeProduction, bankRate, longestRoadLength, computeVp, handSize,
  LONGEST_ROAD_MIN, MEGA_ROAD_REQ,
} from './rules';
import { aiSetupVertex, aiSetupRoad, aiMainAction, aiRobberChoice, aiEvaluateTrade } from './ai';
import { RNG, randomSeedString } from './rng';
import { pickNpcs, settlementName, civTitle, npcLine, PLAYER_COLORS } from './names';
import { sfx } from '../audio/sfx';
import { t, setActiveLang, Lang } from '../i18n';

const SAVE_KEY = 'hextopia-save-v1';
const SETTINGS_KEY = 'hextopia-settings-v1';

let fxId = 1;
let toastId = 1;

export interface Settings {
  volMaster: number;
  volMusic: number;
  volFx: number;
  volVoice: number;
  fastMode: boolean;
  lang: Lang;
}

// localized resource / terrain words for log + toast interpolation
const resName = (r: Resource) => t(`res.${r}`);

interface Store {
  screen: 'title' | 'setup' | 'game';
  game: MatchState | null;
  toasts: Toast[];
  settings: Settings;
  savedAvailable: boolean;
  lastConfig: MatchConfig | null;

  goTitle: () => void;
  goSetup: () => void;
  newGame: (config: MatchConfig) => void;
  continueGame: () => void;
  clearSave: () => void;

  setSetting: (k: keyof Settings, v: number | boolean | string) => void;

  clickVertex: (id: string) => void;
  clickEdge: (id: string) => void;
  clickTile: (id: number) => void;
  setHoverSpot: (id: string | null) => void;

  startPlacement: (kind: BuildKind) => void;
  cancelPlacement: () => void;

  rollDice: () => void;
  finishDice: () => void;

  bankTrade: (give: Resource, get: Resource) => void;
  tradeWithNpc: (npcId: number, give: Resource, giveN: number, want: Resource, wantN: number) => boolean;
  acceptNpcOffer: () => void;
  declineNpcOffer: () => void;

  endTurn: () => void;
  aiTick: () => void;

  dismissToast: (id: number) => void;
  rematch: (sameSeed: boolean) => void;
}

// ---------- helpers (operate on immer drafts) ----------------------------

function emptyStats(): PlayerStats {
  return {
    produced: 0,
    producedBy: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 },
    tradesBank: 0, tradesNpc: 0,
    roadsBuilt: 0, settlementsBuilt: 0, citiesBuilt: 0, megasBuilt: 0,
    timesRobbed: 0, robberiesDone: 0, biggestHarvest: 0, tradesRejected: 0,
  };
}

function pushLog(g: MatchState, msg: string) {
  g.log.push(msg);
  if (g.log.length > 80) g.log.splice(0, g.log.length - 80);
}

function say(g: MatchState, pid: number, line: string) {
  const p = g.players[pid];
  p.speech = line;
  p.speechAt = Date.now();
  if (p.isNpc) sfx.npcBlip(pid);
}

function addFx(g: MatchState, kind: 'burst' | 'ring' | 'mega', x: number, z: number, color: string) {
  g.fx.push({ id: fxId++, kind, x, z, color, born: Date.now() });
  if (g.fx.length > 40) g.fx.splice(0, g.fx.length - 40);
}

function focus(g: MatchState, x: number, z: number) {
  g.focus = { x, z, at: Date.now() };
}

function addToastTo(list: Toast[], text: string, kind: Toast['kind'], sub?: string, ttl = 3200) {
  list.push({ id: toastId++, text, sub, kind, born: Date.now(), ttl });
  if (list.length > 5) list.splice(0, list.length - 5);
}

function recomputeVpAll(g: MatchState) {
  for (const p of g.players) p.vp = computeVp(g, p.id);
}

function updateLongestRoad(g: MatchState, toasts: Toast[]) {
  const lengths = g.players.map((p) => longestRoadLength(g, p.id));
  const holder = g.longestRoad;
  if (holder) {
    const hLen = lengths[holder.owner];
    const maxLen = Math.max(...lengths);
    if (hLen >= LONGEST_ROAD_MIN && hLen >= maxLen) {
      g.longestRoad = { owner: holder.owner, length: hLen };
      return;
    }
  }
  let best = -1;
  let bestLen = LONGEST_ROAD_MIN - 1;
  lengths.forEach((len, pid) => {
    if (len > bestLen) { bestLen = len; best = pid; }
  });
  const newHolder = best >= 0 ? { owner: best, length: bestLen } : null;
  if (newHolder?.owner !== holder?.owner) {
    g.longestRoad = newHolder;
    if (newHolder) {
      const name = g.players[newHolder.owner].name;
      pushLog(g, t('g.longestRoad', { name }));
      addToastTo(toasts, t('g.roadDominance'), 'combo', t('g.roadDominanceSub', { name }));
    }
  } else if (newHolder) {
    g.longestRoad = newHolder;
  }
}

function checkWinner(g: MatchState, toasts: Toast[]) {
  if (g.winner !== null) return;
  for (const p of g.players) {
    if (p.vp >= g.config.targetVp) {
      g.winner = p.id;
      g.phase = 'gameover';
      g.placement = null;
      g.npcOffer = null;
      pushLog(g, t('g.wins', { name: p.name, vp: p.vp }));
      for (const q of g.players) {
        if (q.id !== p.id && q.isNpc) say(g, q.id, q.personality === 'gambler' ? t('g.loseGambler') : t('g.loseOther'));
      }
      sfx.fanfare();
      return;
    }
  }
  // match point pressure
  const threat = g.players.find((p) => p.vp === g.config.targetVp - 1);
  if (threat && !g.matchPointAnnounced) {
    g.matchPointAnnounced = true;
    addToastTo(toasts, t('g.matchPoint'), 'warn', t('g.matchPointSub', { name: threat.name }), 4200);
    sfx.matchPoint();
    for (const q of g.players) {
      if (q.isNpc && q.id !== threat.id) say(g, q.id, npcLine(new RNG(Math.random() * 1e9), 'threatened'));
    }
  }
}

function grantResource(g: MatchState, pid: number, res: Resource, n: number) {
  const p = g.players[pid];
  p.resources[res] += n;
  p.stats.produced += n;
  p.stats.producedBy[res] += n;
}

function applyBuild(g: MatchState, toasts: Toast[], pid: number, kind: BuildKind, spot: string, free = false) {
  const p = g.players[pid];
  if (!free) payCost(p, kind);
  const rng = new RNG(g.config.seed + spot + kind);

  if (kind === 'road') {
    g.roads[spot] = { edge: spot, owner: pid };
    p.stats.roadsBuilt++;
    const e = g.board.edges[spot];
    addFx(g, 'burst', e.x, e.z, p.color);
    if (p.isNpc) focus(g, e.x, e.z);
    sfx.place();
    pushLog(g, t('g.buildRoad', { emoji: p.emoji, name: p.name }));
    if (p.isNpc && Math.random() < 0.3) say(g, pid, npcLine(rng, 'buildRoad'));
  } else if (kind === 'settlement') {
    const name = settlementName(rng);
    g.buildings[spot] = { vertex: spot, owner: pid, kind: 'settlement', name };
    p.stats.settlementsBuilt++;
    const v = g.board.vertices[spot];
    addFx(g, 'burst', v.x, v.z, p.color);
    focus(g, v.x, v.z);
    sfx.buildBig();
    pushLog(g, t('g.foundSettlementVp', { emoji: p.emoji, name: p.name, place: name }));
    if (p.isNpc && Math.random() < 0.5) say(g, pid, npcLine(rng, 'buildSettlement'));
  } else if (kind === 'city') {
    const b = g.buildings[spot];
    b.kind = 'city';
    p.stats.citiesBuilt++;
    const v = g.board.vertices[spot];
    addFx(g, 'ring', v.x, v.z, p.color);
    focus(g, v.x, v.z);
    sfx.buildBig();
    pushLog(g, t('g.upgradeCity', { emoji: p.emoji, name: p.name, place: b.name }));
    addToastTo(toasts, t('g.urbanization'), 'info', t('g.urbanizationSub', { place: b.name }));
    if (p.isNpc) say(g, pid, npcLine(rng, 'buildCity'));
  } else if (kind === 'megacity') {
    const b = g.buildings[spot];
    b.kind = 'megacity';
    p.stats.megasBuilt++;
    p.civTitle = civTitle(rng);
    const v = g.board.vertices[spot];
    addFx(g, 'mega', v.x, v.z, p.color);
    focus(g, v.x, v.z);
    sfx.mega();
    pushLog(g, t('g.raiseMega', { emoji: p.emoji, name: p.name, place: b.name, civ: p.civTitle }));
    addToastTo(toasts, t('g.megaRises'), 'combo', t('g.megaRisesSub', { place: b.name }), 5000);
    if (p.isNpc) say(g, pid, npcLine(rng, 'buildMega'));
    g.spectacle = Math.min(10, g.spectacle + 5);
  }

  updateLongestRoad(g, toasts);
  recomputeVpAll(g);
  checkWinner(g, toasts);
}

function stealRandom(g: MatchState, thiefId: number, victimId: number, toasts: Toast[]) {
  const victim = g.players[victimId];
  const pool: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < victim.resources[r]; i++) pool.push(r);
  if (pool.length === 0) return;
  const res = pool[Math.floor(Math.random() * pool.length)];
  victim.resources[res] -= 1;
  g.players[thiefId].resources[res] += 1;
  victim.stats.timesRobbed++;
  g.players[thiefId].stats.robberiesDone++;
  pushLog(g, t('g.steal', { thief: g.players[thiefId].name, victim: victim.name }));
  if (victim.isNpc) say(g, victimId, npcLine(new RNG(Math.random() * 1e9), 'robbed'));
  if (g.config.chaos.friendlyRobber) {
    const consolation = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
    victim.resources[consolation] += 1;
    pushLog(g, t('g.friendlyRobber', { victim: victim.name, res: resName(consolation) }));
  }
}

function applyProduction(g: MatchState, toasts: Toast[], total: number) {
  const gains = computeProduction(g, total);
  const pids = Object.keys(gains).map(Number);
  if (pids.length === 0) {
    pushLog(g, t('g.rolledNothing', { total }));
    return;
  }
  for (const pid of pids) {
    const p = g.players[pid];
    let totalN = 0;
    let soleRes: Resource | null = null;
    let mixed = false;
    let i = 0;
    for (const r of RESOURCES) {
      const n = gains[pid][r] ?? 0;
      if (n > 0) {
        grantResource(g, pid, r, n);
        totalN += n;
        if (soleRes === null) soleRes = r;
        else if (soleRes !== r) mixed = true;
        if (!p.isNpc) for (let k = 0; k < Math.min(n, 6); k++) sfx.pickup(r, i++);
      }
    }
    p.stats.biggestHarvest = Math.max(p.stats.biggestHarvest, totalN);
    pushLog(g, t('g.gains', { emoji: p.emoji, name: p.name, n: totalN }));

    // combo feedback (presentation only; the actual gain is already logged)
    if (totalN >= 4 && !mixed && soleRes) {
      const comboKeys: Record<Resource, string> = {
        wheat: 'g.comboWheat', sheep: 'g.comboSheep', wood: 'g.comboWood',
        brick: 'g.comboBrick', ore: 'g.comboOre',
      };
      addToastTo(toasts, t(comboKeys[soleRes]), 'combo', t('g.comboSub', { name: p.name, n: totalN, res: resName(soleRes) }));
      sfx.combo();
      g.spectacle = Math.min(10, g.spectacle + 2);
    } else if (totalN >= 7) {
      addToastTo(toasts, t('g.economyAscends'), 'combo', t('g.economyAscendsSub', { name: p.name, n: totalN }));
      sfx.combo();
      g.spectacle = Math.min(10, g.spectacle + 3);
    } else if (totalN >= 5) {
      addToastTo(toasts, t('g.supplyChain'), 'combo', t('g.comboGenericSub', { name: p.name, n: totalN }));
      sfx.combo();
    } else if (totalN >= 3) {
      addToastTo(toasts, t('g.doubleHarvest'), 'combo', t('g.comboGenericSub', { name: p.name, n: totalN }));
    }
    if (p.isNpc && totalN >= 3) say(g, pid, npcLine(new RNG(Math.random() * 1e9), 'goodRoll'));
  }
  // fx on producing tiles
  for (const tile of g.board.tiles) {
    if (tile.token === total && tile.id !== g.robberTile) addFx(g, 'ring', tile.x, tile.z, '#ffe28a');
  }
}

function maybeWorldEvent(g: MatchState, toasts: Toast[]) {
  if (!g.config.worldEvents) return;
  if (g.worldEvent && g.round > g.worldEvent.untilRound) {
    pushLog(g, t('g.worldEventEnds', { label: g.worldEvent.label }));
    g.worldEvent = null;
  }
  if (g.worldEvent || g.round < 3 || Math.random() > 0.22) return;
  const rng = new RNG(g.config.seed + ':event:' + g.round + ':' + Math.floor(Math.random() * 1e6));
  const kind = rng.pick(['boom', 'storm', 'festival', 'sheepmania'] as const);
  const until = g.round + 2;
  if (kind === 'boom') {
    const res = rng.pick(RESOURCES);
    g.worldEvent = { kind, resource: res, untilRound: until, label: t('g.eventBoomLabel', { res: resName(res) }), desc: t('g.eventBoomDesc', { res: resName(res) }) };
  } else if (kind === 'storm') {
    const candidates = g.board.tiles.filter((t) => t.token !== null);
    const tile = rng.pick(candidates);
    g.worldEvent = { kind, tileId: tile.id, untilRound: until, label: t('g.eventStormLabel'), desc: t('g.eventStormDesc', { terrain: t(`terrain.${tile.terrain}`) }) };
    addFx(g, 'ring', tile.x, tile.z, '#7fb8ff');
  } else if (kind === 'festival') {
    g.worldEvent = { kind, untilRound: until, label: t('g.eventFestivalLabel'), desc: t('g.eventFestivalDesc') };
  } else {
    g.worldEvent = { kind, untilRound: until, label: t('g.eventSheepLabel'), desc: t('g.eventSheepDesc') };
  }
  pushLog(g, t('g.worldEvent', { label: g.worldEvent.label, desc: g.worldEvent.desc }));
  addToastTo(toasts, g.worldEvent.label, 'event', g.worldEvent.desc, 4500);
}

function buildMatch(config: MatchConfig): MatchState {
  const board = generateBoard(config.mapSize, config.seed);
  const goldenTile = config.chaos.goldenHex ? pickGoldenTile(board, config.seed) : null;
  const rng = new RNG(config.seed + ':players');
  const npcs = pickNpcs(rng, config.npcCount, config.difficulty);
  const players: PlayerState[] = [];
  players.push({
    id: 0, name: t('player.you'), emoji: '🫅', color: PLAYER_COLORS[0], isNpc: false,
    personality: 'builder',
    resources: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 },
    vp: 0, mood: 'ready', speech: null, speechAt: 0, civTitle: null, stats: emptyStats(),
  });
  npcs.forEach((npc, i) => {
    players.push({
      id: i + 1, name: npc.name, emoji: npc.emoji, color: PLAYER_COLORS[i + 1], isNpc: true,
      personality: npc.personality,
      resources: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 },
      vp: 0, mood: 'scheming', speech: null, speechAt: 0, civTitle: null, stats: emptyStats(),
    });
  });

  const n = players.length;
  const setupQueue = [...Array(n).keys(), ...[...Array(n).keys()].reverse()];

  return {
    config, board, players,
    buildings: {}, roads: {},
    current: setupQueue[0],
    phase: 'setup',
    round: 0, turnCount: 0,
    setupQueue, setupIdx: 0, setupStage: 'settlement', setupLastVertex: null,
    dice: null, diceStartedAt: 0, diceGiant: false,
    robberTile: desertTileId(board),
    goldenTile,
    placement: null, hoverSpot: null, npcOffer: null,
    worldEvent: null, longestRoad: null,
    log: goldenTile !== null ? [t('g.newWorld'), t('g.goldenHex')] : [t('g.newWorld')],
    fx: [], focus: null, spectacle: 0,
    aiActionsThisTurn: 0,
    winner: null,
    rollCounts: new Array(13).fill(0),
    matchPointAnnounced: false,
  };
}

// ---------- persistence ---------------------------------------------------

function defaultLang(): Lang {
  try {
    if (typeof navigator !== 'undefined' && /^ja/i.test(navigator.language || '')) return 'ja';
  } catch { /* ignore */ }
  return 'en';
}

function loadSettings(): Settings {
  const def: Settings = { volMaster: 0.8, volMusic: 0.5, volFx: 0.8, volVoice: 0.7, fastMode: false, lang: defaultLang() };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    const merged = { ...def, ...parsed };
    if (merged.lang !== 'en' && merged.lang !== 'ja') merged.lang = def.lang;
    return merged;
  } catch {
    return def;
  }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function saveMatch(g: MatchState | null) {
  try {
    if (!g || g.winner !== null) { localStorage.removeItem(SAVE_KEY); return; }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, game: g }));
  } catch { /* storage full or unavailable — the game continues without saves */ }
}

function loadMatch(): MatchState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== 1 || !parsed.game?.board?.tiles || parsed.game.winner !== null) return null;
    const g = parsed.game as MatchState;
    // sanity: players + phase must exist
    if (!Array.isArray(g.players) || g.players.length < 2 || !g.phase) return null;
    // never restore mid-animation states
    if (g.phase === 'dice') g.phase = 'roll';
    g.placement = null;
    g.npcOffer = null;
    g.fx = [];
    // fields added after v1 saves
    g.goldenTile ??= null;
    g.config.chaos.goldenHex ??= false;
    return g;
  } catch {
    return null;
  }
}

// ---------- store ----------------------------------------------------------

const initialSettings: Settings = typeof window !== 'undefined'
  ? loadSettings()
  : { volMaster: 0.8, volMusic: 0.5, volFx: 0.8, volVoice: 0.7, fastMode: false, lang: 'en' };

setActiveLang(initialSettings.lang);

export const useGame = create<Store>()(immer((set, get) => {
  // apply persisted volumes to the audio engine
  sfx.volumes = { master: initialSettings.volMaster, music: initialSettings.volMusic, fx: initialSettings.volFx, voice: initialSettings.volVoice };

  return {
    screen: 'title',
    game: null,
    toasts: [],
    settings: initialSettings,
    savedAvailable: typeof window !== 'undefined' && loadMatch() !== null,
    lastConfig: null,

    goTitle: () => set((s) => { s.screen = 'title'; s.savedAvailable = loadMatch() !== null; }),
    goSetup: () => set((s) => { s.screen = 'setup'; }),

    newGame: (config) => set((s) => {
      s.game = buildMatch(config);
      s.lastConfig = config;
      s.screen = 'game';
      s.toasts = [];
      addToastTo(s.toasts, t('g.worldGenerated'), 'info', t('g.worldGeneratedSub', { seed: config.seed }), 4000);
    }),

    continueGame: () => set((s) => {
      const g = loadMatch();
      if (g) {
        s.game = g;
        s.lastConfig = g.config;
        s.screen = 'game';
        addToastTo(s.toasts, t('g.gameRestored'), 'info', t('g.gameRestoredSub', { round: g.round }), 3000);
      } else {
        s.savedAvailable = false;
        addToastTo(s.toasts, t('g.noSave'), 'warn', t('g.noSaveSub'));
        s.screen = 'setup';
      }
    }),

    clearSave: () => set((s) => {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      s.savedAvailable = false;
    }),

    setSetting: (k, v) => set((s) => {
      (s.settings as any)[k] = v;
      saveSettings(s.settings);
      if (k === 'volMaster') sfx.setVolume('master', v as number);
      if (k === 'volMusic') sfx.setVolume('music', v as number);
      if (k === 'volFx') sfx.setVolume('fx', v as number);
      if (k === 'volVoice') sfx.setVolume('voice', v as number);
      if (k === 'lang') setActiveLang(v as Lang);
    }),

    // ---- 3D interaction routing ----

    clickVertex: (id) => set((s) => {
      const g = s.game;
      if (!g || g.winner !== null) return;
      const pid = g.current;
      if (g.players[pid].isNpc) return;

      if (g.phase === 'setup' && g.setupStage === 'settlement') {
        const spots = validSettlementSpots(g, pid, true);
        if (!spots.includes(id)) { sfx.invalid(); return; }
        placeSetupSettlement(g, s.toasts, pid, id);
        return;
      }
      if (g.phase === 'main' && g.placement && g.placement.kind !== 'road') {
        if (!g.placement.spots.includes(id)) { sfx.invalid(); return; }
        const kind = g.placement.kind;
        g.placement = null;
        g.hoverSpot = null;
        applyBuild(g, s.toasts, pid, kind, id);
        saveMatch(g);
      }
    }),

    clickEdge: (id) => set((s) => {
      const g = s.game;
      if (!g || g.winner !== null) return;
      const pid = g.current;
      if (g.players[pid].isNpc) return;

      if (g.phase === 'setup' && g.setupStage === 'road') {
        const spots = validRoadSpots(g, pid, g.setupLastVertex);
        if (!spots.includes(id)) { sfx.invalid(); return; }
        placeSetupRoad(g, s.toasts, pid, id);
        return;
      }
      if (g.phase === 'main' && g.placement?.kind === 'road') {
        if (!g.placement.spots.includes(id)) { sfx.invalid(); return; }
        g.placement = null;
        g.hoverSpot = null;
        applyBuild(g, s.toasts, pid, 'road', id);
        saveMatch(g);
      }
    }),

    clickTile: (id) => set((s) => {
      const g = s.game;
      if (!g || g.winner !== null) return;
      if (g.phase !== 'robber') return;
      if (g.players[g.current].isNpc) return;
      if (id === g.robberTile) { sfx.invalid(); return; }
      moveRobberTo(g, s.toasts, g.current, id, null);
    }),

    setHoverSpot: (id) => set((s) => {
      if (s.game) s.game.hoverSpot = id;
    }),

    // ---- placement mode ----

    startPlacement: (kind) => set((s) => {
      const g = s.game;
      if (!g || g.phase !== 'main' || g.players[g.current].isNpc) return;
      const p = g.players[g.current];
      if (g.placement?.kind === kind) { g.placement = null; return; } // toggle off
      if (!canAfford(p, kind)) {
        sfx.invalid();
        addToastTo(s.toasts, t('g.cannotAfford'), 'warn', costText(kind), 2500);
        return;
      }
      const spots = validSpots(g, p.id, kind);
      if (spots.length === 0) {
        sfx.invalid();
        const reason =
          kind === 'road' ? t('g.reasonRoad') :
          kind === 'settlement' ? t('g.reasonSettlement') :
          kind === 'city' ? t('g.reasonCity') :
          t('g.reasonMega', { roads: MEGA_ROAD_REQ });
        addToastTo(s.toasts, t('g.nowhereToBuild'), 'warn', reason, 3200);
        return;
      }
      sfx.click();
      g.placement = { kind, spots };
      g.hoverSpot = null;
    }),

    cancelPlacement: () => set((s) => {
      if (s.game) { s.game.placement = null; s.game.hoverSpot = null; }
    }),

    // ---- dice ----

    rollDice: () => set((s) => {
      const g = s.game;
      if (!g || g.phase !== 'roll') return;
      const a = 1 + Math.floor(Math.random() * 6);
      const b = 1 + Math.floor(Math.random() * 6);
      g.dice = [a, b];
      g.diceStartedAt = Date.now();
      g.diceGiant = Math.random() < 0.07;
      g.phase = 'dice';
      g.rollCounts[a + b]++;
      focus(g, 0, 0);
      sfx.diceThrow();
      const p = g.players[g.current];
      pushLog(g, t('g.rolls', { emoji: p.emoji, name: p.name }));
    }),

    finishDice: () => set((s) => {
      const g = s.game;
      if (!g || g.phase !== 'dice' || !g.dice) return;
      const total = g.dice[0] + g.dice[1];
      sfx.diceLand(total);
      pushLog(g, t('g.diceResult', { a: g.dice[0], b: g.dice[1], total, giant: g.diceGiant ? t('g.giantSuffix') : '' }));
      if (total === 7) {
        g.phase = 'robber';
        sfx.robber();
        const p = g.players[g.current];
        if (!p.isNpc) {
          addToastTo(s.toasts, t('g.robberAwakens'), 'warn', t('g.robberAwakensSub'), 4000);
        } else {
          pushLog(g, t('g.commandsRobber', { name: p.name }));
        }
      } else {
        applyProduction(g, s.toasts, total);
        g.phase = 'main';
      }
      saveMatch(g);
    }),

    // ---- trading ----

    bankTrade: (give, want) => set((s) => {
      const g = s.game;
      if (!g || g.phase !== 'main') return;
      const p = g.players[g.current];
      const rate = bankRate(g, give);
      if (give === want || p.resources[give] < rate) { sfx.invalid(); return; }
      p.resources[give] -= rate;
      p.resources[want] += 1;
      p.stats.tradesBank++;
      sfx.tradeDone();
      pushLog(g, t('g.bankTrade', { emoji: p.emoji, name: p.name, rate, give: resName(give), want: resName(want) }));
      saveMatch(g);
    }),

    tradeWithNpc: (npcId, give, giveN, want, wantN) => {
      let accepted = false;
      set((s) => {
        const g = s.game;
        if (!g || g.phase !== 'main') return;
        const p = g.players[g.current];
        const npc = g.players[npcId];
        if (!npc || !npc.isNpc) return;
        if (p.resources[give] < giveN || npc.resources[want] < wantN) { sfx.invalid(); return; }
        const rng = new RNG(Math.random() * 1e9);
        if (aiEvaluateTrade(g, npcId, give, giveN, want, wantN)) {
          p.resources[give] -= giveN;
          npc.resources[give] += giveN;
          npc.resources[want] -= wantN;
          p.resources[want] += wantN;
          p.stats.tradesNpc++;
          npc.stats.tradesNpc++;
          accepted = true;
          say(g, npcId, npcLine(rng, 'tradeAccept'));
          sfx.tradeDone();
          pushLog(g, t('g.npcTrade', { name: p.name, giveN, give: resName(give), wantN, want: resName(want), other: npc.name }));
        } else {
          say(g, npcId, npcLine(rng, 'tradeReject'));
          npc.stats.tradesRejected++;
          p.stats.tradesRejected++;
          sfx.invalid();
          pushLog(g, t('g.npcRejects', { name: npc.name }));
        }
        saveMatch(g);
      });
      return accepted;
    },

    acceptNpcOffer: () => set((s) => {
      const g = s.game;
      if (!g || !g.npcOffer) return;
      const o = g.npcOffer;
      const npc = g.players[o.from];
      const human = g.players[0];
      g.npcOffer = null;
      // both sides must still have the goods
      if (npc.resources[o.give] < o.giveN || human.resources[o.get] < o.getN) {
        addToastTo(s.toasts, t('g.dealFell'), 'warn', t('g.dealFellSub'));
        return;
      }
      npc.resources[o.give] -= o.giveN;
      human.resources[o.give] += o.giveN;
      human.resources[o.get] -= o.getN;
      npc.resources[o.get] += o.getN;
      human.stats.tradesNpc++;
      npc.stats.tradesNpc++;
      say(g, o.from, npcLine(new RNG(Math.random() * 1e9), 'tradeAccept'));
      sfx.tradeDone();
      pushLog(g, t('g.acceptOffer', { name: npc.name, giveN: o.giveN, give: resName(o.give), getN: o.getN, get: resName(o.get) }));
      saveMatch(g);
    }),

    declineNpcOffer: () => set((s) => {
      const g = s.game;
      if (!g || !g.npcOffer) return;
      const npc = g.players[g.npcOffer.from];
      say(g, npc.id, t('g.declineOfferSpeech'));
      npc.stats.tradesRejected++;
      pushLog(g, t('g.declineOffer', { name: npc.name }));
      g.npcOffer = null;
    }),

    // ---- turn flow ----

    endTurn: () => set((s) => {
      const g = s.game;
      if (!g || g.winner !== null) return;
      if (g.phase !== 'main') return;
      advanceTurn(g, s.toasts);
      saveMatch(g);
    }),

    // ---- the driver: NPC turns, watchdogs, cleanups ----

    aiTick: () => {
      const s = get();
      const g = s.game;
      if (!g) return;
      const now = Date.now();

      // decide whether anything needs doing (avoid useless re-renders)
      const speechToClear = g.players.some((p) => p.speech && now - p.speechAt > 4200);
      const fxToClear = g.fx.some((f) => now - f.born > 2600);
      const toastToClear = s.toasts.some((t) => now - t.born > t.ttl);
      const diceStuck = g.phase === 'dice' && now - g.diceStartedAt > 4000;
      const offerExpired = g.npcOffer !== null && now > g.npcOffer.expiresAt;
      const npcTurn = g.winner === null && g.players[g.current]?.isNpc && (g.phase === 'setup' || g.phase === 'roll' || g.phase === 'robber' || g.phase === 'main');

      if (!speechToClear && !fxToClear && !toastToClear && !diceStuck && !offerExpired && !npcTurn) return;

      if (diceStuck) { s.finishDice(); return; }

      set((st) => {
        const g2 = st.game;
        if (!g2) return;
        const now2 = Date.now();
        for (const p of g2.players) {
          if (p.speech && now2 - p.speechAt > 4200) p.speech = null;
        }
        g2.fx = g2.fx.filter((f) => now2 - f.born <= 2600);
        st.toasts = st.toasts.filter((t) => now2 - t.born <= t.ttl);
        if (g2.npcOffer && now2 > g2.npcOffer.expiresAt) {
          pushLog(g2, t('g.offerExpires', { name: g2.players[g2.npcOffer.from].name }));
          g2.npcOffer = null;
        }

        if (g2.winner !== null) return;
        const p = g2.players[g2.current];
        if (!p?.isNpc) return;

        if (g2.phase === 'setup') {
          npcSetupStep(g2, st.toasts);
          return;
        }
        if (g2.phase === 'roll') {
          // roll inline (mirror of rollDice, which requires human turn context)
          const a = 1 + Math.floor(Math.random() * 6);
          const b = 1 + Math.floor(Math.random() * 6);
          g2.dice = [a, b];
          g2.diceStartedAt = Date.now();
          g2.diceGiant = Math.random() < 0.07;
          g2.phase = 'dice';
          g2.rollCounts[a + b]++;
          sfx.diceThrow();
          pushLog(g2, t('g.rolls', { emoji: p.emoji, name: p.name }));
          return;
        }
        if (g2.phase === 'robber') {
          const choice = aiRobberChoice(g2, p.id);
          moveRobberTo(g2, st.toasts, p.id, choice.tile, choice.victim);
          return;
        }
        if (g2.phase === 'main') {
          g2.aiActionsThisTurn++;
          if (g2.aiActionsThisTurn > 14) { advanceTurn(g2, st.toasts); saveMatch(g2); return; }
          const action = aiMainAction(g2, p.id);
          if (action.type === 'build') {
            applyBuild(g2, st.toasts, p.id, action.kind, action.spot);
          } else if (action.type === 'bank') {
            const rate = bankRate(g2, action.give);
            if (p.resources[action.give] >= rate) {
              p.resources[action.give] -= rate;
              p.resources[action.get] += 1;
              p.stats.tradesBank++;
              pushLog(g2, t('g.bankTrade', { emoji: p.emoji, name: p.name, rate, give: resName(action.give), want: resName(action.get) }));
            }
          } else if (action.type === 'offerHuman') {
            const rng = new RNG(Math.random() * 1e9);
            g2.npcOffer = {
              from: p.id, give: action.give, giveN: 1, get: action.get, getN: 1,
              line: npcLine(rng, 'offer'),
              expiresAt: Date.now() + 9000,
            };
            say(g2, p.id, t('g.proposalSpeech'));
            pushLog(g2, t('g.npcOffers', { name: p.name, give: resName(action.give), get: resName(action.get) }));
          } else {
            advanceTurn(g2, st.toasts);
            saveMatch(g2);
          }
        }
      });
    },

    dismissToast: (id) => set((s) => {
      s.toasts = s.toasts.filter((t) => t.id !== id);
    }),

    rematch: (sameSeed) => set((s) => {
      const cfg = s.lastConfig ?? s.game?.config;
      if (!cfg) { s.screen = 'setup'; return; }
      const config: MatchConfig = { ...cfg, seed: sameSeed ? cfg.seed : randomSeedString() };
      s.game = buildMatch(config);
      s.lastConfig = config;
      s.screen = 'game';
      s.toasts = [];
      addToastTo(s.toasts, sameSeed ? t('g.rematchSame') : t('g.newWorldToast'), 'info', t('g.seedSub', { seed: config.seed }), 3500);
    }),
  };
}));

// expose for headless/browser testing (harmless in production)
if (typeof window !== 'undefined') (window as any).__game = useGame;

// ---------- flow helpers used by both human clicks and the AI driver ------

function costText(kind: BuildKind): string {
  const c = COSTS[kind];
  return Object.entries(c).map(([r, n]) => `${n} ${resName(r as Resource)}`).join(' + ');
}

function placeSetupSettlement(g: MatchState, toasts: Toast[], pid: number, vertexId: string) {
  const rng = new RNG(g.config.seed + vertexId);
  const name = settlementName(rng);
  g.buildings[vertexId] = { vertex: vertexId, owner: pid, kind: 'settlement', name };
  g.players[pid].stats.settlementsBuilt++;
  g.setupStage = 'road';
  g.setupLastVertex = vertexId;
  const v = g.board.vertices[vertexId];
  addFx(g, 'burst', v.x, v.z, g.players[pid].color);
  focus(g, v.x, v.z);
  sfx.buildBig();
  pushLog(g, t('g.foundSettlement', { emoji: g.players[pid].emoji, name: g.players[pid].name, place: name }));

  // second-pass settlement grants starting resources from adjacent tiles
  const n = g.players.length;
  if (g.setupIdx >= n) {
    for (const tid of v.tiles) {
      const t = g.board.tiles[tid];
      const res = TERRAIN_RESOURCE[t.terrain];
      if (res) grantResource(g, pid, res, 1);
    }
  }
  recomputeVpAll(g);
}

function placeSetupRoad(g: MatchState, toasts: Toast[], pid: number, edgeId: string) {
  g.roads[edgeId] = { edge: edgeId, owner: pid };
  g.players[pid].stats.roadsBuilt++;
  const e = g.board.edges[edgeId];
  addFx(g, 'burst', e.x, e.z, g.players[pid].color);
  sfx.place();

  g.setupIdx++;
  g.setupStage = 'settlement';
  g.setupLastVertex = null;

  if (g.setupIdx >= g.setupQueue.length) {
    g.phase = 'roll';
    g.current = 0;
    g.round = 1;
    pushLog(g, t('g.ageBegins'));
    addToastTo(toasts, t('g.ageOfExpansion'), 'event', t('g.ageOfExpansionSub'), 3800);
  } else {
    g.current = g.setupQueue[g.setupIdx];
  }
  saveMatch(g);
}

function npcSetupStep(g: MatchState, toasts: Toast[]) {
  const pid = g.current;
  if (g.setupStage === 'settlement') {
    const spot = aiSetupVertex(g, pid);
    if (spot) placeSetupSettlement(g, toasts, pid, spot);
    else { // pathological board: skip to keep the game alive
      g.setupStage = 'road';
      g.setupLastVertex = null;
    }
  } else {
    const anchor = g.setupLastVertex;
    const spots = anchor ? validRoadSpots(g, pid, anchor) : validRoadSpots(g, pid);
    if (spots.length > 0) {
      const edge = anchor ? aiSetupRoad(g, pid, anchor) : spots[0];
      placeSetupRoad(g, toasts, pid, edge);
    } else {
      // no legal road (shouldn't happen): advance anyway
      g.setupIdx++;
      g.setupStage = 'settlement';
      if (g.setupIdx >= g.setupQueue.length) {
        g.phase = 'roll';
        g.current = 0;
        g.round = 1;
      } else {
        g.current = g.setupQueue[g.setupIdx];
      }
    }
  }
}

function moveRobberTo(g: MatchState, toasts: Toast[], pid: number, tileId: number, chosenVictim: number | null) {
  g.robberTile = tileId;
  const tile = g.board.tiles[tileId];
  addFx(g, 'ring', tile.x, tile.z, '#222222');
  focus(g, tile.x, tile.z);
  pushLog(g, t('g.movesRobber', { name: g.players[pid].name }));

  // find victims adjacent to the tile
  const victims = new Set<number>();
  for (const v of Object.values(g.board.vertices)) {
    if (!v.tiles.includes(tileId)) continue;
    const b = g.buildings[v.id];
    if (b && b.owner !== pid && handSize(g.players[b.owner]) > 0) victims.add(b.owner);
  }
  let victim: number | null = chosenVictim;
  if (victim === null || !victims.has(victim)) {
    const arr = [...victims];
    victim = arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
  }
  if (victim !== null) {
    stealRandom(g, pid, victim, toasts);
    if (g.players[pid].isNpc) say(g, pid, npcLine(new RNG(Math.random() * 1e9), 'robbing'));
  }
  g.phase = 'main';
  saveMatch(g);
}

function advanceTurn(g: MatchState, toasts: Toast[]) {
  g.placement = null;
  g.hoverSpot = null;
  g.aiActionsThisTurn = 0;
  g.turnCount++;
  g.current = (g.current + 1) % g.players.length;
  g.dice = null;
  g.phase = 'roll';
  if (g.current === 0) {
    g.round++;
    maybeWorldEvent(g, toasts);
  }
  g.spectacle = Math.max(0, g.spectacle - 1);
  const p = g.players[g.current];
  pushLog(g, t('g.turnHeader', { n: g.turnCount + 1, emoji: p.emoji, name: p.name }));
  if (p.isNpc && p.vp >= g.config.targetVp - 2 && Math.random() < 0.4) {
    say(g, p.id, npcLine(new RNG(Math.random() * 1e9), 'nearWin'));
  }
}
