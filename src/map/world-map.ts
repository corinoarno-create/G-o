// Moteur de carte : rendu SVG avec d3-geo, zoom et déplacement avec d3-zoom (molette, glisser, pincer).
//
// Principe : les tracés sont calculés une fois pour une projection ajustée à la zone et à la taille de l'écran ;
// le zoom ne fait que transformer le groupe qui les contient (rapide). Les bordures gardent la même épaisseur
// à l'écran (vector-effect). Les cercles de repère des micro-États sont dans un calque à part, non zoomé,
// repositionnés à chaque mouvement pour garder une taille constante et rester faciles à toucher.
import { geoAzimuthalEqualArea, geoBounds, geoCircle, geoGraticule10, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import { pointer, select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { WorldData } from '../data/world.ts';
import { distanceKm, distanceToShapeKm } from '../engine/geo.ts';
import { geoPatterson, WORLD_CROP_POINTS, WORLD_RATIO } from './patterson.ts';
import { fitTransform, needsMarker, unionBounds, type Bounds } from './view-math.ts';
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
   * Clic tolérant : un clic dans la mer à moins de tant de pixels d'un pays compte comme un clic sur ce pays
   * (le plus proche). Les petites îles deviennent touchables sans viser au pixel près.
   */
  snapRadius: COARSE ? 24 : 16,
  /** Distance (px) au-delà de laquelle un appui devient un glisser, et non un clic. */
  clickDistance: 5,
  /** Durée des animations de cadrage (ms). */
  flyDuration: 750,
  /**
   * Loupe : si un clic tombe près d'au moins deux cercles de repère (Caraïbes, Pacifique…),
   * la carte zoome autour du clic au lieu de répondre, pour qu'on choisisse précisément.
   */
  magnifyRadius: 26,
  magnifyFactor: 4,
};

const KM_PER_DEGREE = 111.195;

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
  kind: 'selected' | 'correct' | 'wrong' | 'target';
}

/** Étiquette posée sur la carte (nom d'un élément qu'on découvre), taille constante à l'écran. */
export interface MapLabel {
  lonLat: [number, number];
  text: string;
  /** current : l'élément qu'on regarde ; seen : déjà vu (plus discret). */
  kind: 'current' | 'seen';
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
}

export class WorldMap {
  readonly element: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly viewport: SVGGElement;
  private readonly markerLayer: SVGGElement;
  private readonly pinLayer: SVGGElement;
  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private readonly resizeObserver: ResizeObserver;
  private projection: GeoProjection = geoPatterson();
  private path: GeoPath = geoPath(this.projection);
  private transform: ZoomTransform = zoomIdentity;
  private width = 0;
  private height = 0;
  private zone: Zone | null = null;
  private insets: Required<MapInsets> = { top: 0, bottom: 0, left: 0, right: 0 };
  private readonly shapes = new Map<string, SVGPathElement>();
  private readonly markers = new Map<string, { element: SVGGElement; area: number; anchor: [number, number] }>();
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

