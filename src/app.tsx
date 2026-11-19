import { useEffect, useMemo, useState } from 'preact/hooks';
import { loadWorld, type WorldData } from './data/world.ts';
import { EndScreen } from './game/EndScreen.tsx';
import { GameScreen } from './game/GameScreen.tsx';
import type { SessionSummary } from './game/session.ts';
import { prepareGame, type GameRequest, type PreparedGame } from './game/start.ts';
import { HomeScreen } from './home/HomeScreen.tsx';
import { DiscoveryScreen } from './discovery/DiscoveryScreen.tsx';
import { prepareDiscovery, type PreparedDiscovery } from './discovery/start.ts';
import { buildZones } from './map/zones.ts';
import { CreditsScreen } from './credits/CreditsScreen.tsx';
import { ProgressScreen } from './progress/ProgressScreen.tsx';
import { PwaNotices } from './pwa/PwaNotices.tsx';
import { Sandbox } from './sandbox/Sandbox.tsx';

type Screen =
  | { kind: 'home' }
  | { kind: 'explore'; withBuilder: boolean }
  | { kind: 'progress' }
  | { kind: 'credits' }
  | { kind: 'loading' }
  | { kind: 'discover'; discovery: PreparedDiscovery }
  | { kind: 'game'; game: PreparedGame }
  | { kind: 'end'; game: PreparedGame; summary: SessionSummary };

export function App() {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [zoneId, setZoneId] = useState('world');
  const zones = useMemo(() => (world ? buildZones(world) : []), [world]);

  useEffect(() => {
    loadWorld()
      .then(setWorld)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  if (error) return <p class="placeholder">Oups, quelque chose s’est mal passé : {error}</p>;
  if (!world || zones.length === 0) return <p class="placeholder">Chargement de la carte…</p>;

  const home = () => setScreen({ kind: 'home' });
  const play = (request: GameRequest) => {
    setScreen({ kind: 'loading' });
    if (request.kind === 'discovery') {
      prepareDiscovery(world, request)
        .then((discovery) => setScreen({ kind: 'discover', discovery }))
        .catch((reason: unknown) => {
          console.error(reason);
          setError('impossible de préparer la découverte.');
        });
      return;
    }
    prepareGame(world, zones[0]!, request)
      .then((game) => setScreen({ kind: 'game', game }))
      .catch((reason: unknown) => {
        console.error(reason);
        setError('impossible de préparer la manche.');
      });
  };

  // Bandeaux de l'app installable (mise à jour, hors ligne) : jamais pendant une manche ou une découverte.
  const calm = screen.kind === 'home' || screen.kind === 'progress' || screen.kind === 'credits' || screen.kind === 'end';
  return (
    <>
      {renderScreen(world)}
      {calm && <PwaNotices />}
    </>
  );

  // La carte est chargée ici (on ne rend rien d'autre avant) : on la passe pour garder un type non nul.
  function renderScreen(world: WorldData) {
    switch (screen.kind) {
      case 'loading':
        return <p class="placeholder">Préparation de la manche…</p>;
      case 'discover': {
        const { discovery } = screen;
        return (
          <DiscoveryScreen
            world={world}
            discovery={discovery}
            // Étape 3, Retrouver : la vraie manche, qui compte pour la mémoire.
            onDone={() =>
              play({
                kind: 'questions',
                title: discovery.title,
                zone: discovery.zone,
                questions: discovery.entityIds.map((entityId) => ({
                  entityId,
                  exercise: discovery.exercise,
                })),
                restart: discovery.request,
              })
            }
            onQuit={home}
          />
        );
      }
      case 'game':
        return (
          <GameScreen
            world={world}
            game={screen.game}
            onFinish={(summary) => setScreen({ kind: 'end', game: screen.game, summary })}
            onQuit={() => void screen.game.recorder.flush().then(home)}
          />
        );
      case 'end':
        return (
          <EndScreen
            world={world}
            title={screen.game.title}
            summary={screen.summary}
            onReplayMissed={() =>
              play({
                kind: 'questions',
                title: `À revoir · ${screen.game.title}`,
                zone: screen.game.zone,
                questions: screen.summary.missed,
              })
            }
            onRestart={() => {
              const { request } = screen.game;
              play(request.kind === 'questions' && request.restart ? request.restart : request);
            }}
            restartLabel={
              screen.game.request.kind === 'questions' && screen.game.request.restart?.kind === 'discovery'
                ? 'Découvrir 5 de plus'
                : undefined
            }
            onExit={home}
          />
        );
      case 'credits':
        return <CreditsScreen onHome={home} />;
      case 'progress':
        return <ProgressScreen world={world} zones={zones} onPlay={play} onHome={home} />;
      case 'explore':
        return (
          <Sandbox
            world={world}
            zoneId={zoneId}
            onZoneChange={setZoneId}
            onPlay={play}
            onHome={home}
            initialBuilderOpen={screen.withBuilder}
          />
        );
      default:
        return (
          <HomeScreen
            world={world}
            zones={zones}
            onPlay={play}
            onExplore={(withBuilder) => setScreen({ kind: 'explore', withBuilder })}
            onProgress={() => setScreen({ kind: 'progress' })}
            onCredits={() => setScreen({ kind: 'credits' })}
          />
        );
    }
  }
}
