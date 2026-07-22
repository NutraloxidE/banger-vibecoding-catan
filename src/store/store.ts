import { create } from "zustand";
import {
  aiBuildPhase,
  aiMoveRobber,
  aiSetupPlace,
  humanNpcTrade,
} from "../game/ai";
import {
  bankTrade,
  buildCity,
  buildMegacity,
  buildRoad,
  buildSettlement,
  createGame,
  endTurn as endTurnReducer,
  moveRobber,
  rollDice,
  setupPlaceRoad,
  setupPlaceSettlement,
  stealFrom,
  type RollOutcome,
} from "../game/gameReducer";
import { MAP_RADII } from "../game/constants";
import { randomSeedString } from "../game/rng";
import type {
  BuildMode,
  GameSettings,
  GameState,
  ResourceType,
} from "../game/types";

const SAVE_KEY = "hexfall-save-v1";
const SETTINGS_KEY = "hexfall-settings-v1";

export type Screen = "title" | "setup" | "game";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "good" | "bad" | "epic";
  big?: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

interface FxState {
  roll: RollOutcome | null;
  rollNonce: number;
  combos: string[];
  activatedTiles: string[];
  cameraFocus: { x: number; z: number } | null;
  robberVictims: number[];
}

interface StoreState {
  screen: Screen;
  game: GameState | null;
  tick: number;
  draft: GameSettings;
  buildMode: BuildMode;
  hoverTarget: number | string | null;
  toasts: Toast[];
  audio: AudioSettings;
  speed: number; // NPC animation speed multiplier
  fx: FxState;
  aiRunning: boolean;

  // navigation
  goTitle: () => void;
  goSetup: () => void;
  setDraft: (patch: Partial<GameSettings>) => void;
  toggleChaos: (key: keyof GameSettings["chaos"]) => void;
  randomizeSeed: () => void;
  startGame: () => void;
  continueGame: () => boolean;
  hasSave: () => boolean;

  // interaction
  setBuildMode: (m: BuildMode) => void;
  setHover: (t: number | string | null) => void;
  clickVertex: (vertexId: number) => void;
  clickEdge: (edgeId: string) => void;
  clickTile: (tileId: string) => void;

  // actions
  roll: () => void;
  endTurn: () => void;
  bankTradeAction: (give: ResourceType, want: ResourceType) => void;
  proposeTrade: (
    npc: number,
    give: Record<ResourceType, number>,
    want: Record<ResourceType, number>,
  ) => boolean;

  // fx / ui
  pushToast: (text: string, tone?: Toast["tone"], big?: boolean) => void;
  removeToast: (id: number) => void;
  setAudio: (patch: Partial<AudioSettings>) => void;
  setSpeed: (s: number) => void;

  // internal
  commit: (fn: (g: GameState) => void) => void;
  driveAI: () => void;
}

const defaultChaos = () => ({
  turbo: false,
  friendlyRobber: false,
  npcDrama: true,
  maxSheep: false,
  goldenHex: false,
  worldEvents: true,
});

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultSettings();
}

function defaultSettings(): GameSettings {
  return {
    mapSize: "small",
    npcCount: 3,
    victoryTarget: 10,
    seed: randomSeedString(),
    chaos: defaultChaos(),
  };
}

let toastId = 1;

