// Moteur de carte : rendu SVG avec d3-geo, zoom et déplacement avec d3-zoom (molette, glisser, pincer).
//
// Principe : les tracés sont calculés une fois pour une projection ajustée à la zone et à la taille de l'écran ;
// le zoom ne fait que transformer le groupe qui les contient (rapide). Les bordures gardent la même épaisseur
// à l'écran (vector-effect). Les cercles de repère des micro-États sont dans un calque à part, non zoomé,
// repositionnés à chaque mouvement pour garder une taille constante et rester faciles à toucher.
import { geoAzimuthalEqualArea, geoNaturalEarth1, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import { pointer, select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { WorldData } from '../data/world.ts';
import { fitTransform, needsMarker, unionBounds, type Bounds } from './view-math.ts';
import { boxCenter, boxSamplePoints, type Zone } from './zones.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Réglages de la carte (en pixels d'écran). */
export const MAP_SETTINGS = {
  /** Marge autour de la zone cadrée. */
  padding: 16,
  /** Zoom maximal par rapport au cadrage de la zone. */
  maxZoom: 60,
  /** Sous cette surface à l'écran (px²), une entité reçoit un cercle de repère. */
  markerAreaThreshold: 45,
  /** Rayon visible du cercle de repère. */
  markerRadius: 5,
  /** Rayon cliquable autour du cercle (plus large, pour le doigt). */
  markerHitRadius: 14,
  /** Distance (px) au-delà de laquelle un appui devient un glisser, et non un clic. */
  clickDistance: 5,
  /** Durée des animations de cadrage (ms). */
  flyDuration: 750,
};

export type HighlightKind = 'selected' | 'target' | 'correct' | 'wrong';

/** Repère ponctuel sur la carte : point cliqué, bonne position d'une capitale… */
export interface MapPin {
  lonLat: [number, number];
  kind: 'selected' | 'correct' | 'wrong' | 'target';
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

export interface WorldMapOptions {
  onPick?: (pick: MapPick) => void;
}

export class WorldMap {
  readonly element: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly viewport: SVGGElement;
  private readonly markerLayer: SVGGElement;
  private readonly pinLayer: SVGGElement;
  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private readonly resizeObserver: ResizeObserver;
  private projection: GeoProjection = geoNaturalEarth1();
  private path: GeoPath = geoPath(this.projection);
  private transform: ZoomTransform = zoomIdentity;
  private width = 0;
  private height = 0;
  private zone: Zone | null = null;
  private insets: Required<MapInsets> = { top: 0, bottom: 0, left: 0, right: 0 };
  private readonly shapes = new Map<string, SVGPathElement>();
  private readonly markers = new Map<string, { element: SVGGElement; area: number; anchor: [number, number] }>();
  private highlights = new Map<string, HighlightKind>();
  private pins: Array<{ pin: MapPin; element: SVGGElement; base: [number, number] | null }> = [];
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
      });
    // Pas de zoom au double-clic : en jeu, deux clics rapides doivent rester deux réponses possibles.
    this.svg.call(this.zoomBehavior).on('dblclick.zoom', null);
    this.svg.on('click', (event: MouseEvent) => this.handleClick(event));

    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.render());
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

  /** Zoome en douceur sur des entités (leurs terres principales) et, si besoin, sur des points. */
  flyTo(ids: string[], duration = MAP_SETTINGS.flyDuration, points: [number, number][] = []): void {
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
    // On cadre dans l'espace libre entre la question et la réponse.
    const freeHeight = Math.max(this.height - this.insets.top - this.insets.bottom, 80);
    const freeWidth = Math.max(this.width - this.insets.left - this.insets.right, 80);
    const { k, x, y } = fitTransform(bounds, freeWidth, freeHeight, {
      padding: MAP_SETTINGS.padding * 2,
      maxScale: MAP_SETTINGS.maxZoom,
      minSize: 40,
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
    this.element.remove();
  }

  // -------------------------------------------------------------------------------------------

  /**
   * Largeur sur laquelle on dessine la carte du Monde. Sur un écran en portrait, le planisphère tiendrait
   * dans une bande minuscule : on le dessine plus large que l'écran (jusqu'à 2,2 fois) et on le fait glisser.
   */
  private worldWidth(): number {
    const naturalEarthRatio = 1.9; // largeur / hauteur du planisphère Natural Earth
    return Math.max(this.width, Math.min(2.2 * this.width, naturalEarthRatio * this.height));
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
    if (zone.view.projection === 'natural-earth' || !box) {
      const offset = (this.worldWidth() - this.width) / 2;
      this.projection = geoNaturalEarth1().fitExtent(
        [
          [extent[0][0] - offset, extent[0][1]],
          [extent[1][0] + offset, extent[1][1]],
        ],
        { type: 'Sphere' },
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
    for (const shape of this.world.neutral) addPath(this.path(shape), 'map-neutral');
    this.shapes.clear();
    this.markers.clear();
    this.markerLayer.replaceChildren();
    for (const [id, shape] of this.world.shapes) {
      const element = addPath(this.path(shape), 'map-entity', id);
      if (!element) continue; // entité hors du champ de la projection
      this.shapes.set(id, element);
      // Cercle de repère pour les entités trop petites, même au zoom maximal on le garde si besoin.
      const area = this.path.area(shape);
      const anchor = this.world.byId.get(id)?.anchor;
      const anchorPx = anchor ? this.projection(anchor) : null;
      if (active.has(id) && anchorPx && needsMarker(area, 1, MAP_SETTINGS.markerAreaThreshold)) {
        this.markers.set(id, { element: this.createMarker(id), area, anchor: anchorPx });
      }
    }
    // Traits par-dessus les surfaces : frontières et côtes, sans les lignes de découpe des données.
    addPath(this.path(this.world.coastlines), 'map-coastline');
    addPath(this.path(this.world.borders), 'map-borders');
    this.viewport.replaceChildren(fragment);
    this.element.classList.toggle('is-world', this.zone.view.projection === 'natural-earth');
    for (const id of this.shapes.keys()) this.applyClasses(id, active);

    // Zoom : au moins le cadrage de la zone ; on peut sortir un peu du cadre pour voir les voisins.
    // Pour le Monde, on reste dans le planisphère, et on peut dézoomer pour le voir en entier sur un téléphone.
    const world = this.zone.view.projection === 'natural-earth';
    const offset = (this.worldWidth() - width) / 2;
    this.zoomBehavior
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([world ? width / this.worldWidth() : 0.6, MAP_SETTINGS.maxZoom])
      .translateExtent(
        world
          ? [
              [-offset, 0],
              [width + offset, height],
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
    this.updatePins();
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
    this.shapes.get(id)?.setAttribute('class', classes('map-entity'));
    this.markers.get(id)?.element.setAttribute('class', classes('map-marker'));
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target.closest('[data-id]') : null;
    const [px, py] = pointer(event, this.element);
    const [x, y] = this.transform.invert([px, py]);
    const lonLat = this.projection.invert?.([x, y]) ?? null;
    this.options.onPick?.({
      entityId: target?.getAttribute('data-id') ?? null,
      lonLat: lonLat ? [lonLat[0], lonLat[1]] : null,
    });
  }
}
