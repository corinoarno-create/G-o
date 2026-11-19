// Préparation d'une découverte : les éléments jamais vus d'un exercice dans une zone, par groupe de 5.
import type { WorldData } from '../data/world.ts';
import type { ExerciseId } from '../game/exercises.ts';
import type { GameRequest } from '../game/plans.ts';
import { requestTitle } from '../game/plans.ts';
import { selectItems } from '../game/selection.ts';
import { eligibleIds, loadCards } from '../game/start.ts';
import { EXERCISES } from '../game/exercises.ts';
import type { Zone } from '../map/zones.ts';
import { DISCOVERY_SIZE } from './discovery.ts';

export interface PreparedDiscovery {
  request: Extract<GameRequest, { kind: 'discovery' }>;
  title: string;
  exercise: ExerciseId;
  zone: Zone;
  /** Éléments à découvrir (5 au plus), dans l'ordre où on les observe. */
  entityIds: string[];
}

export async function prepareDiscovery(world: WorldData, request: Extract<GameRequest, { kind: 'discovery' }>): Promise<PreparedDiscovery> {
  const cards = await loadCards();
  const ids = eligibleIds(world, request.exercise, request.zone);
  const entityIds = selectItems(ids, EXERCISES[request.exercise].skill, cards, { content: 'new', count: DISCOVERY_SIZE }, new Date());
  return {
    request,
    title: requestTitle(request),
    exercise: request.exercise,
    zone: request.zone,
    entityIds,
  };
}
