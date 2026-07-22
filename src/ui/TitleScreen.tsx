import { useGame } from '../game/store';
import { TitleScene } from '../scene/TitleScene';
import { sfx } from '../audio/sfx';

export function TitleScreen() {
  const goSetup = useGame((s) => s.goSetup);
  const continueGame = useGame((s) => s.continueGame);
  const savedAvailable = useGame((s) => s.savedAvailable);
  const clearSave = useGame((s) => s.clearSave);

  return (
    <div className="screen title-screen">
      <div className="scene-bg"><TitleScene /></div>
      <div className="title-overlay">
        <div className="title-block">
          <div className="title-kicker">A BANGER VIBECODING PRODUCTION</div>
          <h1 className="title-logo">HEXTOPIA</h1>
          <div className="title-sub">settle · pave · ascend · a catan-like of questionable restraint</div>
        </div>
        <div className="title-buttons">
          <button
            className="btn btn-huge btn-gold"
            onClick={() => { sfx.click(); sfx.startMusic(); goSetup(); }}
          >
            ▶ START GAME
          </button>
          {savedAvailable && (
            <button className="btn btn-big" onClick={() => { sfx.click(); sfx.startMusic(); continueGame(); }}>
              ⏯ CONTINUE GAME
            </button>
          )}
          {savedAvailable && (
            <button className="btn btn-ghost" onClick={() => { sfx.click(); clearSave(); }}>
              🗑 reset save
            </button>
          )}
        </div>
        <div className="title-footer">no login · no server · your browser is the board</div>
      </div>
    </div>
  );
}
