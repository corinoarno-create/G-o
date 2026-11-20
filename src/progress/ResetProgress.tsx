// Remise à zéro de la progression : tout, ou une zone du monde (éventuellement une seule catégorie),
// pour la retravailler en profondeur. Toujours après une confirmation qui dit ce qui sera effacé.
import { useState } from 'preact/hooks';
import type { Skill } from '../engine/srs.ts';
import type { Zone } from '../map/zones.ts';
import { downloadText, exportBackup } from '../storage/backup.ts';
import { countProgress, resetProgress, type ResetFilter } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import { requestSync } from '../sync/sync.ts';

type Scope = 'zone' | 'all';
type Category = 'all' | 'countries' | 'capitals' | 'flags';

const CATEGORY_SKILLS: Record<Exclude<Category, 'all'>, Skill[]> = {
  countries: ['locate-country', 'name-country'],
  capitals: ['locate-capital', 'capital-country', 'name-capital'],
  flags: ['flag'],
};

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'Tout',
  countries: 'Pays',
  capitals: 'Capitales',
  flags: 'Drapeaux',
};

interface Props {
  zones: Zone[];
  /** Appelé après un effacement, pour recalculer les statistiques. */
  onReset: () => void;
}

export function ResetProgress({ zones, onReset }: Props) {
  const regions = zones.filter((zone) => zone.kind !== 'world');
  const continents = regions.filter((zone) => zone.kind === 'continent');
  const [scope, setScope] = useState<Scope>('zone');
  const [zoneId, setZoneId] = useState(continents[0]?.id ?? '');
  const [category, setCategory] = useState<Category>('all');
  /** Ce qui sera effacé, en attente de confirmation. */
  const [pending, setPending] = useState<{ filter: ResetFilter; label: string; cards: number; reviews: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const zone = regions.find((z) => z.id === zoneId);

  const prepare = async () => {
    setMessage(null);
    const filter: ResetFilter =
      scope === 'all'
        ? {}
        : {
            entityIds: new Set(zone?.entityIds ?? []),
            ...(category === 'all' ? {} : { skills: new Set(CATEGORY_SKILLS[category]) }),
          };
    const label =
      scope === 'all' ? 'toute ta progression' : `${zone?.label ?? ''}${category === 'all' ? '' : ` · ${CATEGORY_LABELS[category]}`}`;
    const counts = await countProgress(await progressDb(), filter);
    if (counts.cards === 0 && counts.reviews === 0) {
      setMessage(`Rien à effacer pour ${label} : tout y est déjà « nouveau ».`);
      return;
    }
    setPending({ filter, label, ...counts });
  };

  const confirm = async () => {
    if (!pending) return;
    const done = await resetProgress(await progressDb(), pending.filter);
    setPending(null);
    setMessage(
      `C’est fait : ${done.cards} carte${done.cards > 1 ? 's' : ''} mémoire remise${done.cards > 1 ? 's' : ''} à zéro. ` +
        'Ces éléments sont de nouveau « nouveaux » : à toi de les redécouvrir !',
    );
    onReset();
    // L'effacement part tout de suite vers mes autres appareils.
    void requestSync({ force: true });
  };

  const backup = async () => {
    const { fileName, text } = await exportBackup(await progressDb());
    downloadText(fileName, text);
  };

  return (
    <div class="reset">
      <p class="progress__help">
        Pour retravailler une région en profondeur : ses éléments redeviennent « nouveaux » et leur historique est effacé. Les réglages et
        les favoris sont gardés.
      </p>

      <div class="reset__row" role="radiogroup" aria-label="Que remettre à zéro ?">
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'zone'}
          class={`reset__tab ${scope === 'zone' ? 'is-active' : ''}`}
          onClick={() => setScope('zone')}
        >
          Une zone
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'all'}
          class={`reset__tab ${scope === 'all' ? 'is-active' : ''}`}
          onClick={() => setScope('all')}
        >
          Tout
        </button>
      </div>

      {scope === 'zone' && (
        <>
          <label class="reset__field">
            <span>Zone</span>
            <select class="builder__select" value={zoneId} onChange={(e) => setZoneId(e.currentTarget.value)}>
              {continents.map((continent) => (
                <optgroup key={continent.id} label={continent.label}>
                  <option value={continent.id}>{continent.label} (tout)</option>
                  {regions
                    .filter((z) => z.parent === continent.id)
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div class="reset__row" role="radiogroup" aria-label="Catégorie">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((id) => (
              <button
                type="button"
                key={id}
                role="radio"
                aria-checked={category === id}
                class={`reset__tab ${category === id ? 'is-active' : ''}`}
                onClick={() => setCategory(id)}
              >
                {CATEGORY_LABELS[id]}
              </button>
            ))}
          </div>
        </>
      )}

      {pending ? (
        <div class="reset__confirm" role="alertdialog" aria-label="Confirmer la remise à zéro">
          <p>
            Remettre à zéro <strong>{pending.label}</strong> efface <strong>{pending.cards}</strong> carte
            {pending.cards > 1 ? 's' : ''} mémoire et <strong>{pending.reviews}</strong> réponse{pending.reviews > 1 ? 's' : ''} de
            l’historique.
          </p>
          <p class="progress__help">
            C’est définitif. Exporte d’abord une sauvegarde si tu veux pouvoir revenir en arrière. Attention : importer plus tard une
            sauvegarde plus ancienne ferait revenir ces éléments.
          </p>
          <div class="reset__actions">
            <button type="button" class="btn" onClick={() => void backup()}>
              Exporter une sauvegarde
            </button>
            <button type="button" class="btn btn--terracotta" onClick={() => void confirm()}>
              Oui, remettre à zéro
            </button>
            <button type="button" class="btn-ghost" onClick={() => setPending(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" class="btn reset__start" onClick={() => void prepare()} disabled={scope === 'zone' && !zone}>
          Remettre à zéro…
        </button>
      )}

      {message && (
        <p class="reset__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
