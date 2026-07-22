// Optional debug bridge attached to window. NOT required to play the game — the
// full loop is playable through the UI alone. This just makes automated smoke
// tests and manual debugging convenient.

import { useStore } from "./store/store";
import {
  validSettlementVertices,
  validRoadEdges,
  validCityVertices,
  validMegacityVertices,
} from "./game/rules";
import { aiBuildPhase, aiMoveRobber, aiSetupPlace } from "./game/ai";
import { endTurn } from "./game/gameReducer";

export function installDebugBridge() {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.__hexfall_store = useStore;
  w.__hexfall_valid = {
    settlements: validSettlementVertices,
    roads: validRoadEdges,
    cities: validCityVertices,
    megacities: validMegacityVertices,
  };
  // Auto-plays a single micro-step for the human seat (player 0), reusing the AI.
  w.__hexfall_autoHuman = () => {
    const st = useStore.getState();
    const g = st.game;
    if (!g || g.current !== 0 || g.phase === "over") return;
    if (g.phase === "setup-place") {
      st.commit((s) => aiSetupPlace(s));
      st.driveAI();
    } else if (g.phase === "roll") {
      st.roll();
    } else if (g.phase === "robber-move" || g.phase === "robber-steal") {
      st.commit((s) => aiMoveRobber(s));
    } else if (g.phase === "build") {
      st.commit((s) => {
        aiBuildPhase(s);
        endTurn(s);
      });
      st.driveAI();
    }
  };
}