export const useStore = create<StoreState>((set, get) => ({
  screen: "title",
  game: null,
  tick: 0,
  draft: loadSettings(),
  buildMode: null,
  hoverTarget: null,
  toasts: [],
  audio: { master: 0.8, music: 0.5, sfx: 0.9, muted: false },
  speed: 1,
  fx: {
    roll: null,
    rollNonce: 0,
    combos: [],
    activatedTiles: [],
    cameraFocus: null,
    robberVictims: [],
  },
  aiRunning: false,

  goTitle: () => set({ screen: "title" }),
  goSetup: () => set({ screen: "setup" }),

  setDraft: (patch) => {
    const draft = { ...get().draft, ...patch };
    set({ draft });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  },

  toggleChaos: (key) => {
    const draft = get().draft;
    get().setDraft({ chaos: { ...draft.chaos, [key]: !draft.chaos[key] } });
  },

  randomizeSeed: () => get().setDraft({ seed: randomSeedString() }),

  startGame: () => {
    const draft = get().draft;
    // apply turbo to victory target for shorter games
    const settings: GameSettings = {
      ...draft,
      victoryTarget: draft.chaos.turbo ? Math.max(6, draft.victoryTarget - 2) : draft.victoryTarget,
    };
    if (!MAP_RADII[settings.mapSize]) settings.mapSize = "small";
    const game = createGame(settings);
    set({
      game,
      screen: "game",
      tick: get().tick + 1,
      buildMode: null,
      fx: { ...get().fx, roll: null, combos: [], activatedTiles: [], cameraFocus: null },
    });
    persist(game);
    setTimeout(() => get().driveAI(), 400);
  },

  hasSave: () => {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  },

  continueGame: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const game = JSON.parse(raw) as GameState;
      if (!game || !game.board || !game.players) return false;
      set({ game, screen: "game", tick: get().tick + 1, buildMode: null });
      setTimeout(() => get().driveAI(), 400);
      return true;
    } catch {
      return false;
    }
  },

  setBuildMode: (m) => set({ buildMode: m }),
  setHover: (t) => set({ hoverTarget: t }),

  clickVertex: (vertexId) => {
    const g = get().game;
    if (!g) return;
    const human = g.current === 0 && g.players[0].isHuman;
    if (g.phase === "setup-place" && g.setupStage === "settlement" && human) {
      get().commit((s) => setupPlaceSettlement(s, vertexId));
      get().pushToast("Settlement founded", "good");
      focusVertex(get(), vertexId);
      get().driveAI();
      return;
    }
    if (!human || g.phase !== "build") return;
    const bm = get().buildMode;
    if (bm?.kind === "settlement") {
      get().commit((s) => {
        if (buildSettlement(s, vertexId)) {
          get().pushToast("New settlement!", "good");
        }
      });
      get().setBuildMode(null);
      focusVertex(get(), vertexId);
    } else if (bm?.kind === "city") {
      get().commit((s) => {
        if (buildCity(s, vertexId)) get().pushToast("CITY RISES", "epic", true);
      });
      get().setBuildMode(null);
      focusVertex(get(), vertexId);
    } else if (bm?.kind === "megacity") {
      get().commit((s) => {
        if (buildMegacity(s, vertexId)) get().pushToast("MEGA CITY ASCENDS", "epic", true);
      });
      get().setBuildMode(null);
      focusVertex(get(), vertexId);
    }
  },

  clickEdge: (edgeId) => {
    const g = get().game;
    if (!g) return;
    const human = g.current === 0 && g.players[0].isHuman;
    if (g.phase === "setup-place" && g.setupStage === "road" && human) {
      get().commit((s) => setupPlaceRoad(s, edgeId));
      get().driveAI();
      return;
    }
    if (!human || g.phase !== "build") return;
    if (get().buildMode?.kind === "road") {
      get().commit((s) => {
        if (buildRoad(s, edgeId)) get().pushToast("Road built", "good");
      });
      get().setBuildMode(null);
    }
  },

  clickTile: (tileId) => {
    const g = get().game;
    if (!g) return;
    const human = g.current === 0 && g.players[0].isHuman;
    if (human && g.phase === "robber-move") {
      get().commit((s) => {
        const victims = moveRobber(s, tileId);
        set({ fx: { ...get().fx, robberVictims: victims } });
        if (victims.length === 0) get().pushToast("Robber moved", "bad");
      });
    }
  },

  roll: () => {
    const g = get().game;
    if (!g || g.phase !== "roll") return;
    let outcome: RollOutcome | null = null;
    get().commit((s) => {
      outcome = rollDice(s);
    });
    if (outcome) applyRollFx(get(), outcome);
  },

  endTurn: () => {
    const g = get().game;
    if (!g) return;
    get().setBuildMode(null);
    get().commit((s) => endTurnReducer(s));
    get().driveAI();
  },

  bankTradeAction: (give, want) => {
    get().commit((s) => {
      if (bankTrade(s, give, want)) get().pushToast(`Traded for ${want}`, "info");
    });
  },

  proposeTrade: (npc, give, want) => {
    let ok = false;
    get().commit((s) => {
      ok = humanNpcTrade(s, npc, give, want);
    });
    get().pushToast(ok ? "Trade accepted!" : "Trade rejected", ok ? "good" : "bad");
    return ok;
  },

  pushToast: (text, tone = "info", big = false) => {
    const id = toastId++;
    set({ toasts: [...get().toasts, { id, text, tone, big }] });
    const life = big ? 2600 : 1900;
    setTimeout(() => get().removeToast(id), life);
  },

  removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  setAudio: (patch) => set({ audio: { ...get().audio, ...patch } }),
  setSpeed: (s) => set({ speed: s }),

  commit: (fn) => {
    const g = get().game;
    if (!g) return;
    fn(g);
    const next = { ...g };
    set({ game: next, tick: get().tick + 1 });
    persist(next);
  },

  // Drives NPC (and NPC setup) turns with visible pacing. Bounded & re-entrant safe.
  driveAI: () => {
    if (get().aiRunning) return;
    const step = () => {
      const g = get().game;
      if (!g || g.winner !== null) {
        set({ aiRunning: false });
        return;
      }
      const p = g.players[g.current];
      const delay = 620 / get().speed;

      // Human turn: hand control back to UI.
      if (p.isHuman) {
        set({ aiRunning: false });
        return;
      }

      set({ aiRunning: true });

      if (g.phase === "setup-place") {
        get().commit((s) => aiSetupPlace(s));
        const after = get().game!;
        if (after.setupLastVertex !== null) focusVertex(get(), after.setupLastVertex);
        setTimeout(step, delay);
        return;
      }

      if (g.phase === "roll") {
        let outcome: RollOutcome | null = null;
        get().commit((s) => {
          outcome = rollDice(s);
        });
        if (outcome) applyRollFx(get(), outcome);
        setTimeout(step, delay + 500 / get().speed);
        return;
      }

      if (g.phase === "robber-move" || g.phase === "robber-steal") {
        get().commit((s) => {
          if (s.phase === "robber-move") aiMoveRobber(s);
          else if (s.phase === "robber-steal") {
            // safety: pick first victim
            stealFrom(s, s.players.findIndex((pl) => pl.index !== s.current));
          }
        });
        setTimeout(step, delay);
        return;
      }

      if (g.phase === "build") {
        get().commit((s) => {
          aiBuildPhase(s);
        });
        // brief pause so builds are visible, then end turn
        setTimeout(() => {
          get().commit((s) => endTurnReducer(s));
          setTimeout(step, delay);
        }, delay);
        return;
      }

      // unknown / over
      set({ aiRunning: false });
    };
    step();
  },
}));

// ---- helpers ------------------------------------------------------------

function persist(game: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch {
    /* storage may be full or unavailable; game still works in-memory */
  }
}

function focusVertex(store: StoreState, vertexId: number) {
  const g = store.game;
  if (!g) return;
  const v = g.board.vertices[vertexId];
  if (v) store.fx.cameraFocus = { x: v.x, z: v.z };
}

function applyRollFx(store: StoreState, outcome: RollOutcome) {
  useStore.setState({
    fx: {
      ...store.fx,
      roll: outcome,
      rollNonce: store.fx.rollNonce + 1,
      combos: outcome.combos,
      activatedTiles: outcome.activatedTileIds,
    },
  });
  if (outcome.combos.length) {
    outcome.combos.forEach((c, i) =>
      setTimeout(() => useStore.getState().pushToast(c, "epic", true), i * 260),
    );
  }
  if (outcome.seven) useStore.getState().pushToast("SEVEN — ROBBER!", "bad", true);
}
