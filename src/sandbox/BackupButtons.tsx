// Boutons provisoires d'export et d'import de la progression (étape 4).
// Ils rejoindront la page de réglages quand l'accueil sera en place.
import { useRef, useState } from 'preact/hooks';
import { BackupError, downloadText, exportBackup, importBackup } from '../storage/backup.ts';
import { progressDb } from '../storage/progress-db.ts';

export function BackupButtons() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onExport = async () => {
    const { fileName, text } = await exportBackup(await progressDb());
    downloadText(fileName, text);
    setMessage(`Progression exportée : ${fileName}`);
  };

  const onImport = async (file: File) => {
    try {
      const summary = await importBackup(await progressDb(), await file.text(), 'merge');
      setMessage(
        `Importé : ${summary.cardsAdded} carte(s) ajoutée(s), ${summary.cardsUpdated} mise(s) à jour, ` +
          `${summary.reviewsAdded} réponse(s) ajoutée(s).`,
      );
    } catch (error) {
      setMessage(error instanceof BackupError ? error.message : 'Import impossible : fichier illisible.');
    }
  };

  return (
    <div class="backup">
      <button type="button" class="backup__button" onClick={() => void onExport()}>
        Exporter
      </button>
      <button type="button" class="backup__button" onClick={() => fileInput.current?.click()}>
        Importer
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void onImport(file);
        }}
      />
      {message && (
        <p class="backup__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
