import { useEffect } from 'react';
import { useGame } from './game/store';
import { TitleScreen } from './ui/TitleScreen';
import { SetupScreen } from './ui/SetupScreen';
import { GameScene } from './scene/GameScene';
import { TopBar } from './ui/TopBar';
import { BottomBar } from './ui/BottomBar';
import { Toasts, LogFeed, NpcOfferPopup, EventBanner, HudCorner } from './ui/Overlays';
import { VictoryScreen } from './ui/VictoryScreen';
import { sfx } from './audio/sfx';

export default function App() {
  const screen = useGame((s) => s.screen);
  const fastMode = useGame((s) => s.settings.fastMode);

  // The heartbeat: drives NPC turns, watchdogs, and cleanup.
  useEffect(() => {
    const interval = setInterval(() => useGame.getState().aiTick(), fastMode ? 150 : 420);
    return () => clearInterval(interval);
  }, [fastMode]);

  // Keyboard: Esc cancels placement; Enter/Space rolls or ends turn.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      const g = s.game;
      if (!g || s.screen !== 'game') return;
      if (e.key === 'Escape') s.cancelPlacement();
      if ((e.key === ' ' || e.key === 'Enter') && g.current === 0 && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (g.phase === 'roll') s.rollDice();
        else if (g.phase === 'main' && !g.placement) s.endTurn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Start ambient music on the first interaction (browser autoplay rules).
  useEffect(() => {
    const kick = () => { sfx.startMusic(); window.removeEventListener('pointerdown', kick); };
    window.addEventListener('pointerdown', kick);
    return () => window.removeEventListener('pointerdown', kick);
  }, []);

  // Near-win tension: extra music layer + subtle vignette.
  const tension = useGame((s) => {
    const g = s.game;
    if (!g || g.winner !== null) return 0;
    const max = Math.max(...g.players.map((p) => p.vp));
    if (max >= g.config.targetVp - 1) return 2;
    if (max >= g.config.targetVp - 2) return 1;
    return 0;
  });
  useEffect(() => {
    sfx.setTension(tension);
    document.body.classList.toggle('tension-1', tension === 1);
    document.body.classList.toggle('tension-2', tension === 2);
  }, [tension]);

  if (screen === 'title') return <TitleScreen />;
  if (screen === 'setup') return <SetupScreen />;

  return (
    <div className="screen game-screen">
      <div className="scene-bg"><GameScene /></div>
      <TopBar />
      <EventBanner />
      <Toasts />
      <LogFeed />
      <NpcOfferPopup />
      <BottomBar />
      <HudCorner />
      <VictoryScreen />
    </div>
  );
}
