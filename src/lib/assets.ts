// Construit l'URL d'un fichier de données servi par l'app (ex. « data/countries.json »).
// Sur GitHub Pages, l'app vit sous /<dépôt>/ : il faut préfixer chaque chemin par la base,
// sinon les fichiers seraient cherchés à la racine du domaine.
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}${cleanPath}`;
}
