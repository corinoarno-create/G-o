// Lanceur provisoire d'une manche (étape 5), en attendant le constructeur de session (étape 6).
import { useState } from 'preact/hooks';
import { EXERCISE_LIST, type ExerciseId } from '../game/exercises.ts';
import type { GameConfig } from '../game/start.ts';
import type { Zone } from '../map/zones.ts';

const COUNTS: Array<number | 'all'> = [10, 20, 50, 'all'];

interface Props {
  zone: Zone;
  onStart: (config: GameConfig) => void;
  onClose: () => void;
}

export function Launcher({ zone, onStart, onClose }: Props) {
  const [exercise, setExercise] = useState<ExerciseId>('locate-country');
  const [count, setCount] = useState<number | 'all'>(10);

  return (
    <form
      class="launcher"
      onSubmit={(event) => {
        event.preventDefault();
        onStart({ exercise, zone, count });
      }}
    >
      <div class="launcher__head">
        <h2>Jouer · {zone.label}</h2>
        <button type="button" class="sandbox__close" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>
      <fieldset class="launcher__exercises">
        <legend class="visually-hidden">Exercice</legend>
        {EXERCISE_LIST.map((item) => (
          <label key={item.id} class={`launcher__option ${exercise === item.id ? 'is-checked' : ''}`}>
            <input
              type="radio"
              name="exercise"
              value={item.id}
              checked={exercise === item.id}
              onChange={() => setExercise(item.id)}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div class="launcher__footer">
        <label>
          Questions{' '}
          <select value={String(count)} onChange={(event) => {
            const value = event.currentTarget.value;
            setCount(value === 'all' ? 'all' : Number(value));
          }}>
            {COUNTS.map((value) => (
              <option key={value} value={String(value)}>
                {value === 'all' ? 'Tout' : value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" class="sandbox__action">
          C'est parti !
        </button>
      </div>
    </form>
  );
}
