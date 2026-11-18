import { render } from 'preact';
import { App } from './app';
import './styles.css';

// Point d'entrée : on monte l'application dans <div id="app">.
const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
