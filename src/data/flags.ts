// URL des drapeaux (data/flags/*.svg), résolues au build par Vite (noms de fichiers avec empreinte).
const urls = import.meta.glob<string>('../../data/flags/*.svg', { query: '?url', import: 'default', eager: true });

/** URL du drapeau à partir du nom de fichier stocké dans la fiche (ex. « fr.svg »), ou null. */
export function flagUrl(file: string | null): string | null {
  return file ? (urls[`../../data/flags/${file}`] ?? null) : null;
}
