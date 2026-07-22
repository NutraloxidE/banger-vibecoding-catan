import { useStore } from "../store/store";
import { COSTS, RESOURCE_INFO } from "../game/constants";
import { affordable } from "../game/gameReducer";
import {
  validCityVertices,
  validMegacityVertices,
  validRoadEdges,
  validSettlementVertices,
} from "../game/rules";
import type { ResourceType } from "../game/types";
import { audio } from "../fx/audio";

const RES_ORDER: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];

const ROLL_LABELS = ["ROLL THE ECONOMY", "SUMMON THE DICE", "TEMPT FATE", "PRODUCE OR PERISH"];
const END_LABELS = ["END MY GLORIOUS TURN", "CONCLUDE PROCEEDINGS", "PASS THE BATON", "I'M DONE HERE"];

function CostChips({ kind }: { kind: keyof typeof COSTS }) {
  const cost = COSTS[kind];
  return (
    <span className="cost-chips">
      {(Object.keys(cost) as ResourceType[]).map((r) => (
        <span key={r} className="cost-chip" title={RESOURCE_INFO[r].label}>
          {RESOURCE_INFO[r].icon}
          {cost[r]}
        </span>
      ))}
    </span>
  );
}

export function BottomHand({ onOpenTrade }: { onOpenTrade: () => void }) {
  const game = useStore((s) => s.game);
  const buildMode = useStore((s) => s.buildMode);
  const setBuildMode = useStore((s) => s.setBuildMode);
  const roll = useStore((s) => s.roll);
  const endTurn = useStore((s) => s.endTurn);
  const tick = useStore((s) => s.tick);
  if (!game) return null;

  const human = game.current === 0 && game.players[0].isHuman;
  const me = game.players[0];
  const myTurn = human;

  const rollLabel = ROLL_LABELS[game.turnNumber % ROLL_LABELS.length];
  const endLabel = END_LABELS[game.turnNumber % END_LABELS.length];

  const canRoad = affordable(game, "road", 0) && validRoadEdges(game, 0).length > 0;
  const canSettlement = affordable(game, "settlement", 0) && validSettlementVertices(game, 0, false).length > 0;
  const canCity = affordable(game, "city", 0) && validCityVertices(game, 0).length > 0;
  const canMega = affordable(game, "megacity", 0) && validMegacityVertices(game, 0).length > 0;

  const prompt = getPrompt(game, myTurn, buildMode);

  const pick = (kind: "road" | "settlement" | "city" | "megacity") => {
    audio.click();
    if (buildMode?.kind === kind) setBuildMode(null);
    else setBuildMode({ kind });
  };

  return (
    <div className="bottom">
      {prompt && <div className="action-prompt">{prompt}</div>}

      <div className="hand">
        {/* resource cards */}
        <div className="res-cards">
          {RES_ORDER.map((r) => (
            <div key={r} className="res-card" style={{ borderColor: RESOURCE_INFO[r].color }}>
              <div className="res-icon" style={{ background: RESOURCE_INFO[r].color }}>
                {RESOURCE_INFO[r].icon}
              </div>
              <div className="res-count">{me.resources[r]}</div>
              <div className="res-label">{RESOURCE_INFO[r].label}</div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div className="actions">
          {game.phase === "roll" && myTurn && (
            <button className="btn btn-roll" onClick={() => { audio.unlock(); roll(); }}>
              🎲 {rollLabel}
            </button>
          )}

          {game.phase === "build" && myTurn && (
            <>
              <div className="build-row">
                <BuildBtn label="Road" kind="road" active={buildMode?.kind === "road"} enabled={canRoad} onClick={() => pick("road")} />
                <BuildBtn label="Settle" kind="settlement" active={buildMode?.kind === "settlement"} enabled={canSettlement} onClick={() => pick("settlement")} />
                <BuildBtn label="City" kind="city" active={buildMode?.kind === "city"} enabled={canCity} onClick={() => pick("city")} />
                <BuildBtn label="Mega" kind="megacity" active={buildMode?.kind === "megacity"} enabled={canMega} onClick={() => pick("megacity")} />
              </div>
              <div className="build-row">
                <button className="btn btn-trade" onClick={() => { audio.click(); onOpenTrade(); }}>
                  🤝 Trade
                </button>
                {buildMode && (
                  <button className="btn btn-cancel" onClick={() => { audio.click(); setBuildMode(null); }}>
                    ✕ Cancel
                  </button>
                )}
                <button className="btn btn-end" onClick={() => { audio.click(); endTurn(); }}>
                  ➜ {endLabel}
                </button>
              </div>
            </>
          )}

          {!myTurn && game.phase !== "over" && (
            <div className="waiting">{game.players[game.current].name} is taking their turn…</div>
          )}
        </div>
      </div>
      <span style={{ display: "none" }}>{tick}</span>
    </div>
  );
}

function BuildBtn({
  label,
  kind,
  active,
  enabled,
  onClick,
}: {
  label: string;
  kind: keyof typeof COSTS;
  active: boolean;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`btn btn-build${active ? " active" : ""}${enabled ? " afford" : " broke"}`}
      onClick={onClick}
      disabled={!enabled && !active}
    >
      <span className="bb-label">{label}</span>
      <CostChips kind={kind} />
    </button>
  );
}

function getPrompt(
  game: NonNullable<ReturnType<typeof useStore.getState>["game"]>,
  myTurn: boolean,
  buildMode: ReturnType<typeof useStore.getState>["buildMode"],
): string | null {
  if (game.phase === "over") return null;
  if (game.phase === "setup-place") {
    if (!myTurn) return `Setup: ${game.players[game.current].name} is placing…`;
    return game.setupStage === "settlement"
      ? "SETUP · Tap a glowing spot to found your settlement"
      : "SETUP · Tap a glowing edge to lay your starting road";
  }
  if (game.phase === "robber-move" && myTurn) return "ROBBER · Tap a tile to move the robber";
  if (game.phase === "robber-move" && !myTurn) return "The robber is on the move…";
  if (game.phase === "build" && myTurn) {
    if (buildMode?.kind === "road") return "Tap a glowing edge to build a road (or Cancel)";
    if (buildMode?.kind === "settlement") return "Tap a glowing spot to build a settlement";
    if (buildMode?.kind === "city") return "Tap one of your settlements to upgrade to a City";
    if (buildMode?.kind === "megacity") return "Tap one of your Cities to ascend to a MEGA CITY";
    return null;
  }
  return null;
}
