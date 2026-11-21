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
import { requestSync, useSync } from './sync/sync.ts';
import { ChallengeScreen } from './challenge/ChallengeScreen.tsx';
import { ChallengesScreen } from './challenge/ChallengesScreen.tsx';
import { finishChallenge, playFromGame } from './challenge/challenges.ts';
import { connectedAccount } from './sync/sync.ts';

type Screen =
  | { kind: 'home' }
  | { kind: 'explore'; withBuilder: boolean }
  | { kind: 'progress' }
  | { kind: 'credits' }
  | { kind: 'loading' }
  | { kind: 'discover'; discovery: PreparedDiscovery }
  | { kind: 'game'; game: PreparedGame }
  | { kind: 'end'; game: PreparedGame; summary: SessionSummary; notice?: string }
  | { kind: 'challenge'; id: string; justPlayed?: boolean }
  | { kind: 'challenges' };

/** Défi ouvert par un lien (« …/G-o/?defi=k3x9p2 ») : on le lit une fois, puis on nettoie l'adresse. */
function challengeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const id = url.searchParams.get('defi');
  if (!id) return null;
  url.searchParams.delete('defi');
  window.history.replaceState(null, '', url.toString());
  return /^[a-z0-9]{6,32}$/.test(id) ? id : null;
}

export function App() {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>(() => {
    const id = challengeFromUrl();
    return id ? { kind: 'challenge', id } : { kind: 'home' };
  });
  const [zoneId, setZoneId] = useState('world');
  const zones = useMemo(() => (world ? buildZones(world) : []), [world]);
  // Une synchronisation qui apporte du neuf fait recharger l'accueil et la progression.
  const { dataVersion } = useSync();

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
  const calm = ['home', 'progress', 'credits', 'end', 'challenge', 'challenges'].includes(screen.kind);
  const openChallenge = (id: string, justPlayed = false) => setScreen({ kind: 'challenge', id, justPlayed });
  const challenges = () => setScreen({ kind: 'challenges' });
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
            onFinish={(summary) => {
              const { game } = screen;
              // Les réponses sont enregistrées : on les envoie vers mes autres appareils.
              void requestSync({ force: true });
              if (!game.challenge) {
                setScreen({ kind: 'end', game, summary });
                return;
              }
              const play = game.challenge;
              setScreen({ kind: 'loading' });
              void finishChallenge(play, summary).then((sent) =>
                sent
                  ? openChallenge(play.id, true)
                  : setScreen({
                      kind: 'end',
                      game,
                      summary,
                      notice: 'Pas de réseau pour l’instant : ton score de défi partira dès le retour de la connexion.',
                    }),
              );
            }}
            onQuit={() =>
              void screen.game.recorder.flush().then(() => {
                home();
                void requestSync({ force: true });
              })
            }
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
            notice={screen.notice}
            onChallenge={
              connectedAccount() && playFromGame(screen.game)
                ? () => {
                    const play = playFromGame(screen.game)!;
                    const { game, summary } = screen;
                    setScreen({ kind: 'loading' });
                    void finishChallenge(play, summary).then((sent) =>
                      sent
                        ? openChallenge(play.id, true)
                        : setScreen({
                            kind: 'end',
                            game,
                            summary,
                            notice: 'Pas de réseau pour l’instant : le défi sera créé dès le retour de la connexion.',
                          }),
                    );
                  }
                : undefined
            }
          />
        );
      case 'challenge':
        return (
          <ChallengeScreen
            key={`${screen.id}-${dataVersion}`}
            world={world}
            zones={zones}
            challengeId={screen.id}
            justPlayed={screen.justPlayed}
            onPlay={play}
            onChallenges={challenges}
            onHome={home}
          />
        );
      case 'challenges':
        return <ChallengesScreen world={world} zones={zones} onOpen={openChallenge} onPlay={play} onHome={home} />;
      case 'credits':
        return <CreditsScreen onHome={home} />;
      case 'progress':
        return <ProgressScreen key={dataVersion} world={world} zones={zones} onPlay={play} onHome={home} />;
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
            key={dataVersion}
            world={world}
            zones={zones}
            onPlay={play}
            onExplore={() => setScreen({ kind: 'explore', withBuilder: false })}
            onProgress={() => setScreen({ kind: 'progress' })}
            onChallenges={challenges}
            onCredits={() => setScreen({ kind: 'credits' })}
          />
        );
    }
  }
}
