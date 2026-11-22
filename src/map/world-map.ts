// Moteur de carte : rendu SVG avec d3-geo, zoom et déplacement avec d3-zoom (molette, glisser, pincer).
//
// Principe (pensé pour rester fluide sur téléphone : la carte pèse près de 2 Mo de tracés) :
// - les tracés sont calculés une seule fois par zone ; un changement de taille d'écran ou de marges ne fait
//   qu'ajuster une transformation (`layout`), sans recalculer ni redessiner les tracés ;
// - pendant un geste ou une animation de cadrage, on déplace l'image déjà dessinée de la carte (transformation
//   CSS, faite par la carte graphique) ; la carte n'est redessinée nettement qu'une fois le mouvement terminé ;
// - tout ce qui bouge ou s'anime (cercles de repère, points, pointillés, étiquettes) est dans un second SVG
//   posé par-dessus, léger, pour que ses animations ne forcent jamais à redessiner les pays.
// Les bordures gardent la même épaisseur à l'écran (vector-effect).
import { geoAzimuthalEqualArea, geoBounds, geoCircle, geoGraticule10, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import { pointer, select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { Landmarks } from '../data/landmarks.ts';
import type { WorldData } from '../data/world.ts';
import { distanceKm, distanceToShapeKm } from '../engine/geo.ts';
import { chunkLines, chunkPolygons } from './chunks.ts';
import { FrameZoom, type ScreenRect } from './frame-zoom.ts';
import { geoPatterson, WORLD_CROP_POINTS, WORLD_RATIO } from './patterson.ts';
import { fitTransform, needsMarker, relativeAffine, unionBounds, type Affine, type Bounds } from './view-math.ts';
import { boxCenter, boxSamplePoints, type Zone } from './zones.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Écran tactile (doigt) : repères plus grands et clic plus tolérant. */
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Réglages de la carte (en pixels d'écran). */
export const MAP_SETTINGS = {
  /** Marge autour de la zone cadrée. */
  padding: 16,
  /** Zoom maximal par rapport au cadrage de la zone. */
  maxZoom: 60,
  /** Sous cette surface à l'écran (px²), une entité reçoit un cercle de repère. */
  markerAreaThreshold: 45,
  /** Rayon visible du cercle de repère. */
  markerRadius: COARSE ? 6 : 5,
  /** Rayon cliquable autour du cercle (plus large, pour le doigt). */
  markerHitRadius: COARSE ? 20 : 14,
  /**
   * Une fois zoomé, le micro-territoire est assez grand pour être touché, mais on garde un petit rond
   * pour le repérer dans l'espace (îles des Caraïbes, du Pacifique…).
   */
  smallMarkerRadius: COARSE ? 3.5 : 3,
  smallMarkerHitRadius: COARSE ? 12 : 8,
  /**
   * Clic tolérant : un clic dans la mer à moins de tant de pixels d'un pays compte comme un clic sur ce pays
   * (le plus proche). Les petites îles deviennent touchables sans viser au pixel près.
   */
  snapRadius: COARSE ? 24 : 16,
  /** Distance (px) au-delà de laquelle un appui devient un glisser, et non un clic. */
  clickDistance: 5,
  /** Durée des animations de cadrage (ms). */
  flyDuration: 750,
  /** Retour express à la vue d'ensemble (Échap, clic droit) : court, pour enchaîner vite. */
  quickResetDuration: 350,
  /** Délai (ms) après la fin d'un mouvement avant de redessiner la carte nettement. */
  settleDelay: 120,
  /**
   * Loupe : si un clic tombe près d'au moins deux cercles de repère (Caraïbes, Pacifique…),
   * la carte zoome autour du clic au lieu de répondre, pour qu'on choisisse précisément.
   */
  magnifyRadius: 26,
  magnifyFactor: 4,
  /**
   * Repères (placer capitales et villes) : affluents et limites intérieures n'apparaissent qu'à l'échelle d'un
   * pays (≈ la France entière à l'écran), quand on zoome pour affiner son clic. Avant, seuls les grands fleuves
   * sont dessinés : plus tôt, le détail faisait brouillon (retours d'Arno, 22/11/2026).
   */
  landmarkDetailKmPerPx: 1.8,
};

const EARTH_RADIUS_KM = 6371;

const KM_PER_DEGREE = 111.195;

/** Tracés découpés en morceaux compacts (voir chunks.ts), calculés une fois par jeu de données. */
interface ChunkedWorld {
  graticule: MultiLineString[];
  coastlines: MultiLineString[];
  borders: MultiLineString[];
  shapes: Map<string, Array<Polygon | MultiPolygon>>;
}

const chunkCache = new WeakMap<WorldData, ChunkedWorld>();

interface ChunkedLandmarks {
  riversMajor: MultiLineString[];
  riversMinor: MultiLineString[];
  lakes: Array<Polygon | MultiPolygon>;
  admin1: MultiLineString[];
}

const landmarkCache = new WeakMap<Landmarks, ChunkedLandmarks>();

function chunkedLandmarks(landmarks: Landmarks): ChunkedLandmarks {
  let chunked = landmarkCache.get(landmarks);
  if (!chunked) {
    chunked = {
      riversMajor: chunkLines(landmarks.riversMajor),
      riversMinor: chunkLines(landmarks.riversMinor),
      lakes: landmarks.lakes.flatMap((lake) => chunkPolygons(lake)),
      admin1: chunkLines(landmarks.admin1),
    };
    landmarkCache.set(landmarks, chunked);
  }
  return chunked;
}

function chunkedWorld(world: WorldData): ChunkedWorld {
  let chunked = chunkCache.get(world);
  if (!chunked) {
    chunked = {
      graticule: chunkLines(geoGraticule10()),
      coastlines: chunkLines(world.coastlines),
      borders: chunkLines(world.borders),
      shapes: new Map([...world.shapes].map(([id, shape]) => [id, chunkPolygons(shape.geometry)])),
    };
    chunkCache.set(world, chunked);
  }
  return chunked;
}

/** Trait en pointillé entre deux points (mon clic → la vraie position), qui se dessine à l'apparition. */
export interface MapLine {
  from: [number, number];
  to: [number, number];
  /** Texte affiché au milieu (« 82 km »). */
  label?: string;
}

export type HighlightKind = 'selected' | 'target' | 'correct' | 'wrong';

/** Repère ponctuel sur la carte : point cliqué, bonne position d'une capitale… */
export interface MapPin {
  lonLat: [number, number];
  /** anchor : point d'ancrage pour se repérer (une capitale voisine), petit et discret. */
  kind: 'selected' | 'correct' | 'wrong' | 'target' | 'anchor';
}

/** Étiquette posée sur la carte (nom d'un élément qu'on découvre), taille constante à l'écran. */
export interface MapLabel {
  lonLat: [number, number];
  text: string;
  /** current : l'élément qu'on regarde ; seen : déjà vu (plus discret) ; anchor : nom d'un point d'ancrage. */
  kind: 'current' | 'seen' | 'anchor';
}

export interface MapPick {
  /** Entité cliquée (forme ou cercle de repère), ou null pour un clic sur la mer ou une zone neutre. */
  entityId: string | null;
  /** Point cliqué [longitude, latitude] : sert à mesurer la distance en mode Épingler. */
  lonLat: [number, number] | null;
}

/** Marges (px) occupées par des éléments posés sur la carte (question en haut, réponse en bas, panneau à gauche). */
export interface MapInsets {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

/** Remplissage imposé d'une entité (aquarelle plus ou moins dense). */
export interface MapFill {
  color: string;
  opacity: number;
}

export interface WorldMapOptions {
  onPick?: (pick: MapPick) => void;
  /** Active la loupe sur les groupes de petits pays et le clic tolérant (en jeu). */
  magnify?: boolean;
  /** Carte non interactive (illustration) : ni zoom, ni clic. */
  interactive?: boolean;
  /** Carte fixe mais cliquable (carnet de l'accueil) : un clic choisit un pays, sans zoom ni cercles de repère. */
  clickOnly?: boolean;
}

export class WorldMap {
  readonly element: HTMLDivElement;
  private readonly svg: Selection<HTMLDivElement, unknown, null, undefined>;
  /** SVG des pays (lourd) : déplacé tel quel pendant les gestes, redessiné à la fin. */
  private readonly baseSvg: SVGSVGElement;
  /** SVG léger posé par-dessus : repères, points, pointillés, étiquettes. */
  private readonly overlaySvg: SVGSVGElement;
  private readonly viewport: SVGGElement;
  private readonly markerLayer: SVGGElement;
  private readonly pinLayer: SVGGElement;
  private readonly zoomBehavior: ZoomBehavior<HTMLDivElement, unknown>;
  private readonly resizeObserver: ResizeObserver;
  private projection: GeoProjection = geoPatterson();
  private path: GeoPath = geoPath(this.projection);
  private transform: ZoomTransform = zoomIdentity;
  /** Zoom avec lequel les pays sont réellement dessinés (le reste de l'écart est une transformation CSS). */
  private committed: ZoomTransform = zoomIdentity;
  private settleTimer = 0;
  /** Passage des tracés (calculés pour une certaine projection) à la projection actuelle de l'écran. */
  private layout: Affine = { k: 1, x: 0, y: 0 };
  /** Zone et échelle pour lesquelles les tracés ont été calculés. */
  private geometryKey: string | null = null;
  private geometryScale = 1;
  private geometryTranslate: [number, number] = [0, 0];
  /** Surface (px², à l'échelle des tracés) de chaque entité. */
  private readonly geometryAreas = new Map<string, number>();
  private width = 0;
  private height = 0;
  private zone: Zone | null = null;
  private insets: Required<MapInsets> = { top: 0, bottom: 0, left: 0, right: 0 };
  /** Tracés de chaque entité (plusieurs quand ses îles sont éloignées, voir chunks.ts). */
  private readonly shapes = new Map<string, SVGPathElement[]>();
  private readonly markers = new Map<string, { element: SVGGElement; area: number; anchor: [number, number]; small: boolean }>();
  private highlights = new Map<string, HighlightKind>();
  /** Couleurs imposées par entité (carte de conquête : couleur selon la maîtrise). */
  private fills = new Map<string, MapFill>();
  private pins: Array<{ pin: MapPin; element: SVGGElement; base: [number, number] | null }> = [];
  private lines: Array<{ line: MapLine; element: SVGGElement }> = [];
  private labels: Array<{ label: MapLabel; element: SVGTextElement; base: [number, number] | null }> = [];
  private readonly labelLayer: SVGGElement;
  private lineCount = 0;
  /** Emprise (lon/lat) de chaque entité, pour ne mesurer la distance qu'aux pays proches d'un clic. */
  private geoBoxes: Map<string, [[number, number], [number, number]]> | null = null;
  private resizeFrame = 0;
  private frameZoom: FrameZoom | null = null;
  /** Dernier cadrage demandé (flyTo) : réappliqué si la carte change de taille, au lieu de revenir à la zone. */
  private lastFrame: { ids: string[]; points: [number, number][]; minKm: number } | null = null;
  /** Seuls ces cercles de repère sont affichés (null : tous). */
  private markerFilter: Set<string> | null = null;
  /** Repères (fleuves, lacs, limites intérieures), dessinés dans leur propre groupe sous les côtes. */
  private landmarks: Landmarks | null = null;
  private landmarksVisible = false;
  private landmarkGroup: SVGGElement | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly world: WorldData,
    private readonly options: WorldMapOptions = {},
  ) {
    this.element = document.createElement('div');
    this.element.className = 'world-map';
    this.element.setAttribute('role', 'img');
    this.element.setAttribute('aria-label', 'Carte du monde');
    this.baseSvg = this.element.appendChild(document.createElementNS(SVG_NS, 'svg'));
    this.baseSvg.setAttribute('class', 'map-base');
    this.viewport = this.baseSvg.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.overlaySvg = this.element.appendChild(document.createElementNS(SVG_NS, 'svg'));
    this.overlaySvg.setAttribute('class', 'map-overlay');
    this.markerLayer = this.overlaySvg.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.markerLayer.setAttribute('class', 'map-markers');
    this.pinLayer = this.overlaySvg.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.pinLayer.setAttribute('class', 'map-pins');
    this.labelLayer = this.overlaySvg.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.labelLayer.setAttribute('class', 'map-labels');
    container.appendChild(this.element);

    this.svg = select(this.element);
    this.zoomBehavior = zoom<HTMLDivElement, unknown>()
      .clickDistance(MAP_SETTINGS.clickDistance)
      .tapDistance(MAP_SETTINGS.clickDistance * 2)
      .on('start', () => clearTimeout(this.settleTimer))
      .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        this.transform = event.transform;
        this.moveBaseImage();
        this.updateMarkers();
        this.updatePins();
        this.updateLines();
        this.updateLabels();
      })
      .on('end', () => {
        // Le mouvement est fini : on redessine nettement, sauf si un autre geste suit aussitôt.
        clearTimeout(this.settleTimer);
        this.settleTimer = window.setTimeout(() => this.commitTransform(), MAP_SETTINGS.settleDelay);
      });
    // Pas de zoom au double-clic : en jeu, deux clics rapides doivent rester deux réponses possibles.
    if (options.interactive === false) {
      this.element.classList.add('is-static');
    } else if (options.clickOnly) {
      this.element.classList.add('is-click-only');
      this.svg.on('click', (event: MouseEvent) => this.handleClick(event));
    } else {
      this.svg.call(this.zoomBehavior).on('dblclick.zoom', null);
      this.svg.on('click', (event: MouseEvent) => this.handleClick(event));
      // Un appui long sur la carte (téléphone) ne doit pas ouvrir de menu.
      // Sur PC, le clic droit ramène à la vue d'ensemble (rapide, comme Échap).
      this.svg.on('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        if (!COARSE) this.resetView(MAP_SETTINGS.quickResetDuration);
      });
      // PC : Ctrl ou Espace maintenu au-dessus de la carte montre un rectangle à cadrer.
      this.frameZoom = new FrameZoom(
        this.element,
        () => ({
          left: this.insets.left,
          top: this.insets.top,
          width: Math.max(this.width - this.insets.left - this.insets.right, 80),
          height: Math.max(this.height - this.insets.top - this.insets.bottom, 80),
        }),
        (rect) => this.zoomToScreenRect(rect),
        () => this.resetView(MAP_SETTINGS.quickResetDuration),
      );
    }

    // Le navigateur prévient aussi au premier affichage : on ne redessine (et ne recadre) que si la taille
    // a vraiment changé, sinon un zoom lancé juste après l'ouverture serait annulé.
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        const { width, height } = this.container.getBoundingClientRect();
        if (Math.abs(width - this.width) >= 1 || Math.abs(height - this.height) >= 1) this.render();
      });
    });
    this.resizeObserver.observe(container);

    // Emprises des pays (clic tolérant) : calculées quand le navigateur est libre, pas au premier clic.
    if (options.magnify) {
      const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 800));
      idle(() => this.ensureGeoBoxes());
    }
  }

  /** Déplace l'image déjà dessinée des pays pour qu'elle corresponde au zoom actuel (rapide, sans redessiner). */
  private moveBaseImage(): void {
    const { k, x, y } = relativeAffine(this.transform, this.committed);
    this.baseSvg.style.transform = k === 1 && x === 0 && y === 0 ? '' : `translate(${x}px, ${y}px) scale(${k})`;
  }

  /** Redessine les pays au zoom actuel (net), et supprime la transformation provisoire. */
  private commitTransform(force = false): void {
    clearTimeout(this.settleTimer);
    const t = this.transform;
    const c = this.committed;
    if (!force && t.k === c.k && t.x === c.x && t.y === c.y) return;
    this.committed = t;
    const { k, x, y } = this.layout;
    this.viewport.setAttribute('transform', `${t.toString()} translate(${x},${y}) scale(${k})`);
    this.baseSvg.style.transform = '';
    this.updateLandmarkDetail();
  }

  /** Affiche les affluents et les limites intérieures seulement une fois assez zoomé (au repos, pas pendant un geste). */
  private updateLandmarkDetail(): void {
    if (!this.landmarkGroup) return;
    const kmPerPx = EARTH_RADIUS_KM / (this.projection.scale() * this.committed.k);
    this.landmarkGroup.classList.toggle('is-detailed', kmPerPx <= MAP_SETTINGS.landmarkDetailKmPerPx);
  }

  /**
   * Donne les repères à dessiner (fleuves, lacs, limites intérieures) ; null les retire.
   * Ils sont tracés une fois par zone, puis simplement montrés ou cachés (setLandmarksVisible).
   */
  setLandmarks(landmarks: Landmarks | null): void {
    if (landmarks === this.landmarks) return;
    this.landmarks = landmarks;
    if (this.geometryKey) this.drawLandmarks();
  }

  setLandmarksVisible(visible: boolean): void {
    this.landmarksVisible = visible;
    this.landmarkGroup?.classList.toggle('is-hidden', !visible);
  }

  private drawLandmarks(): void {
    const group = this.landmarkGroup;
    if (!group) return;
    group.replaceChildren();
    group.classList.toggle('is-hidden', !this.landmarksVisible);
    if (!this.landmarks) return;
    const chunked = chunkedLandmarks(this.landmarks);
    const fragment = document.createDocumentFragment();
    const add = (geometries: Array<MultiLineString | Polygon | MultiPolygon>, className: string) => {
      for (const geometry of geometries) {
        const d = this.path(geometry);
        if (!d) continue;
        const element = document.createElementNS(SVG_NS, 'path');
        element.setAttribute('d', d);
        element.setAttribute('class', className);
        fragment.appendChild(element);
      }
    };
    add(chunked.admin1, 'map-admin1');
    add(chunked.lakes, 'map-lake');
    add(chunked.riversMinor, 'map-river is-minor');
    add(chunked.riversMajor, 'map-river');
    group.appendChild(fragment);
    this.updateLandmarkDetail();
  }

  /** Affiche une zone : recalcule la projection et les tracés, puis remet le zoom à zéro. */
  setZone(zone: Zone): void {
    this.zone = zone;
    this.lastFrame = null;
    this.render();
  }

  /**
   * N'affiche que les cercles de repère de ces entités (null : tous). Quand l'élément est montré et qu'on
   * doit le nommer, les autres cercles ne servent à rien et le noieraient dans un essaim de points.
   */
  setMarkerFilter(ids: string[] | null): void {
    this.markerFilter = ids ? new Set(ids) : null;
    this.updateMarkers();
  }

  /**
   * Indique la place prise par les éléments posés sur la carte : la zone est alors cadrée dans
   * l'espace libre, pour qu'aucun pays ne se retrouve caché sous la question ou sous la réponse.
   */
  setInsets(insets: MapInsets): void {
    const next = { left: 0, right: 0, ...insets };
    const unchanged = (['top', 'bottom', 'left', 'right'] as const).every((side) => Math.abs(next[side] - this.insets[side]) < 4);
    if (unchanged) return;
    this.insets = next;
    this.render();
  }

  /** Met en évidence des entités (sélection, cible à trouver, bonne ou mauvaise réponse). */
  setHighlights(highlights: Map<string, HighlightKind>): void {
    const previous = this.highlights;
    this.highlights = new Map(highlights);
    for (const id of new Set([...previous.keys(), ...highlights.keys()])) this.applyClasses(id);
  }

  /** Affiche des repères ponctuels (taille constante à l'écran). Une liste vide les efface. */
  setPins(pins: MapPin[]): void {
    this.pinLayer.replaceChildren();
    this.pins = pins.map((pin) => {
      const element = document.createElementNS(SVG_NS, 'g');
      element.setAttribute('class', `map-pin is-${pin.kind}`);
      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('class', 'map-pin__halo');
      halo.setAttribute('r', pin.kind === 'anchor' ? '0' : '11');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'map-pin__dot');
      dot.setAttribute('r', pin.kind === 'anchor' ? '3' : '5');
      element.append(halo, dot);
      this.pinLayer.appendChild(element);
      return { pin, element, base: null };
    });
    this.projectPins();
  }

  /** Affiche des étiquettes de noms (au-dessus de tout). Une liste vide les efface. */
  setLabels(labels: MapLabel[]): void {
    this.labelLayer.replaceChildren();
    this.labels = labels.map((label) => {
      const element = document.createElementNS(SVG_NS, 'text');
      element.setAttribute('class', `map-label is-${label.kind}`);
      element.textContent = label.text;
      this.labelLayer.appendChild(element);
      return { label, element, base: null };
    });
    this.projectPins();
  }

  /**
   * Affiche des traits en pointillé (taille constante à l'écran), qui se dessinent du premier point
   * vers le second. Une liste vide les efface.
   */
  setLines(lines: MapLine[]): void {
    for (const { element } of this.lines) element.remove();
    this.lines = lines.map((line) => {
      const id = `map-line-mask-${(this.lineCount += 1)}`;
      const element = document.createElementNS(SVG_NS, 'g');
      element.setAttribute('class', 'map-line');
      // Le masque révèle progressivement le pointillé (animation CSS sur un trait plein).
      element.innerHTML = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000"><line class="map-line__reveal" /></mask><line class="map-line__dash" mask="url(#${id})" /><text class="map-line__label"></text>`;
      if (line.label) element.querySelector('text')!.textContent = line.label;
      // Sous les repères : le point d'arrivée reste bien visible.
      this.pinLayer.insertBefore(element, this.pinLayer.firstChild);
      return { line, element };
    });
    this.updateLines();
  }

  /**
   * Zoome en douceur sur des entités (leurs terres principales) et, si besoin, sur des points.
   * `minKm` : étendue minimale du cadrage sur le terrain, pour garder du voisinage autour d'une petite île
   * (en kilomètres, pour que le zoom soit le même en vue Monde et en vue continent).
   */
  flyTo(ids: string[], duration = MAP_SETTINGS.flyDuration, points: [number, number][] = [], minKm = 0): void {
    this.lastFrame = { ids, points, minKm };
    const pointBounds = points
      .map((point) => this.projection(point))
      .filter((p): p is [number, number] => p !== null)
      .map((p): Bounds => [p, p]);
    const bounds = unionBounds([
      ...ids
        .map((id) => this.world.mainShapes.get(id))
        .filter((shape) => shape !== undefined)
        .map((shape) => this.path.bounds(shape) as Bounds),
      ...pointBounds,
    ]);
    if (!bounds) return;
    let framed = bounds;
    const center = minKm > 0 ? this.projection.invert?.([(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]) : null;
    if (center) {
      const disc = geoCircle()
        .center([center[0], center[1]])
        .radius(minKm / 2 / KM_PER_DEGREE)();
      framed = unionBounds([bounds, this.path.bounds(disc) as Bounds]) ?? bounds;
    }
    // Avec une étendue en km, c'est elle qui limite le zoom (la taille en pixels dépend de l'écran).
    this.fitBounds(framed, duration, minKm > 0 ? 2 : 20);
  }

  /** Cadre un rectangle (coordonnées de la carte avant zoom) dans l'espace libre de l'écran. */
  private fitBounds(bounds: Bounds, duration: number, minSize = 40, padding = MAP_SETTINGS.padding * 2): void {
    // On cadre dans l'espace libre entre la question et la réponse.
    // (Clavier ouvert sur téléphone : cette bande peut être très basse, la marge se réduit avec elle.)
    const freeHeight = Math.max(this.height - this.insets.top - this.insets.bottom, 40);
    const freeWidth = Math.max(this.width - this.insets.left - this.insets.right, 40);
    const { k, x, y } = fitTransform(bounds, freeWidth, freeHeight, {
      padding: Math.min(padding, freeWidth / 8, freeHeight / 8),
      maxScale: MAP_SETTINGS.maxZoom,
      minSize,
    });
    const target = zoomIdentity.translate(x + this.insets.left, y + this.insets.top).scale(k);
    if (duration <= 0) this.svg.interrupt().call(this.zoomBehavior.transform, target);
    else this.svg.transition().duration(duration).call(this.zoomBehavior.transform, target);
  }

  /** Cadre un rectangle dessiné à l'écran (zoom au rectangle). */
  private zoomToScreenRect(rect: ScreenRect): void {
    const [x0, y0] = this.transform.invert([rect.x, rect.y]);
    const [x1, y1] = this.transform.invert([rect.x + rect.width, rect.y + rect.height]);
    this.fitBounds(
      [
        [x0, y0],
        [x1, y1],
      ],
      500,
      1,
      0,
    );
  }

  zoomBy(factor: number): void {
    this.svg.transition().duration(250).call(this.zoomBehavior.scaleBy, factor);
  }

  /** Revient au cadrage de la zone. */
  resetView(duration = MAP_SETTINGS.flyDuration): void {
    this.lastFrame = null;
    this.svg.transition().duration(duration).call(this.zoomBehavior.transform, zoomIdentity);
  }

  destroy(): void {
    cancelAnimationFrame(this.resizeFrame);
    clearTimeout(this.settleTimer);
    this.resizeObserver.disconnect();
    this.frameZoom?.destroy();
    this.svg.on('.zoom', null).on('click', null).on('contextmenu', null);
    this.svg.interrupt();
    this.element.remove();
  }

  // -------------------------------------------------------------------------------------------

  /**
   * Largeur sur laquelle on dessine la carte du Monde. Sur un écran en portrait, le planisphère tiendrait
   * dans une bande minuscule : on le dessine plus large que l'écran (jusqu'à 2,2 fois) et on le fait glisser.
   */
  private worldWidth(): number {
    return Math.max(this.width, Math.min(2.2 * this.width, WORLD_RATIO * this.height));
  }

  private configureProjection(zone: Zone): void {
    const top = MAP_SETTINGS.padding + this.insets.top;
    const bottom = Math.max(this.height - MAP_SETTINGS.padding - this.insets.bottom, top + 80);
    const left = MAP_SETTINGS.padding + this.insets.left;
    const right = Math.max(this.width - MAP_SETTINGS.padding - this.insets.right, left + 80);
    const extent: Bounds = [
      [left, top],
      [right, bottom],
    ];
    const box = zone.view.box;
    if (zone.view.projection === 'world' || !box) {
      // Planisphère rectangulaire (Patterson), recadré sans l'Antarctique.
      const offset = (this.worldWidth() - this.width) / 2;
      this.projection = geoPatterson().fitExtent(
        [
          [extent[0][0] - offset, extent[0][1]],
          [extent[1][0] + offset, extent[1][1]],
        ],
        { type: 'MultiPoint', coordinates: WORLD_CROP_POINTS },
      );
    } else {
      const [lon, lat] = boxCenter(box);
      // Projection azimutale équivalente centrée sur la zone : peu de déformation à l'échelle d'un continent.
      this.projection = geoAzimuthalEqualArea()
        .rotate([-lon, -lat])
        .clipAngle(110)
        .fitExtent(extent, { type: 'MultiPoint', coordinates: boxSamplePoints(box) });
    }
    this.path = geoPath(this.projection);
  }

  private render(): void {
    const { width, height } = this.container.getBoundingClientRect();
    if (!this.zone || width === 0 || height === 0) return;
    this.width = width;
    this.height = height;
    for (const svg of [this.baseSvg, this.overlaySvg]) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
    }
    this.configureProjection(this.zone);

    // Les tracés ne sont recalculés que pour une nouvelle zone, ou si l'écran a beaucoup grandi (netteté).
    const key = `${this.zone.view.projection}|${JSON.stringify(this.zone.view.box)}`;
    if (key !== this.geometryKey || this.projection.scale() / this.geometryScale > 1.25) this.buildGeometry(key);
    const [px, py] = this.projection.translate();
    const k = this.projection.scale() / this.geometryScale;
    this.layout = { k, x: px - k * this.geometryTranslate[0], y: py - k * this.geometryTranslate[1] };

    const active = new Set(this.zone.entityIds);
    this.buildMarkers(active);
    this.element.classList.toggle('is-world', this.zone.view.projection === 'world');
    for (const id of this.shapes.keys()) this.applyClasses(id, active);

    // Zoom : au moins le cadrage de la zone ; on peut sortir un peu du cadre pour voir les voisins.
    // Pour le Monde, on reste dans le planisphère (on peut descendre jusqu'à l'Antarctique),
    // et on peut dézoomer pour le voir en entier sur un téléphone.
    const world = this.zone.view.projection === 'world';
    const offset = (this.worldWidth() - width) / 2;
    const sphere = this.path.bounds({ type: 'Sphere' });
    this.zoomBehavior
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([world ? width / this.worldWidth() : 0.6, MAP_SETTINGS.maxZoom])
      .translateExtent(
        world
          ? [
              [-offset, Math.min(0, sphere[0][1])],
              [width + offset, Math.max(height, sphere[1][1] + MAP_SETTINGS.padding)],
            ]
          : [
              [-width, -height],
              [2 * width, 2 * height],
            ],
      );
    this.svg.interrupt().call(this.zoomBehavior.transform, zoomIdentity);
    this.commitTransform(true);
    this.projectPins();
    // Le cadrage demandé (élément montré, indice) survit au changement de taille : sinon, le clavier qui
    // s'ouvre sur téléphone ramènerait la carte au monde entier.
    if (this.lastFrame) {
      const { ids, points, minKm } = this.lastFrame;
      this.flyTo(ids, 0, points, minKm);
      this.commitTransform();
    }
  }

  /** Calcule et dessine les tracés de la zone pour la projection actuelle (l'opération coûteuse). */
  private buildGeometry(key: string): void {
    this.geometryKey = key;
    this.geometryScale = this.projection.scale();
    const [tx, ty] = this.projection.translate();
    this.geometryTranslate = [tx, ty];
    const fragment = document.createDocumentFragment();
    const addPath = (d: string | null, className: string, id?: string) => {
      if (!d) return null;
      const element = document.createElementNS(SVG_NS, 'path');
      element.setAttribute('d', d);
      element.setAttribute('class', className);
      if (id) element.setAttribute('data-id', id);
      fragment.appendChild(element);
      return element;
    };
    const chunked = chunkedWorld(this.world);
    addPath(this.path({ type: 'Sphere' }), 'map-sphere');
    // Quadrillage en pointillés, façon carte marine.
    for (const chunk of chunked.graticule) addPath(this.path(chunk), 'map-graticule');
    for (const shape of this.world.neutral) addPath(this.path(shape), 'map-neutral');
    this.shapes.clear();
    this.geometryAreas.clear();
    for (const [id, shape] of this.world.shapes) {
      // Couleur d'aquarelle du continent (voir map.css).
      const continent = this.world.byId.get(id)?.continent;
      const elements: SVGPathElement[] = [];
      for (const chunk of chunked.shapes.get(id) ?? []) {
        const element = addPath(this.path(chunk), 'map-entity', id);
        if (!element) continue; // partie hors du champ de la projection
        if (continent) element.setAttribute('data-continent', continent);
        elements.push(element);
      }
      if (elements.length === 0) continue;
      this.shapes.set(id, elements);
      this.geometryAreas.set(id, this.path.area(shape));
    }
    // Repères (placer capitales et villes) : au-dessus des pays, sous les côtes et les frontières.
    this.landmarkGroup = document.createElementNS(SVG_NS, 'g');
    this.landmarkGroup.setAttribute('class', 'map-landmarks');
    fragment.appendChild(this.landmarkGroup);
    // Traits par-dessus les surfaces : frontières et côtes, sans les lignes de découpe des données.
    for (const chunk of chunked.coastlines) addPath(this.path(chunk), 'map-coastline');
    for (const chunk of chunked.borders) addPath(this.path(chunk), 'map-borders');
    this.viewport.replaceChildren(fragment);
    this.drawLandmarks();
  }

  /** Cercles de repère pour les entités de la zone trop petites pour être touchées. */
  private buildMarkers(active: Set<string>): void {
    this.markers.clear();
    this.markerLayer.replaceChildren();
    if (this.options.interactive === false || this.options.clickOnly) return;
    const areaScale = this.layout.k * this.layout.k;
    for (const id of this.shapes.keys()) {
      const area = (this.geometryAreas.get(id) ?? 0) * areaScale;
      const anchor = this.world.byId.get(id)?.anchor;
      const anchorPx = anchor ? this.projection(anchor) : null;
      if (active.has(id) && anchorPx && needsMarker(area, 1, MAP_SETTINGS.markerAreaThreshold)) {
        this.markers.set(id, { element: this.createMarker(id), area, anchor: anchorPx, small: false });
      }
    }
  }

  private projectPins(): void {
    for (const entry of this.pins) entry.base = this.projection(entry.pin.lonLat);
    for (const entry of this.labels) entry.base = this.projection(entry.label.lonLat);
    this.updatePins();
    this.updateLines();
    this.updateLabels();
  }

  private updateLabels(): void {
    for (const { label, element, base } of this.labels) {
      element.style.display = base ? '' : 'none';
      if (!base) continue;
      const [x, y] = this.transform.apply(base);
      element.setAttribute('x', x.toFixed(1));
      // Au-dessus du point, pour ne pas cacher le pays ou la capitale.
      element.setAttribute('y', (y - (label.kind === 'anchor' ? 7 : 14)).toFixed(1));
    }
  }

  private updateLines(): void {
    for (const { line, element } of this.lines) {
      const from = this.projection(line.from);
      const to = this.projection(line.to);
      element.style.display = from && to ? '' : 'none';
      if (!from || !to) continue;
      const [x1, y1] = this.transform.apply(from);
      const [x2, y2] = this.transform.apply(to);
      const length = Math.hypot(x2 - x1, y2 - y1);
      for (const segment of element.querySelectorAll('line')) {
        segment.setAttribute('x1', x1.toFixed(1));
        segment.setAttribute('y1', y1.toFixed(1));
        segment.setAttribute('x2', x2.toFixed(1));
        segment.setAttribute('y2', y2.toFixed(1));
      }
      element.style.setProperty('--line-length', `${Math.ceil(length) + 2}`);
      const label = element.querySelector('text')!;
      label.setAttribute('x', ((x1 + x2) / 2).toFixed(1));
      label.setAttribute('y', ((y1 + y2) / 2 - 8).toFixed(1));
      // Trop court pour une étiquette lisible : on la cache (le message donne déjà l'écart).
      label.style.display = length > 60 ? '' : 'none';
    }
  }

  private updatePins(): void {
    for (const { element, base } of this.pins) {
      element.style.display = base ? '' : 'none';
      if (!base) continue;
      const [x, y] = this.transform.apply(base);
      element.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    }
  }

  private createMarker(id: string): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'map-marker');
    group.setAttribute('data-id', id);
    for (const [className, radius] of [
      ['map-marker__hit', MAP_SETTINGS.markerHitRadius],
      ['map-marker__dot', MAP_SETTINGS.markerRadius],
    ] as const) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', className);
      circle.setAttribute('r', String(radius));
      group.appendChild(circle);
    }
    this.markerLayer.appendChild(group);
    return group;
  }

  /**
   * Les cercles suivent la carte. Ils restent toujours affichés : en grand tant que le territoire est trop
   * petit pour être touché, puis en petit rond pour le repérer. Ceux qui sont hors de l'écran sont masqués.
   */
  private updateMarkers(): void {
    const margin = 40;
    for (const [id, entry] of this.markers) {
      const { element, area, anchor } = entry;
      const [x, y] = this.transform.apply(anchor);
      const onScreen =
        (!this.markerFilter || this.markerFilter.has(id)) &&
        x > -margin &&
        x < this.width + margin &&
        y > -margin &&
        y < this.height + margin;
      element.style.display = onScreen ? '' : 'none';
      if (!onScreen) continue;
      element.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const small = !needsMarker(area, this.transform.k, MAP_SETTINGS.markerAreaThreshold);
      if (small !== entry.small) {
        entry.small = small;
        element.classList.toggle('is-small', small);
        const [hit, dot] = element.children;
        hit?.setAttribute('r', String(small ? MAP_SETTINGS.smallMarkerHitRadius : MAP_SETTINGS.markerHitRadius));
        dot?.setAttribute('r', String(small ? MAP_SETTINGS.smallMarkerRadius : MAP_SETTINGS.markerRadius));
      }
    }
  }

  private applyClasses(id: string, active = new Set(this.zone?.entityIds ?? [])): void {
    const kind = this.highlights.get(id);
    const classes = (base: string) => [base, active.has(id) ? '' : 'is-inactive', kind ? `is-${kind}` : ''].filter(Boolean).join(' ');
    const marker = this.markers.get(id);
    marker?.element.setAttribute('class', classes(marker.small ? 'map-marker is-small' : 'map-marker'));
    // Couleur imposée (carte de conquête), sauf si une mise en évidence la remplace.
    const fill = this.fills.get(id);
    for (const shape of this.shapes.get(id) ?? []) {
      shape.setAttribute('class', classes('map-entity'));
      shape.style.fill = fill && !kind ? fill.color : '';
      shape.style.fillOpacity = fill && !kind ? String(fill.opacity) : '';
    }
  }

  /** Impose une couleur à certaines entités (les autres gardent leur aquarelle de continent). */
  setFills(fills: Map<string, MapFill>): void {
    const previous = this.fills;
    this.fills = new Map(fills);
    for (const id of new Set([...previous.keys(), ...fills.keys()])) this.applyClasses(id);
  }

  /**
   * Cercle de repère visible le plus proche du point cliqué (dans son rayon cliquable).
   * Quand des cercles se chevauchent (Liban, Chypre, Israël… en vue Monde), on prend le plus
   * proche du doigt, et non celui qui est dessiné par-dessus.
   */
  private nearestMarker(px: number, py: number): string | null {
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const [id, { element, anchor, small }] of this.markers) {
      if (element.style.display === 'none') continue;
      const [x, y] = this.transform.apply(anchor);
      const distance = Math.hypot(x - px, y - py);
      if (distance <= (small ? MAP_SETTINGS.smallMarkerHitRadius : MAP_SETTINGS.markerHitRadius) && distance < bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Nombre de grands cercles de repère visibles à moins de `radius` pixels du point. */
  private markersNear(px: number, py: number, radius: number): number {
    let count = 0;
    for (const { element, anchor, small } of this.markers.values()) {
      if (small || element.style.display === 'none') continue;
      const [x, y] = this.transform.apply(anchor);
      if (Math.hypot(x - px, y - py) <= radius) count += 1;
    }
    return count;
  }

  private handleClick(event: MouseEvent): void {
    // Clic pendant le zoom au rectangle : on cadre le rectangle, ce n'est pas une réponse.
    if (this.frameZoom?.active) {
      this.frameZoom.confirm();
      return;
    }
    const target = event.target instanceof Element ? event.target.closest('[data-id]') : null;
    const [px, py] = pointer(event, this.element);
    const [x, y] = this.transform.invert([px, py]);
    const lonLat = this.projection.invert?.([x, y]) ?? null;
    const onMarker = target !== null && this.markerLayer.contains(target);
    // Loupe : un clic au milieu de plusieurs petits pays fait zoomer au lieu de répondre.
    if (this.options.magnify && this.markersNear(px, py, MAP_SETTINGS.magnifyRadius) >= 2) {
      this.svg.transition().duration(450).call(this.zoomBehavior.scaleBy, MAP_SETTINGS.magnifyFactor, [px, py]);
      return;
    }
    let entityId = onMarker ? this.nearestMarker(px, py) : (target?.getAttribute('data-id') ?? null);
    // Clic dans la mer tout près d'un pays (petite île manquée de peu) : on le compte pour ce pays.
    if (!entityId && this.options.magnify && lonLat) entityId = this.snapToNearest(px, py, [lonLat[0], lonLat[1]]);
    this.options.onPick?.({ entityId, lonLat: lonLat ? [lonLat[0], lonLat[1]] : null });
  }

  private ensureGeoBoxes(): Map<string, [[number, number], [number, number]]> {
    this.geoBoxes ??= new Map([...this.world.shapes].map(([id, shape]) => [id, geoBounds(shape) as [[number, number], [number, number]]]));
    return this.geoBoxes;
  }

  /** Pays de la zone le plus proche d'un clic dans la mer, s'il est à moins de `snapRadius` pixels. */
  private snapToNearest(px: number, py: number, lonLat: [number, number]): string | null {
    // Distance au sol correspondant au rayon, à cet endroit et à ce zoom.
    const edge = this.projection.invert?.(this.transform.invert([px + MAP_SETTINGS.snapRadius, py]));
    if (!edge) return null;
    const radiusKm = distanceKm(lonLat, [edge[0], edge[1]]);
    const margin = (radiusKm / 111.195) * 1.5; // en degrés, avec de la marge
    const geoBoxes = this.ensureGeoBoxes();
    const lonMargin = margin / Math.max(Math.cos((lonLat[1] * Math.PI) / 180), 0.2);
    let best: string | null = null;
    let bestDistance = radiusKm;
    for (const id of this.zone?.entityIds ?? []) {
      const box = geoBoxes.get(id);
      const shape = this.world.shapes.get(id);
      if (!box || !shape) continue;
      const [[west, south], [east, north]] = box;
      const inLat = lonLat[1] >= south - margin && lonLat[1] <= north + margin;
      // Emprise qui traverse l'antiméridien (west > east) : on ne filtre pas en longitude.
      const inLon = west > east || (lonLat[0] >= west - lonMargin && lonLat[0] <= east + lonMargin);
      if (!inLat || !inLon) continue;
      const distance = distanceToShapeKm(shape, lonLat[0], lonLat[1]);
      if (distance <= bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }
}
