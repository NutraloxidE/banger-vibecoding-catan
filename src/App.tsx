import { Suspense } from "react";
import { useStore } from "./store/store";
import { TitleScreen } from "./ui/TitleScreen";
import { SetupScreen } from "./ui/SetupScreen";
import { GameCanvas } from "./render/GameCanvas";
import { HUD } from "./ui/HUD";
import { ErrorBoundary } from "./ui/ErrorBoundary";

export default function App() {
  const screen = useStore((s) => s.screen);

  return (
    <ErrorBoundary>
      {screen === "title" && <TitleScreen />}
      {screen === "setup" && <SetupScreen />}
      {screen === "game" && (
        <div className="game-root">
          <Suspense fallback={<div className="loading">Assembling a suspicious island…</div>}>
            <GameCanvas />
          </Suspense>
          <HUD />
        </div>
      )}
    </ErrorBoundary>
  );
}
