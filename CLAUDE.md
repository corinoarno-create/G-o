# Géo — mon app perso d'apprentissage de la géographie

> Ce fichier est le cahier des charges du projet. Claude Code le lit à chaque session.
> Langue du projet, de l'interface et des échanges : **français**.

## 1. Vision

**Objectif principal : apprendre en s'amusant.** Chaque décision (pédagogie, interface, récompenses) doit servir les deux à la fois. Une fonctionnalité amusante qui n'aide pas à retenir, ou une fonctionnalité efficace mais pénible, est à revoir.

Une app de géographie personnelle, inspirée de Seterra (GeoGuessr), mais **pilotée par la mémoire** :
au lieu de choisir un quiz figé, je choisis *ce que je veux travailler* (zones, catégories, nombre d'éléments)
et l'app génère la carte et la session toute seule. Un moteur de répétition espacée décide ce qui revient et quand.

L'utilisateur (Arno) connaît déjà tous les pays et territoires, leurs capitales et leurs drapeaux.
L'app doit **entretenir** ces acquis à petite dose et **faire découvrir** de nouvelles connaissances (villes, départements, États…).

L'ambiance est **positive** : on célèbre les progrès et on ne punit jamais l'oubli ni l'absence.

## 2. Plateformes

- **Une seule base de code** : une PWA responsive.
  - **PC** (grand écran, souris, clavier) : c'est l'usage confortable, avec une grande carte et des raccourcis clavier.
  - **Android** : l'app s'installe (manifest + service worker), avec des gestes tactiles et le pincer-zoomer.
- **Fonctionne hors ligne** après le premier chargement.
- Déploiement sur **GitHub Pages** (comme mes autres PWA).
- Données de progression **stockées localement** (IndexedDB).
- **Export/import JSON** de la progression, pour passer du PC au téléphone et faire des sauvegardes. Une synchronisation automatique viendra plus tard.

## 3. Périmètre géographique

### Monde (dès la V1)
- **Tous les pays et territoires**, soit environ 250 entrées : États membres de l'ONU, territoires dépendants (Groenland, Nouvelle-Calédonie, Polynésie, Guam…) et territoires contestés ou à reconnaissance limitée (Taïwan, Kosovo, Palestine, Sahara occidental, Chypre du Nord, Somaliland…).
- Pour chacun : nom FR, silhouette ou position, **capitale**, **drapeau**, **population**, continent et sous-région.
- **Taïwan est une entité à part entière**, pas une sous-partie de la Chine.
- **Les petites îles et micro-États** sont cliquables grâce à un cercle de repère visible autour des entités trop petites, comme dans Seterra.

### Villes
- Nombre de villes **selon la taille et l'importance du pays** :
  - **10** pour les grands pays (Chine, Inde, États-Unis, Brésil, Russie, Japon, Mexique, Nigeria, Indonésie, France, Allemagne, Italie, Royaume-Uni, Espagne, Australie, Argentine, Égypte, Turquie, Iran, Pakistan…) ;
  - **5** pour les pays moyens ;
  - **3** pour les petits pays ;
  - **1 à 2** pour les micro-États et petits territoires (souvent la capitale seulement).
- La liste se calcule d'abord par population (GeoNames), puis **Claude la corrige** pour privilégier les villes *connues ou influentes*. Une ville historique ou touristique majeure peut remplacer une banlieue très peuplée.
- Les 10 pays de mon ancien deck Anki gardent leurs villes : voir `data/sources/indices-anki.json`.

### Mode « Départements & États »
- **France** : les 101 départements (métropole + DROM). On les place, et on apprend aussi **le numéro** et **le chef-lieu**.
- **États-Unis** : les 50 États (+ DC), avec leur **capitale**.
- L'architecture doit permettre d'ajouter d'autres pays plus tard (régions françaises, provinces canadiennes, Länder allemands, régions italiennes…).

## 4. Modes de jeu

Chaque mode s'applique à n'importe quelle sélection (zone + catégorie).

| Mode | Principe |
|---|---|
| **Épingler** | Un nom s'affiche, je clique sur la carte. On mesure la **distance** pour les points (villes, capitales) ou la justesse pour les zones (pays, départements). |
| **Saisir** | Un élément est mis en évidence sur la carte, je tape son nom. La saisie tolère les accents et les petites fautes (distance de Levenshtein), et propose une autocomplétion facultative. |
| **Drapeaux** | Drapeau → pays (saisie ou clic sur la carte), ou pays → choix entre plusieurs drapeaux. |
| **Capitales** | Pays → capitale (saisie), capitale → pays, ou placer la capitale sur la carte. |
| **Population** | Je devine la population d'un pays (curseur sur une échelle logarithmique). Le score dépend de l'écart en %. Variante : « lequel est le plus peuplé ? » entre deux pays. ⚠️ C'est de l'**estimation**, pas de la mémorisation stricte, et les chiffres changent. Ce mode est un **mode de jeu à part** : il donne un score et de l'XP, mais **n'entre pas dans la répétition espacée FSRS** (ou alors avec une notation dédiée et tolérante). |
| **Numéros (France)** | Numéro → département, ou département → numéro. |

## 5. Comment j'apprends : le moteur pédagogique

### 5.1 Trois phases par élément
1. **Découverte** : un élément jamais vu m'est d'abord **montré** (position animée sur la carte, nom, indice, anecdote), puis demandé tout de suite.
2. **Consolidation dans la session**, comme sur Seterra : un élément raté **revient dans la manche** jusqu'à ce que je réussisse, avec un délai de quelques questions. La session n'est terminée que lorsque tout est réussi au moins une fois.
3. **Entretien à long terme** : répétition espacée sur plusieurs jours ou semaines.

### 5.2 Note automatique : je ne m'auto-évalue jamais
La difficulté est **déduite de mes performances**, quel que soit le mode :
- **justesse** : bonne ou mauvaise réponse ; pour Épingler, la distance en km par rapport à un seuil de tolérance qui dépend du type d'élément et de la taille du pays ;
- **temps de réponse**, comparé à **mon propre temps médian pour ce mode**, puisqu'un clic sur la carte ne prend pas le même temps qu'une saisie ;
- **utilisation de l'indice**.

Correspondance avec une note de type FSRS :
- faux, ou hors tolérance → **À revoir** ;
- juste, mais lent (> 2× ma médiane) ou avec indice → **Difficile** ;
- juste dans un temps normal → **Correct** ;
- juste et rapide (< 0,6× ma médiane) → **Facile**.

Ces seuils sont des **paramètres** réglables, pas des constantes enfouies dans le code.

⚠️ **Le temps de réponse est un signal bruité.** Il faut le traiter avec prudence :
- calculer la médiane **par appareil (PC / mobile) et par mode** ;
- **plafonner les temps aberrants** (interruption, distraction) : au-delà d'un seuil (ex. 3× la médiane ou 30 s), le temps ne compte plus et seule la justesse est prise en compte ;
- en mode Saisir, **corriger selon la longueur du nom**, puisque taper « Ouagadougou » prend plus de temps que taper « Lima » ;
- une réponse **juste mais lente n'est jamais notée « À revoir »**, au pire « Difficile ».

### 5.3 Algorithme
- Utiliser **FSRS** (bibliothèque `ts-fsrs`) plutôt que de réinventer un algorithme.
- **Une « carte mémoire » par couple élément × compétence.** Exemple : « Lyon — placer » et « Lyon — nommer » sont suivis séparément, tout comme « France — drapeau » et « France — capitale ».
- On enregistre chaque réponse (horodatage, mode, justesse, distance, temps, indice). L'historique sert aux stats et pourra servir à recalibrer.

### 5.4 Choix d'implémentation (étape 3)
- **FSRS-7** via `DefaultScheduler` de ts-fsrs 6, rétention visée 0,9, variation aléatoire des intervalles activée. Compétences V1 : `locate-country`, `name-country`, `locate-capital`, `name-capital`, `flag` ; clé de carte `<id>:<compétence>`.
- **Niveaux de maîtrise** selon la stabilité FSRS : « acquis » à partir de 7 jours, « maîtrisé » à partir de 30 jours.
- **Saisie** : accents, casse, ponctuation, « St »/« Ste », article ou « Îles » de tête facultatifs ; fautes tolérées selon la longueur (0 jusqu'à 4 lettres, puis 1, 2, 3). Si la saisie ressemble autant à une autre réponse connue (« Niger » pour « Nigeria »), c'est une confusion, donc fausse.
- **Épingler un point** : rayon accepté = 0,08 × √(superficie du pays), entre 20 et 250 km ; jusqu'à 2,5 × ce rayon, c'est « presque ».
- **Temps** : médiane par appareil × façon de répondre (clic, saisie, choix), sur les 60 dernières réponses justes sans indice ; la vitesse n'est jugée qu'à partir de 5 mesures. En saisie, temps divisé par (8 + longueur) / 16.
- **Consolidation** : un élément raté revient après 3 autres questions (ou tout de suite s'il est le dernier).

## 6. Choisir ce que je travaille

- Un **constructeur de session** combine les filtres :
  - **zone** : Monde, continent, sous-région, pays, France, États-Unis… ;
  - **catégorie** : pays, capitales, drapeaux, villes, départements, États, population ;
  - **mode** ;
  - **nombre d'éléments** (10, 20, 50, tout) ;
  - **type de contenu** : à réviser (dû), nouveaux, mélange, ou « mes points faibles ».
- La carte se **cadre et se zoome automatiquement** sur la zone choisie.
- Je peux **enregistrer des sessions favorites** (ex. « Villes d'Asie — Épingler — 20 »).

## 7. Accueil

À l'ouverture, l'app me dit **ce que je peux travailler**, sur un ton positif :
- « **Révisions du jour** : 34 éléments (≈ 6 min) » → un bouton lance la session ;
- « **À découvrir** : 5 nouvelles villes du Mexique » ;
- un **entretien rapide** : 10 pays, capitales et drapeaux tirés au hasard parmi les éléments dus ;
- un **défi du jour** : un petit quiz thématique ;
- un accès au constructeur de session.

## 8. Victoires et récompenses

⚠️ **Les récompenses doivent servir la pédagogie, pas la contredire.** Sinon je risque de collectionner des nouveautés sans les retenir.
- Les **révisions dues** sont ce qui rapporte **le plus** d'XP.
- Les **nouveautés** rapportent moins, et leur nombre quotidien est plafonné (réglable).
- Les badges et la carte de conquête récompensent la **maîtrise durable** (éléments « acquis » ou « maîtrisés »), pas le simple fait d'avoir vu un élément.

- **XP** à chaque bonne réponse, avec un bonus de rapidité et de précision.
- **Série de jours (streak)** bienveillante : des « jours de repos » sont accordés et la série ne s'affiche pas en négatif.
- **Niveaux de maîtrise** par élément (nouveau → en cours → acquis → maîtrisé) et par pays ou région.
- **Carte de conquête** : une carte du monde où chaque pays se colore selon mon niveau de maîtrise. C'est la récompense visuelle principale.
- **Badges** : par exemple « Toutes les capitales d'Afrique », « 101 départements », « Sans faute en Océanie », « Précision < 10 km »…
- **Fin de session** festive : score, précision moyenne, temps, éléments passés à « maîtrisé », animation légère.
- **Aucun message culpabilisant.** Une erreur est présentée comme une occasion de revoir l'élément (« On le revoit dans 3 questions »).

## 9. Indices et anecdotes

- Chaque élément peut avoir :
  - un **indice** : court, il aide sans donner la réponse ;
  - une **anecdote** : affichée après la réponse, pour ancrer le souvenir.
- Cela concerne les villes, mais aussi **les drapeaux** (signification des couleurs et symboles), **les capitales**, **les départements** (origine du nom) et **les États**.
- Le contenu est **généré par Claude pendant le développement** et stocké en JSON dans le dépôt. L'app n'appelle aucune IA : elle reste gratuite et fonctionne hors ligne.
- Chaque texte généré porte un champ `verifie: false` jusqu'à relecture. Il faut privilégier les faits sûrs et éviter les superlatifs douteux.
- Les indices de mon ancien deck sont repris : voir `data/sources/indices-anki.json`.

## 10. Données (open data, licences à respecter et créditer)

| Besoin | Source | Licence |
|---|---|---|
| Frontières des pays et territoires | Natural Earth v5.1.2 (admin 0 map units + zones disputées, 1:10m) | Domaine public |
| Liste, codes, régions, noms FR des pays | mledoze/countries | ODbL 1.0 |
| Capitales (noms FR, coordonnées), population de secours | Wikidata (requête SPARQL) | CC0 |
| Population | Banque mondiale (SP.POP.TOTL) | CC BY 4.0 |
| Drapeaux de Chypre du Nord et du Somaliland | Wikimedia Commons | Domaine public |
| Villes (coordonnées, population) | GeoNames `cities15000` | CC BY 4.0 |
| Drapeaux | `flag-icons` (SVG) | MIT |
| Départements français | `gregoiredavid/france-geojson` (version simplifiée) | Licence Ouverte |
| États américains | Natural Earth admin 1 ou us-atlas | Domaine public |

- Les données sont **pré-traitées par des scripts** (`scripts/`) puis enregistrées dans des fichiers JSON ou TopoJSON simplifiés (`data/`). L'app ne charge que des données prêtes à l'emploi.
- Une **page « Crédits »** liste les sources.
- Les territoires contestés restent **neutres et factuels**. On peut ajouter un champ `statut` (« territoire contesté », « reconnaissance limitée »…).

## 11. Choix techniques (confirmés le 18/11/2026)

- **Vite + TypeScript + Preact** (avec `@preact/signals` pour l'état partagé). Preact est léger (~4 Ko) et évite de réécrire un mini-framework pour les 5 à 6 écrans.
- **Carte** : d3-geo + rendu **SVG** (Canvas seulement si le mobile rame), avec zoom/déplacement (d3-zoom). Projection adaptée à la zone : Natural Earth pour le Monde (plus large que l'écran en portrait), azimutale équivalente centrée pour les continents et sous-régions ; plus tard Conic Conformal pour la France et Albers USA pour les États-Unis. Pas de zoom au double-clic (deux clics = deux réponses). Les réglages (seuil des cercles de repère, zoom max…) sont dans `MAP_SETTINGS`.
- **Données Monde** : `npm run data:download` (sources brutes dans `data/raw/`, ignoré par git) puis `npm run data:world`, qui produit `data/world/world.topo.json`, `data/world/countries.json`, `data/flags/` et le rapport de relecture `data/world/RAPPORT.md`. Les corrections manuelles vont dans `data/sources/overrides-monde.json`, jamais dans les fichiers générés.
- **Frontières Monde** : Natural Earth 1:10m « map units », simplifiées île par île avec mapshaper (8 % des points, `explode` + `keep-shapes` pour ne perdre aucune île). Frontières « de facto », sauf la Crimée (→ Ukraine) et le Sahara occidental (territoire entier), qui suivent les frontières reconnues par l'ONU. Identifiants : code ISO alpha-2 en minuscules, `cyn` (Chypre du Nord) et `sol` (Somaliland).
- **Déploiement** : GitHub Actions (`.github/workflows/deploy.yml`) construit et publie `dist/` à chaque push sur `main`. Le chemin de base vient de la variable `BASE_PATH` ; les URL de données passent par `assetUrl()` (`src/lib/assets.ts`).
- **Répétition espacée** : `ts-fsrs`.
- **Stockage** : IndexedDB (via `idb`).
- **PWA** : `vite-plugin-pwa`.
- **Tests** : Vitest, au minimum pour la notation automatique, le calcul de distance, la boucle de consolidation et la tolérance de saisie.
- Le code est commenté en français et les noms de variables sont en anglais.

## 12. Feuille de route

### V1 — jouable rapidement (priorité absolue)
- [ ] Données Monde : pays, territoires, capitales, drapeaux, population.
- [x] Carte Monde zoomable, PC et mobile.
- [ ] Modes : Épingler (pays, capitales), Saisir (pays, capitales), Drapeaux.
- [ ] Constructeur de session (zone, catégorie, mode, nombre).
- [ ] Boucle de consolidation façon Seterra.
- [ ] FSRS avec note automatique (justesse, distance, temps).
- [ ] Accueil « ce que je peux travailler ».
- [ ] PWA installable, export/import de la progression.

**Règle : une fois la V1 terminée, je l'utilise pendant au moins 2 semaines avant d'ajouter des fonctionnalités.**

#### Plan de réalisation de la V1 (validé le 18/11/2026)
- [x] **0. Socle** : Vite + Preact + TS, Vitest, workflow GitHub Pages. Dépôt : https://github.com/corinoarno-create/G-o — app en ligne : https://corinoarno-create.github.io/G-o/
- [x] **1. Données Monde** : 252 entités, frontières (568 Ko), capitales, population, drapeaux, contrôles et tests. *(Rapport `data/world/RAPPORT.md` à relire par Arno.)*
- [x] **2. Carte** : rendu Monde, zoom/pincer, cadrage auto, cercles des micro-États, surbrillance, clic. *(Moteur `src/map/world-map.ts`, zones `src/map/zones.ts` ; l'app ouvre pour l'instant un bac à sable, remplacé à l'étape 7.)*
- [x] **3. Moteur pédagogique** (pur, testé) : tolérance de saisie, distance, note automatique, boucle de consolidation, FSRS. *(`src/engine/`, réglages dans `src/engine/settings.ts` ; branché sur l'interface à l'étape 5.)*
- [x] **4. Stockage** : IndexedDB + export/import JSON versionné. *(`src/storage/` : base `geo` v1 avec cartes, journal des réponses, temps, réglages, favoris ; une réponse s'enregistre en une seule transaction. Fichier `geo-progression-AAAA-MM-JJ.json` versionné ; import par fusion (la carte révisée le plus récemment l'emporte, journaux réunis) ou remplacement. Boutons provisoires dans le bac à sable.)*
- [ ] **5. Modes** : Épingler, Saisir, Drapeaux + fin de session.
- [ ] **6. Constructeur de session** + favoris.
- [ ] **7. Accueil** (le défi du jour reste en V3).
- [ ] **8. PWA** hors ligne, installation Android, finitions tactiles, page Crédits.

#### Décisions prises
- **DROM** (Guyane, Réunion, Martinique, Guadeloupe, Mayotte) : entités **à part** en mode Monde, comme dans la norme ISO.
- **Épingler sur mobile** : on **touche puis on confirme**, pour éviter les erreurs de doigt. Sur PC, le clic est direct.
- **FSRS et consolidation** : seule la **première réponse** à un élément dans une session met à jour FSRS. Les nouvelles tentatives de la boucle sont enregistrées dans l'historique sans gonfler la mémoire.
- **Acquis du Monde** (pays, capitales, drapeaux) : pas de phase Découverte. Ils sont posés directement en question, et une réponse juste et rapide est notée « Facile ». Ils ne comptent **pas** dans le plafond quotidien de nouveautés.

### V2
- [ ] Villes : 3, 5 ou 10 par pays + phase de découverte.
- [ ] Mode Départements & États (numéros, chefs-lieux, capitales d'État).
- [ ] Indices et anecdotes.
- [ ] XP, série de jours, badges, carte de conquête.

### V3 et idées pour plus tard
- [ ] Mode Population.
- [ ] Géographie physique (fleuves, montagnes, mers).
- [ ] Défis du jour thématiques.
- [ ] Statistiques détaillées (courbes, points faibles, précision moyenne par continent).
- [ ] Synchronisation PC ↔ téléphone.
- [ ] *(Ajouter ici les nouvelles idées au fil de l'eau plutôt que de les coder tout de suite.)*

## 13. Méthode de travail avec Claude Code

- Avancer **par petites étapes testables**, une fonctionnalité à la fois, et cocher la feuille de route.
- Avant une grosse fonctionnalité, **proposer un plan court** et attendre ma validation.
- Garder ce fichier à jour quand une décision est prise.
