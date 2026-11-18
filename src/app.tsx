import { APP_VERSION } from './lib/version';

// Écran provisoire de l'étape 0 : il prouve que le socle (build, déploiement) fonctionne.
// Il sera remplacé par l'accueil « ce que je peux travailler » à l'étape 7.
export function App() {
  return (
    <main class="placeholder">
      <img class="placeholder__logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={96} height={96} />
      <h1>Géo</h1>
      <p class="placeholder__tagline">Apprendre la géographie en s'amusant.</p>
      <p class="placeholder__status">Le socle est en place. La carte arrive bientôt !</p>
      <p class="placeholder__version">v{APP_VERSION}</p>
    </main>
  );
}
