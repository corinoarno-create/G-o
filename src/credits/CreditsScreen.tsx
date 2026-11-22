// Page « Crédits » (§ 10) : les données ouvertes, polices et bibliothèques utilisées, avec leurs licences.
import { BookIcon } from '../ui/icons.tsx';
import './credits.css';

interface Credit {
  what: string;
  source: string;
  url: string;
  license: string;
}

const DATA: Credit[] = [
  {
    what: 'Frontières des pays et territoires ; fleuves, lacs et limites intérieures (repères de placement)',
    source: 'Natural Earth (1:10m, v5.1.2)',
    url: 'https://www.naturalearthdata.com/',
    license: 'Domaine public',
  },
  {
    what: 'Liste, codes, régions et noms français des pays',
    source: 'mledoze/countries',
    url: 'https://github.com/mledoze/countries',
    license: 'ODbL 1.0',
  },
  { what: 'Capitales (noms français, coordonnées)', source: 'Wikidata', url: 'https://www.wikidata.org/', license: 'CC0' },
  {
    what: 'Population',
    source: 'Banque mondiale, indicateur SP.POP.TOTL',
    url: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
    license: 'CC BY 4.0',
  },
  { what: 'Drapeaux', source: 'flag-icons', url: 'https://github.com/lipis/flag-icons', license: 'MIT' },
  {
    what: 'Drapeaux de Chypre du Nord et du Somaliland',
    source: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/',
    license: 'Domaine public',
  },
];

const SOFTWARE: Credit[] = [
  { what: 'Polices Caveat et Nunito', source: 'Google Fonts, via Fontsource', url: 'https://fontsource.org/', license: 'SIL OFL 1.1' },
  { what: 'Interface', source: 'Preact', url: 'https://preactjs.com/', license: 'MIT' },
  {
    what: 'Cartes, zoom et projections',
    source: 'd3-geo, d3-zoom, d3-selection, d3-transition, topojson-client',
    url: 'https://d3js.org/',
    license: 'ISC',
  },
  {
    what: 'Répétition espacée',
    source: 'ts-fsrs (algorithme FSRS)',
    url: 'https://github.com/open-spaced-repetition/ts-fsrs',
    license: 'MIT',
  },
  { what: 'Stockage local', source: 'idb', url: 'https://github.com/jakearchibald/idb', license: 'ISC' },
  { what: 'Fonctionnement hors ligne', source: 'Workbox, vite-plugin-pwa', url: 'https://vite-pwa-org.netlify.app/', license: 'MIT' },
];

function CreditList({ items }: { items: Credit[] }) {
  return (
    <ul class="credits__list">
      {items.map((item) => (
        <li key={item.what}>
          <span class="credits__what">{item.what}</span>
          <span>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {item.source}
            </a>{' '}
            <span class="credits__license">{item.license}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CreditsScreen({ onHome }: { onHome: () => void }) {
  return (
    <div class="credits">
      <header class="credits__bar">
        <button type="button" class="btn home__pill" onClick={onHome}>
          <BookIcon size={18} /> Carnet
        </button>
        <h1>Crédits</h1>
      </header>
      <main class="credits__main">
        <section class="paper-card credits__card">
          <h2>Données</h2>
          <p class="credits__help">Géo repose sur des données ouvertes, préparées une fois pour toutes et embarquées dans l’app.</p>
          <CreditList items={DATA} />
          <p class="credits__help">
            Les frontières suivent la situation de fait, sauf pour la Crimée et le Sahara occidental, représentés selon les frontières
            reconnues par l’ONU. Les territoires contestés sont présentés de façon neutre et factuelle.
          </p>
        </section>
        <section class="paper-card credits__card">
          <h2>Polices et logiciels</h2>
          <CreditList items={SOFTWARE} />
        </section>
        <section class="paper-card credits__card">
          <h2>Mes données</h2>
          <p>
            Ta progression reste dans ce navigateur, sur cet appareil : rien n’est envoyé sur Internet. Pense à l’exporter de temps en temps
            depuis l’accueil, pour la garder ou la passer sur un autre appareil.
          </p>
        </section>
      </main>
    </div>
  );
}