  constructor(
    private readonly container: HTMLElement,
    private readonly world: WorldData,
    private readonly options: WorldMapOptions = {},
  ) {
    this.element = document.createElementNS(SVG_NS, 'svg');
    this.element.setAttribute('class', 'world-map');
    this.element.setAttribute('role', 'img');
    this.element.setAttribute('aria-label', 'Carte du monde');
    this.viewport = this.element.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.markerLayer = this.element.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.markerLayer.setAttribute('class', 'map-markers');
    this.pinLayer = this.element.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.pinLayer.setAttribute('class', 'map-pins');
    this.labelLayer = this.element.appendChild(document.createElementNS(SVG_NS, 'g'));
    this.labelLayer.setAttribute('class', 'map-labels');
    container.appendChild(this.element);

    this.svg = select(this.element);
    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .clickDistance(MAP_SETTINGS.clickDistance)
      .tapDistance(MAP_SETTINGS.clickDistance * 2)
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.transform = event.transform;
        this.viewport.setAttribute('transform', event.transform.toString());
        this.updateMarkers();
        this.updatePins();
        this.updateLines();
        this.updateLabels();
      });
    // Pas de zoom au double-clic : en jeu, deux clics rapides doivent rester deux réponses possibles.
    if (options.interactive === false) {
      this.element.classList.add('is-static');
    } else {
      this.svg.call(this.zoomBehavior).on('dblclick.zoom', null);
      this.svg.on('click', (event: MouseEvent) => this.handleClick(event));
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
  }

  /** Affiche une zone : recalcule la projection et les tracés, puis remet le zoom à zéro. */
  setZone(zone: Zone): void {
    this.zone = zone;
    this.render();
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
      halo.setAttribute('r', '11');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'map-pin__dot');
      dot.setAttribute('r', '5');
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
    this.fitBounds(framed, duration, 20);
  }

  /** Cadre un rectangle (coordonnées de la carte avant zoom) dans l'espace libre de l'écran. */
  private fitBounds(bounds: Bounds, duration: number, minSize = 40): void {
    // On cadre dans l'espace libre entre la question et la réponse.
    const freeHeight = Math.max(this.height - this.insets.top - this.insets.bottom, 80);
    const freeWidth = Math.max(this.width - this.insets.left - this.insets.right, 80);
    const { k, x, y } = fitTransform(bounds, freeWidth, freeHeight, {
      padding: MAP_SETTINGS.padding * 2,
      maxScale: MAP_SETTINGS.maxZoom,
      minSize,
    });
    this.svg
      .transition()
      .duration(duration)
      .call(this.zoomBehavior.transform, zoomIdentity.translate(x + this.insets.left, y + this.insets.top).scale(k));
  }

  zoomBy(factor: number): void {
    this.svg.transition().duration(250).call(this.zoomBehavior.scaleBy, factor);
  }

  /** Revient au cadrage de la zone. */
  resetView(duration = MAP_SETTINGS.flyDuration): void {
    this.svg.transition().duration(duration).call(this.zoomBehavior.transform, zoomIdentity);
  }

  destroy(): void {
    cancelAnimationFrame(this.resizeFrame);
    this.resizeObserver.disconnect();
    this.svg.on('.zoom', null).on('click', null);
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
    this.element.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.element.setAttribute('width', String(width));
    this.element.setAttribute('height', String(height));
    this.configureProjection(this.zone);

    const active = new Set(this.zone.entityIds);
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
    addPath(this.path({ type: 'Sphere' }), 'map-sphere');
    // Quadrillage en pointillés, façon carte marine.
    addPath(this.path(geoGraticule10()), 'map-graticule');
    for (const shape of this.world.neutral) addPath(this.path(shape), 'map-neutral');
    this.shapes.clear();
    this.markers.clear();
    this.markerLayer.replaceChildren();
    for (const [id, shape] of this.world.shapes) {
      const element = addPath(this.path(shape), 'map-entity', id);
      if (!element) continue; // entité hors du champ de la projection
      // Couleur d'aquarelle du continent (voir map.css).
      const continent = this.world.byId.get(id)?.continent;
      if (continent) element.setAttribute('data-continent', continent);
      this.shapes.set(id, element);
      // Cercle de repère pour les entités trop petites, même au zoom maximal on le garde si besoin.
      const area = this.path.area(shape);
      const anchor = this.world.byId.get(id)?.anchor;
      const anchorPx = anchor ? this.projection(anchor) : null;
      if (this.options.interactive !== false && active.has(id) && anchorPx && needsMarker(area, 1, MAP_SETTINGS.markerAreaThreshold)) {
        this.markers.set(id, { element: this.createMarker(id), area, anchor: anchorPx });
      }
    }
    // Traits par-dessus les surfaces : frontières et côtes, sans les lignes de découpe des données.
    addPath(this.path(this.world.coastlines), 'map-coastline');
    addPath(this.path(this.world.borders), 'map-borders');
    this.viewport.replaceChildren(fragment);
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
    this.projectPins();
  }

  private projectPins(): void {
    for (const entry of this.pins) entry.base = this.projection(entry.pin.lonLat);
    for (const entry of this.labels) entry.base = this.projection(entry.label.lonLat);
    this.updatePins();
    this.updateLines();
    this.updateLabels();
  }

  private updateLabels(): void {
    for (const { element, base } of this.labels) {
      element.style.display = base ? '' : 'none';
      if (!base) continue;
      const [x, y] = this.transform.apply(base);
      element.setAttribute('x', x.toFixed(1));
      // Au-dessus du point, pour ne pas cacher le pays ou la capitale.
      element.setAttribute('y', (y - 14).toFixed(1));
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

  private updateMarkers(): void {
    for (const { element, area, anchor } of this.markers.values()) {
      const visible = needsMarker(area, this.transform.k, MAP_SETTINGS.markerAreaThreshold);
      element.style.display = visible ? '' : 'none';
      if (visible) {
        const [x, y] = this.transform.apply(anchor);
        element.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      }
    }
  }

  private applyClasses(id: string, active = new Set(this.zone?.entityIds ?? [])): void {
    const kind = this.highlights.get(id);
    const classes = (base: string) =>
      [base, active.has(id) ? '' : 'is-inactive', kind ? `is-${kind}` : ''].filter(Boolean).join(' ');
    const shape = this.shapes.get(id);
    shape?.setAttribute('class', classes('map-entity'));
    this.markers.get(id)?.element.setAttribute('class', classes('map-marker'));
    // Couleur imposée (carte de conquête), sauf si une mise en évidence la remplace.
    const fill = this.fills.get(id);
    if (shape) {
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
    let bestDistance = MAP_SETTINGS.markerHitRadius;
    for (const [id, { element, anchor }] of this.markers) {
      if (element.style.display === 'none') continue;
      const [x, y] = this.transform.apply(anchor);
      const distance = Math.hypot(x - px, y - py);
      if (distance <= bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Nombre de cercles de repère visibles à moins de `radius` pixels du point. */
  private markersNear(px: number, py: number, radius: number): number {
    let count = 0;
    for (const { element, anchor } of this.markers.values()) {
      if (element.style.display === 'none') continue;
      const [x, y] = this.transform.apply(anchor);
      if (Math.hypot(x - px, y - py) <= radius) count += 1;
    }
    return count;
  }

  private handleClick(event: MouseEvent): void {
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

  /** Pays de la zone le plus proche d'un clic dans la mer, s'il est à moins de `snapRadius` pixels. */
  private snapToNearest(px: number, py: number, lonLat: [number, number]): string | null {
    // Distance au sol correspondant au rayon, à cet endroit et à ce zoom.
    const edge = this.projection.invert?.(this.transform.invert([px + MAP_SETTINGS.snapRadius, py]));
    if (!edge) return null;
    const radiusKm = distanceKm(lonLat, [edge[0], edge[1]]);
    const margin = (radiusKm / 111.195) * 1.5; // en degrés, avec de la marge
    if (!this.geoBoxes) {
      this.geoBoxes = new Map([...this.world.shapes].map(([id, shape]) => [id, geoBounds(shape) as [[number, number], [number, number]]]));
    }
    const lonMargin = margin / Math.max(Math.cos((lonLat[1] * Math.PI) / 180), 0.2);
    let best: string | null = null;
    let bestDistance = radiusKm;
    for (const id of this.zone?.entityIds ?? []) {
      const box = this.geoBoxes.get(id);
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
