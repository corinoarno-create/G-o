import { useEffect, useState } from 'preact/hooks';
import { loadWorld, type WorldData } from './data/world.ts';
import { EndScreen } from './game/EndScreen.tsx';
import { GameScreen } from './game/GameScreen.tsx';
import type { SessionSummary } from './game/session.ts';
import { prepareGame, type GameConfig, type PreparedGame } from './game/start.ts';
import { Sandbox } from './sandbox/Sandbox.tsx';

type Screen =
  | { kind: 'sandbox' }
  | { kind: 'loading' }
  | { kind: 'game'; game: PreparedGame }
  | { kind: 'end'; config: GameConfig; summary: SessionSummary };

// Pour l'instant, l'app ouvre le bac à sable de la carte, d'où l'on lance une manche.
// Il sera remplacé par l'accueil « ce que je peux travailler » à l'étape 7.
export function App() {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'sandbox' });
  const [zoneId, setZoneId] = useState('world');

  useEffect(() => {
    loadWorld()
      .then(setWorld)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  if (error) return <p class="placeholder">Impossible de charger la carte : {error}</p>;
  if (!world) return <p class="placeholder">Chargement de la carte…</p>;

  const play = (config: GameConfig) => {
    setScreen({ kind: 'loading' });
    prepareGame(world, config)
      .then((game) => setScreen({ kind: 'game', game }))
      .catch((reason: unknown) => {
        console.error(reason);
        setError('impossible de préparer la manche.');
      });
  };

  switch (screen.kind) {
    case 'loading':
      return <p class="placeholder">Préparation de la manche…</p>;
    case 'game':
      return (
        <GameScreen
          world={world}
          game={screen.game}
          onFinish={(summary) => setScreen({ kind: 'end', config: screen.game.config, summary })}
          onQuit={() => void screen.game.recorder.flush().then(() => setScreen({ kind: 'sandbox' }))}
        />
      );
    case 'end':
      return (
        <EndScreen
          world={world}
          config={screen.config}
          summary={screen.summary}
          onReplayMissed={() => play({ ...screen.config, items: screen.summary.missed })}
          onRestart={() => play({ ...screen.config, items: undefined })}
          onExit={() => setScreen({ kind: 'sandbox' })}
        />
      );
    default:
      return <Sandbox world={world} zoneId={zoneId} onZoneChange={setZoneId} onPlay={play} />;
  }
}
