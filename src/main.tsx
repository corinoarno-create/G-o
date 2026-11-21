import { render } from 'preact';
// Polices embarquées (pas de requête externe : l'app doit marcher hors ligne).
import '@fontsource/caveat/latin-600.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
// Le thème global d'abord : les styles des écrans, chargés ensuite, peuvent le préciser.
import './styles.css';
import { App } from './app';
import { startPwa } from './pwa/pwa.ts';
import { startSync } from './sync/sync.ts';
import { flushPending } from './challenge/challenges.ts';

// Point d'entrée : on monte l'application dans <div id="app">.
const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}

// Service worker (hors ligne, mises à jour) et invitation à installer l'app.
startPwa();

// Synchronisation automatique entre mes appareils (si un compte est lié).
startSync();

// Scores de défi restés en attente (pas de réseau à la fin de la manche) : on les renvoie.
void flushPending();
window.addEventListener('online', () => void flushPending());
