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
- **Synchronisation automatique** entre mes appareils via un compte Google (Firebase), et **export/import JSON** pour les sauvegardes.
- **À plusieurs** (décidé le 20/11/2026) : je peux envoyer l'app à un proche ; chacun a son compte et ses stats, et on peut se défier.

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
- **FSRS-7** via `DefaultScheduler` de ts-fsrs 6, rétention visée 0,9, variation aléatoire des intervalles activée. Compétences V1 : `locate-country`, `name-country`, `locate-capital`, `capital-country`, `name-capital`, `flag` ; clé de carte `<id>:<compétence>`.
- **Niveaux de maîtrise** selon la stabilité FSRS : « acquis » à partir de 7 jours, « maîtrisé » à partir de 30 jours.
- **Saisie** : accents, casse, ponctuation, « St »/« Ste », article ou « Îles » de tête facultatifs ; fautes tolérées selon la longueur (0 jusqu'à 4 lettres, puis 1, 2, 3). Si la saisie ressemble autant à une autre réponse connue, et lui ressemble vraiment (dans sa tolérance : « Niger » pour « Nigeria », mais pas « Lyon » pour « Lima »), c'est une confusion, donc fausse.
- **Épingler un point** : rayon accepté = 0,12 × √(superficie du pays), entre 60 et 300 km (assoupli le 19/11/2026) ; jusqu'à 2,5 × ce rayon, c'est « presque ». Une fois la question finie, un **pointillé se dessine** de mon clic jusqu'à la vraie position, avec l'écart en km.
- **Capitales, deux exercices** : « Capitale → pays » (je clique sur le pays : c'est l'appartenance qui compte) et « Placer la capitale » (au plus près, jugé à la distance).
- **Temps** : médiane par appareil × façon de répondre (clic, saisie, choix), sur les 60 dernières réponses justes sans indice ; la vitesse n'est jugée qu'à partir de 5 mesures. En saisie, temps divisé par (8 + longueur) / 16.
- **Consolidation** : un élément raté revient après 3 autres questions (ou tout de suite s'il est le dernier).

### 5.5 Choix d'implémentation (étape 5)
- **Messages** : toujours positifs ; les noms de pays sont cités **sans article** (« Tu as touché : Venezuela »), les données ne disant pas « le », « la » ou « l' ».
- **Sur téléphone**, le panneau de validation n'affiche jamais le nom du pays touché (« Ce pays ? ») : il donnerait la réponse.
- **Couleurs** : pays demandé en doré, sélection en bleu, **bonne réponse toujours en vert**, erreur en rouge (plus d'orange).
- **Plusieurs essais par question (retours d'Arno, 19/11/2026)** : une erreur ne donne pas la réponse ; on réessaie avec un indice qui se précise. Placer : la carte zoome sur la sous-région (« Cherche du côté de : Caraïbes »), puis sur l'élément et ses 4 plus proches voisins ; pour une capitale à placer, le 2e indice montre son pays. *(Le cercle d'indice a été abandonné le 19/11/2026 : il ne rendait pas les petites îles plus faciles à toucher.)* Saisir : 1re lettre, puis 2 premières. Drapeaux : le drapeau raté disparaît. Réponse dévoilée (en vert, avec « Continuer ») après 3 essais (2 pour les drapeaux) ou tout de suite avec « Je ne sais pas ». Seule la 1re réponse compte pour FSRS ; une question ratée au 1er essai revient plus tard dans la manche. Le bouton « Indice » monte d'un niveau et note la réponse « Difficile » au mieux.
- **Validation instantanée** : en saisie, la réponse est validée dès que le nom est exact (une saisie approchée attend Entrée) ; après une bonne réponse, on enchaîne aussitôt, un « ✓ » et le vert sur la carte s'effacent en 1,2 s.
- **Petits pays** : **clic tolérant** (un clic dans la mer à moins de 16 px, 24 px au doigt, d'un pays compte pour le plus proche) ; repères plus grands au doigt ; une fois zoomé, le cercle d'un micro-territoire devient un **petit rond blanc** qui reste affiché pour le repérer (demande d'Arno, 19/11/2026) ; loupe automatique (×4) quand un clic tombe à moins de 26 px de deux cercles de repère ou plus ; quand l'élément est montré (Nommer, Capitale de…, Pays → drapeau), la carte le cadre **selon son contexte** (19/11/2026) : l'élément entier, au moins 1 500 km autour, et ses 2 plus proches voisins s'ils sont à moins de 2 500 km (`showFrame`, réglages `SHOW_FRAME`) ; seul son cercle de repère reste affiché (les autres le noieraient) ; ce cadrage survit au redimensionnement (clavier qui s'ouvre).
- **Choix des éléments** (en attendant le constructeur) : révisions dues d'abord, puis nouveautés, puis les autres, ordre mélangé.
- La carte est cadrée dans l'espace libre entre la question et le panneau de réponse (`WorldMap.setInsets`).
- **Clavier ouvert sur téléphone** (retour d'Arno, 19/11/2026) : l'app rétrécit au-dessus du clavier (`interactive-widget=resizes-content` dans `index.html`) au lieu de défiler ; sous 520 px de haut, mise en page compacte (en-tête, question et panneau resserrés, boutons de zoom masqués au doigt) ; les marges de cadrage se réduisent avec l'espace libre.

## 6. Choisir ce que je travaille : la fiche d'une région

*(Refonte décidée avec Arno le 20/11/2026, maquette : https://claude.ai/artifact/8Ztubwty76T4Xey2DmbzyD)*
- On choisit ce qu'on joue **en passant par sa progression** : une case du carnet (Europe, Amérique, Afrique, Asie, Océanie, **Monde**) ouvre la **fiche de la région** (`src/home/ZoneSheet.tsx`). Toucher un pays sur la carte du carnet ouvre aussi son continent.
- La fiche montre la carte de la région colorée selon la maîtrise (téléphone), des **pastilles de sous-régions** (continents seulement ; le Monde couvre tout), et **ma progression** par compétence : part acquise, révisions dues, éléments jamais vus (`src/home/zone-stats.ts`).
- Puis : catégorie (pays, capitales, drapeaux), exercice, et deux onglets :
  - **Jouer** : nombre de questions (10, 20, 50, tout) et contenu (mélange, à réviser, nouveaux, points faibles) — l'ancien constructeur, ciblé sur la zone ;
  - **Découvrir** : la découverte en 3 temps, sur 5 éléments jamais vus de l'exercice choisi.
- **Les derniers choix de chaque région sont retenus** (réglage `zoneChoices`) ; il n'y a plus de favoris. Après une manche, l'accueil rouvre la fiche d'où elle est partie.
- Sur **PC**, la fiche s'ouvre à côté du carnet (le Monde par défaut) ; sur **téléphone**, en page entière avec un bouton « Carnet ».
- La carte se **cadre et se zoome automatiquement** sur la zone choisie.

## 7. Accueil

Deux portes, sur un ton positif, sans vocabulaire de voyage (« escales », « itinéraires ») :
- **Révision** : l'app choisit ce que je dois revoir aujourd'hui (FSRS) : nombre d'éléments, durée estimée, détail par exercice, bouton « Réviser ». La manche est regroupée par exercice (séries de 50 au plus). Rien de dû : « Tout est à jour », avec la date de la prochaine révision.
- **Mon carnet de voyage** : la carte de conquête et les 6 cases de régions (voir § 6). C'est le jeu principal.
- L'**entretien rapide**, la carte « À découvrir » et « Mes itinéraires » ont disparu (20/11/2026) : la progression de chaque région dit ce qu'il faut entretenir ou découvrir.
- Plus tard : un **défi du jour** (petit quiz thématique).
- Sur téléphone, 3 onglets : Carnet, Explorer, Progression.

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
- **Carte** : d3-geo + rendu **SVG** (Canvas seulement si le mobile rame), avec zoom/déplacement (d3-zoom). Projection adaptée à la zone : **Patterson rectangulaire** pour le Monde, recadrée de 57° S à 84° N (l'Antarctique reste accessible en faisant défiler ; plus large que l'écran en portrait ; choisie le 19/11/2026 pour ne plus avoir de bords courbes), azimutale équivalente centrée pour les continents et sous-régions ; plus tard Conic Conformal pour la France et Albers USA pour les États-Unis. Pas de zoom au double-clic (deux clics = deux réponses). **Zoom au rectangle (PC, idée d'Arno, 19/11/2026)** : maintenir Ctrl ou Espace au-dessus de la carte affiche un rectangle (1/10 de l'espace libre, ≈ la moitié de l'Europe en vue Monde) qui suit la souris ; on relâche (ou on clique) pour le cadrer ; la molette change sa taille (retenue pendant la visite) ; Échap, une autre touche ou la sortie de la souris annulent ; Espace est ignoré pendant une saisie (`src/map/frame-zoom.ts`). **Retour express à la vue d'ensemble** : Échap ou clic droit (350 ms). Les réglages (seuil des cercles de repère, zoom max…) sont dans `MAP_SETTINGS`. **Fluidité sur téléphone (19/11/2026)** : les tracés (≈ 1,8 Mo) sont calculés une fois par zone (un changement de taille ou de marges ne fait qu'ajuster une transformation) ; pendant un geste ou un cadrage animé, on déplace l'image déjà dessinée (transformation CSS) et la carte n'est redessinée qu'à la fin du mouvement ; repères, points, pointillés et étiquettes sont dans un second SVG léger posé par-dessus ; pas de transition de couleur sur les pays ; côtes, frontières, quadrillage et îles lointaines d'un même territoire sont **découpés en cases de 10°** (`src/map/chunks.ts`), pour qu'au zoom fort seul ce qui est près de l'écran soit redessiné.
- **Données Monde** : `npm run data:download` (sources brutes dans `data/raw/`, ignoré par git) puis `npm run data:world`, qui produit `data/world/world.topo.json`, `data/world/countries.json`, `data/flags/` et le rapport de relecture `data/world/RAPPORT.md`. Les corrections manuelles vont dans `data/sources/overrides-monde.json`, jamais dans les fichiers générés.
- **Frontières Monde** : Natural Earth 1:10m « map units », simplifiées île par île avec mapshaper (8 % des points, `explode` + `keep-shapes` pour ne perdre aucune île). Frontières « de facto », sauf la Crimée (→ Ukraine) et le Sahara occidental (territoire entier), qui suivent les frontières reconnues par l'ONU. Identifiants : code ISO alpha-2 en minuscules, `cyn` (Chypre du Nord) et `sol` (Somaliland).
- **Déploiement** : GitHub Actions (`.github/workflows/deploy.yml`) construit et publie `dist/` à chaque push sur `main`. Le chemin de base vient de la variable `BASE_PATH` ; les URL de données passent par `assetUrl()` (`src/lib/assets.ts`).
- **Répétition espacée** : `ts-fsrs`.
- **Comptes et synchronisation (20/11/2026)** : **Firebase**, formule gratuite Spark (choisi plutôt qu'un Gist GitHub, qui obligerait un proche à créer un compte GitHub et un jeton, et plutôt que Supabase, dont les projets gratuits se mettent en pause après 7 jours sans activité). Connexion **Google** en fenêtre surgissante (`src/sync/firebase.ts`, chargé à la demande) ; **Firestore « lite »** (sans cache ni écoute en direct). La base locale reste la référence : l'app marche sans compte et hors ligne. Identifiants du projet dans `src/sync/firebase-config.ts` (publics par nature) ; règles de sécurité dans `firestore.rules` ; guide de création du projet dans `docs/SYNCHRO.md`.
  - **Rangement en ligne** : `users/{uid}/core/state` (réglages, temps de référence, remises à zéro) et `cards-00` à `cards-15` (cartes mémoire, réparties par hachage de la clé), réunis et réécrits dans une transaction ; `users/{uid}/batches/…` : lots de réponses, ajoutés et jamais réécrits, relus seulement depuis la dernière lecture. Tout est stocké en texte JSON.
  - **Fusion** (`src/storage/merge.ts`, commune à l'import JSON) : carte la plus récemment révisée ; journaux réunis sans doublon ; réglages et temps : dernière modification (champ `updatedAt`) ; **remises à zéro réunies**, qui effacent partout ce qui date d'avant elles (base locale v2, magasin `resets`). Une réponse envoyée ou reçue porte `pushed`.
  - **Quand** : démarrage, retour au premier plan (au plus toutes les 30 s), passage en arrière-plan, retour du réseau, fin ou abandon d'une manche, remise à zéro ; bouton « Synchroniser ». Jamais pendant une question.
  - **Appareil partagé** : la base locale retient son propriétaire ; si un autre compte se connecte, on demande avant de remplacer le carnet. Le prénom de l'accueil vient du compte Google.
- **Stockage** : IndexedDB (via `idb`).
- **PWA** : `vite-plugin-pwa`.
- **Tests** : Vitest, au minimum pour la notation automatique, le calcul de distance, la boucle de consolidation et la tolérance de saisie.
- Le code est commenté en français et les noms de variables sont en anglais.
- **Direction artistique « Carnet d'explorateur »** (validée le 19/11/2026) : papier beige à grain, encre sépia (`--ink`), océan bleu-vert délavé, pays à l'aquarelle par continent (`--wc-*`), titres manuscrits **Caveat** et texte **Nunito**, embarqués via `@fontsource` (hors ligne). Boutons « à l'encre » (`.btn`, `.btn--terracotta|teal|gold`, `.btn-ghost`), feuilles de carnet (`.paper-card`, `.tape`), tout dans `src/styles.css`. L'app reste en clair (pas de mode sombre). Icônes à la plume dans `src/ui/icons.tsx`, jamais d'émoji dans l'interface.

## 12. Feuille de route

### V1 — jouable rapidement (priorité absolue)
- [x] Données Monde : pays, territoires, capitales, drapeaux, population.
- [x] Carte Monde zoomable, PC et mobile.
- [x] Modes : Épingler (pays, capitales), Saisir (pays, capitales), Drapeaux.
- [x] Constructeur de session (zone, catégorie, mode, nombre).
- [x] Boucle de consolidation façon Seterra.
- [x] FSRS avec note automatique (justesse, distance, temps).
- [x] Accueil « ce que je peux travailler ».
- [x] PWA installable, export/import de la progression.

**Règle : une fois la V1 terminée, je l'utilise pendant au moins 2 semaines avant d'ajouter des fonctionnalités.**

#### Plan de réalisation de la V1 (validé le 18/11/2026)
- [x] **0. Socle** : Vite + Preact + TS, Vitest, workflow GitHub Pages. Dépôt : https://github.com/corinoarno-create/G-o — app en ligne : https://corinoarno-create.github.io/G-o/
- [x] **1. Données Monde** : 252 entités, frontières (568 Ko), capitales, population, drapeaux, contrôles et tests. *(Rapport `data/world/RAPPORT.md` à relire par Arno.)*
- [x] **2. Carte** : rendu Monde, zoom/pincer, cadrage auto, cercles des micro-États, surbrillance, clic. *(Moteur `src/map/world-map.ts`, zones `src/map/zones.ts` ; l'app ouvre pour l'instant un bac à sable, remplacé à l'étape 7.)*
- [x] **3. Moteur pédagogique** (pur, testé) : tolérance de saisie, distance, note automatique, boucle de consolidation, FSRS. *(`src/engine/`, réglages dans `src/engine/settings.ts` ; branché sur l'interface à l'étape 5.)*
- [x] **4. Stockage** : IndexedDB + export/import JSON versionné. *(`src/storage/` : base `geo` v1 avec cartes, journal des réponses, temps, réglages, favoris ; une réponse s'enregistre en une seule transaction. Fichier `geo-progression-AAAA-MM-JJ.json` versionné ; import par fusion (la carte révisée le plus récemment l'emporte, journaux réunis) ou remplacement. Boutons provisoires dans le bac à sable.)*
- [x] **5. Modes** : Épingler, Saisir, Drapeaux + fin de session. *(`src/game/` : 6 exercices — placer pays / capitales, nommer pays, donner capitales, drapeau → pays, pays → drapeau parmi 4 voisins ; indice générique et « Je ne sais pas » ; lanceur provisoire « Jouer » dans le bac à sable.)*
- [x] **6. Constructeur de session** + favoris. *(`src/builder/` : zone (Monde, continent, sous-région), catégorie (pays, capitales, drapeaux), mode, contenu (mélange, à réviser, nouveaux, points faibles) avec compteurs, nombre ; favoris nommés ; derniers réglages retenus. Pas de plafond de nouveautés pour les pays du Monde, déjà connus.)*
- [x] **7. Accueil** (le défi du jour reste en V3). *(`src/home/` : révisions du jour (durée estimée d'après mes temps, séries de 50), entretien rapide (10 questions mêlées), 2 suggestions de découverte dans des sous-régions différentes, composer une manche et favoris, progression, sauvegarde. Les manches peuvent mélanger les exercices : une question = un élément × un exercice, `src/game/questions.ts`.)*
- [x] **Lot A (retours du 19/11)** : essais multiples et indices progressifs, validation instantanée, bonne réponse en vert, loupe sur les petits pays, zoom sur l'élément montré.
- [x] **Lot B** : refonte « Carnet d'explorateur » (papier, aquarelle, titres manuscrits, tampon « Validé ! », accueil carnet de voyage avec carte colorée selon la maîtrise). *(Maquette validée : https://claude.ai/artifact/Eq39rDQAf1hBe498adcFCs)*
- [x] **Lot A2 (retours du 19/11, après la refonte)** :
  - [x] Carte Monde rectangulaire (Patterson recadrée).
  - [x] Petits pays : zoom progressif en guise d'indice (plus de cercle), clic tolérant dans la mer, repères plus grands au doigt.
  - [x] Capitales : « Capitale → pays » et « Placer la capitale » séparés ; tolérance assouplie ; pointillé animé jusqu'à la vraie position.
  - [x] Un exercice à la fois : entretien rapide sur un seul exercice, révisions regroupées par exercice.
  - [x] Découverte en 3 temps par groupes de 5 (`src/discovery/`) : **Observer** (la carte montre chaque élément, son nom reste écrit), **Reconnaître** (QCM à 4 propositions, prises d'abord dans le groupe ; une erreur fait revenir l'élément), **Retrouver** (la vraie manche). Seule la dernière étape compte pour FSRS. Lancée **uniquement** par l'onglet « Découvrir » d'une fiche de région (au départ par la carte « À découvrir », remplacée le 20/11/2026) ; en fin de manche, « Découvrir 5 de plus ». L'onglet « Jouer » reste le jeu normal, même avec le contenu « Nouveaux » (décision d'Arno, 19/11/2026).
- [x] **Lot C** : page « Ma progression » (`src/progress/`, onglet « Progression » sur téléphone, bouton sur PC) : chiffres clés, activité des 30 derniers jours (premières réponses justes / à revoir), révisions prévues sur 7 jours, maîtrise par compétence et par continent, temps médian par semaine et par façon de répondre, écart médian des capitales placées, 10 points faibles avec « Travailler ces points faibles ». Graphiques SVG faits main, couleurs validées pour le daltonisme (bleu-vert `#008f86`, terracotta `#c8623b`, bleu `#2f6db5`), infobulles au survol. **Repartir de zéro** (demande d'Arno, 19/11/2026) : effacer toute la progression, ou une zone (continent ou sous-région) pour une catégorie (pays, capitales, drapeaux ou tout) ; cartes mémoire et historique de la zone effacés (les éléments redeviennent « nouveaux »), temps de référence effacés seulement pour un effacement complet ; réglages et favoris gardés ; confirmation avec le nombre d'éléments et proposition d'exporter d'abord.
- [x] **8. PWA** hors ligne, installation Android, finitions tactiles, page Crédits. *(`vite-plugin-pwa` 2 : manifeste (icônes boussole sur papier dans `public/icons/`, dont une « maskable »), service worker Workbox qui met tout en cache (app, carte, données, drapeaux, polices woff2 : 273 fichiers, 2,9 Mo). Mises à jour en mode « prompt » : bandeau « Mettre à jour » affiché seulement hors des manches (`src/pwa/`). Bouton « Installer l'app » dans le pied de l'accueil quand le navigateur le propose. Page Crédits (`src/credits/`), liée depuis l'accueil. Finitions tactiles : pas de flash au toucher, pas d'attente du double-tap, pas de rebond ni de menu d'appui long sur la carte.)*

**V1 terminée le 19/11/2026 : place aux 2 semaines d'utilisation (jusqu'au 03/12/2026). Les nouvelles idées vont dans la feuille de route, sans être codées.**

**Règle levée le 20/11/2026 (décision d'Arno)** : le développement reprend, en commençant par la synchronisation PC ↔ téléphone, devenue le besoin n° 1 à l'usage.

#### Retouches pendant l'utilisation (demandées par Arno)
- [x] Carte fluide sur téléphone, zoom au rectangle et retour express sur PC, cadrage selon le contexte, clavier ouvert (19/11/2026).
- [x] **Nouvel accueil** (20/11/2026) : Révision + Mon carnet de voyage, fiche de région (progression, Jouer, Découvrir) ; fin de l'entretien rapide, de « À découvrir » et des favoris.

#### Décisions prises
- **DROM** (Guyane, Réunion, Martinique, Guadeloupe, Mayotte) : entités **à part** en mode Monde, comme dans la norme ISO.
- **Épingler sur mobile** : on **touche puis on confirme**, pour éviter les erreurs de doigt. Sur PC, le clic est direct.
- **FSRS et consolidation** : seule la **première réponse** à un élément dans une session met à jour FSRS. Les nouvelles tentatives de la boucle sont enregistrées dans l'historique sans gonfler la mémoire.
- **Acquis du Monde** (pays, capitales, drapeaux) : ils ne comptent **pas** dans le plafond quotidien de nouveautés, et une réponse juste et rapide est notée « Facile ». Dans les manches « Mélange », ils sont posés directement en question ; la **découverte en 3 temps** ne se lance que depuis l'onglet « Découvrir » d'une fiche de région.

### V2
- [x] **1. Comptes et synchronisation automatique** (20/11/2026) : `src/sync/`, encart « Mes appareils » au pied de l'accueil ; projet Firebase `geography-7915c` (Firestore à Paris) ; essai réel PC ↔ téléphone réussi le 21/11/2026.
- [ ] **2. Défis entre amis** (l'ancien « Mode Battle », plan validé le 21/11/2026) : code prêt et testé (`src/challenge/`) ; **reste : publier les nouvelles règles `firestore.rules` dans la console, essai réel à deux.**
  - **Lancer** : « Défier quelqu'un sur N … » dans la fiche d'une région (série tirée au hasard dans toute la zone, pas selon ma mémoire), ou « Défier quelqu'un sur cette série » en fin de manche (un seul exercice). Je joue d'abord ; le défi est enregistré en ligne à la fin, avec mon résultat (`challenges/{id}`).
  - **Envoyer** : un lien `…/G-o/?defi=<id>` (partage du téléphone, sinon copie), ou directement à un ami. Les **amis** sont les personnes croisées dans mes défis (pas de liste à part).
  - **Relever** : même série, même ordre, mêmes propositions de drapeaux (tirage reproductible) ; connexion Google demandée une seule fois par appareil. Les scores des autres ne se voient qu'après avoir joué. Un défi **compte pour la mémoire** comme une manche normale.
  - **Score** (`src/challenge/scoring.ts`, demande d'Arno) : 100 points par bonne réponse du premier coup + bonus de rapidité de 0 à 50 (plein sous 2 s, nul à 12 s au clic, 10 s pour un choix, 15 s en saisie) ; avec un indice, 50 points sans bonus ; à égalité, le temps total départage. Écart médian en km affiché pour les capitales placées.
  - **Pages** : page d'un défi (invitation, classement, détail question par question, « Revanche », envoi) ; « Mes défis » (à relever, résultats, en attente, mes amis avec le bilan des face-à-face et « Défier ») ; pastille de nouveautés sur l'accueil (onglet « Défis » sur téléphone). Un score qui n'a pas pu partir est gardé et renvoyé au retour du réseau.
- [ ] **3. Ensemble** : voir le carnet de l'autre, petit classement à deux.
- [ ] Villes : 3, 5 ou 10 par pays + phase de découverte.
- [ ] Mode Départements & États (numéros, chefs-lieux, capitales d'État).
- [ ] Indices et anecdotes.
- [ ] XP, série de jours, badges, carte de conquête.

### V3 et idées pour plus tard
- [ ] Mode Population.
- [ ] Géographie physique (fleuves, montagnes, mers).
- [ ] Défis du jour thématiques.
- [ ] Statistiques détaillées (courbes, points faibles, précision moyenne par continent).
- [ ] *(Ajouter ici les nouvelles idées au fil de l'eau plutôt que de les coder tout de suite.)*

## 13. Méthode de travail avec Claude Code

- Avancer **par petites étapes testables**, une fonctionnalité à la fois, et cocher la feuille de route.
- Avant une grosse fonctionnalité, **proposer un plan court** et attendre ma validation.
- Garder ce fichier à jour quand une décision est prise.
