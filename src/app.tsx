import { useEffect, useState } from 'preact/hooks';
import { loadWorld, type WorldData } from './data/world.ts';
import { Sandbox } from './sandbox/Sandbox.tsx';

// Pour l'instant, l'app ouvre le bac à sable de la carte (étape 2).
// Il sera remplacé par l'accueil « ce que je peux travailler » à l'étape 7.
export function App() {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorld()
      .then(setWorld)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  if (error) return <p class="placeholder">Impossible de charger la carte : {error}</p>;
  if (!world) return <p class="placeholder">Chargement de la carte…</p>;
  return <Sandbox world={world} />;
}
