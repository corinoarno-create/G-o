// Tolérance de saisie (mode Saisir) : accents, majuscules, tirets, « St » pour « Saint »,
// article facultatif (« Caire » pour « Le Caire »), et petites fautes de frappe (Levenshtein).
import { ENGINE_SETTINGS } from './settings.ts';

/** Abréviations développées avant comparaison (mots entiers). */
const ABBREVIATIONS: Record<string, string> = {
  st: 'saint',
  ste: 'sainte',
  mt: 'mont',
};

/** Articles et mots de tête qu'on peut omettre : « Le Caire » → « Caire », « Îles Cook » → « Cook ». */
const OPTIONAL_PREFIXES = ['le', 'la', 'les', 'l', 'iles', 'ile'];

/**
 * Forme normalisée d'un nom : minuscules, sans accents ni ponctuation, ligatures développées,
 * abréviations développées, espaces uniques. « Saint-Pierre-et-Miquelon » → « saint pierre et miquelon ».
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ');
}

/** Formes acceptables d'un nom : normalisé, et sans ses articles ou « Îles » de tête. */
export function variants(name: string): string[] {
  const forms = new Set<string>();
  let current = normalize(name);
  forms.add(current);
  // On retire les préfixes un par un : « Les Îles Cook » → « iles cook » → « cook ».
  for (;;) {
    const [first, ...rest] = current.split(' ');
    if (!first || rest.length === 0 || !OPTIONAL_PREFIXES.includes(first)) break;
    current = rest.join(' ');
    if (current === 'de' || current.startsWith('de ')) break; // « Île de Man » reste entier
    forms.add(current);
  }
  return [...forms];
}

/**
 * Distance d'édition (Levenshtein avec transpositions adjacentes) : nombre minimal d'insertions,
 * suppressions, substitutions ou inversions de deux lettres voisines pour passer de a à b.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Trois lignes glissantes suffisent (la transposition regarde deux lignes en arrière).
  let before = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2]! + 1);
      }
      current[j] = value;
    }
    [before, previous, current] = [previous, current, before];
  }
  return previous[b.length]!;
}

/** Nombre de fautes tolérées pour un nom normalisé, selon sa longueur (sans espaces). */
export function allowedTypos(normalizedName: string): number {
  const length = normalizedName.replace(/ /g, '').length;
  return ENGINE_SETTINGS.typing.tolerance.find((rule) => length <= rule.maxLength)!.typos;
}

export type MatchStatus = 'exact' | 'close' | 'wrong';

export interface MatchResult {
  /** exact : bonne réponse ; close : bonne réponse avec une petite faute ; wrong : mauvaise réponse. */
  status: MatchStatus;
  /** Réponse acceptée la plus proche (sa graphie d'origine), pour l'afficher en correction. */
  matched: string | null;
  /** Nombre de fautes par rapport à cette réponse. */
  typos: number;
  /** Si la saisie correspond à une autre réponse connue (ex. « Irak » au lieu d'« Iran »), laquelle. */
  confusedWith: string | null;
}

/**
 * Compare une saisie aux réponses acceptées.
 * @param accepted noms acceptés (nom courant et variantes) ;
 * @param others   autres réponses possibles du même type (ex. les autres pays) : si la saisie
 *                 correspond mieux à l'une d'elles, ce n'est pas une faute de frappe mais une confusion.
 */
export function matchAnswer(input: string, accepted: string[], others: string[] = []): MatchResult {
  const typed = normalize(input);
  const none: MatchResult = { status: 'wrong', matched: null, typos: Infinity, confusedWith: null };
  if (!typed) return none;
  const typedForms = variants(input);

  const closest = (names: string[]) => {
    let best: { name: string; typos: number; form: string } | null = null;
    for (const name of names) {
      for (const form of variants(name)) {
        for (const typedForm of typedForms) {
          const typos = editDistance(typedForm, form);
          if (!best || typos < best.typos) best = { name, typos, form };
        }
      }
    }
    return best;
  };

  const target = closest(accepted);
  if (!target) return none;
  const acceptedSet = new Set(accepted.flatMap(variants));
  const rival = closest(others.filter((name) => !variants(name).some((form) => acceptedSet.has(form))));

  if (target.typos === 0) return { status: 'exact', matched: target.name, typos: 0, confusedWith: null };
  // Une autre réponse connue correspond aussi bien ou mieux : c'est une confusion, pas une faute de frappe.
  if (rival && rival.typos <= target.typos) {
    return { status: 'wrong', matched: target.name, typos: target.typos, confusedWith: rival.name };
  }
  if (target.typos <= allowedTypos(target.form)) {
    return { status: 'close', matched: target.name, typos: target.typos, confusedWith: null };
  }
  return { status: 'wrong', matched: target.name, typos: target.typos, confusedWith: null };
}

/**
 * Autocomplétion facultative : noms dont une forme commence par la saisie (ou dont un mot commence par elle).
 * Les noms qui commencent par la saisie passent en premier.
 */
export function suggest(input: string, candidates: string[], limit: number = ENGINE_SETTINGS.typing.suggestions): string[] {
  const typed = normalize(input);
  if (typed.length < 2) return [];
  const scored: Array<{ name: string; rank: number }> = [];
  for (const name of candidates) {
    const forms = variants(name);
    if (forms.some((form) => form.startsWith(typed))) scored.push({ name, rank: 0 });
    else if (forms.some((form) => form.split(' ').some((word) => word.startsWith(typed)))) scored.push({ name, rank: 1 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'fr'))
    .slice(0, limit)
    .map((entry) => entry.name);
}
