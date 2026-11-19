// Zoom au rectangle (PC) : en maintenant Ctrl ou Espace au-dessus de la carte, un rectangle suit la souris ;
// en relâchant la touche (ou en cliquant), la carte cadre ce rectangle. La molette change sa taille.
// Échap, une autre touche ou la sortie de la souris annulent.

/** Espace libre de la carte à l'écran (entre la question et le panneau de réponse). */
export interface FreeArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FRAME_ZOOM_SETTINGS = {
  /** Le rectangle fait 1/10 de l'espace libre : zoom ×10 environ (≈ la moitié de l'Europe en vue Monde). */
  divisor: 10,
  minDivisor: 2,
  maxDivisor: 40,
  /** Facteur de taille par cran de molette. */
  wheelStep: 1.15,
};

/** Rectangle centré sur la souris, aux proportions de l'espace libre (il le remplira une fois cadré). */
export function frameRect(center: [number, number], free: FreeArea, divisor: number): ScreenRect {
  const width = free.width / divisor;
  const height = free.height / divisor;
  return { x: center[0] - width / 2, y: center[1] - height / 2, width, height };
}

/** Nouvelle taille après un cran de molette (vers le haut : rectangle plus petit, donc zoom plus fort). */
export function nextDivisor(divisor: number, deltaY: number): number {
  const { wheelStep, minDivisor, maxDivisor } = FRAME_ZOOM_SETTINGS;
  const next = deltaY < 0 ? divisor * wheelStep : divisor / wheelStep;
  return Math.min(Math.max(next, minDivisor), maxDivisor);
}

type FrameKey = 'Control' | ' ';

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Taille choisie à la molette, retenue d'une carte à l'autre pendant la visite. */
let rememberedDivisor = FRAME_ZOOM_SETTINGS.divisor;

export class FrameZoom {
  private readonly box: HTMLDivElement;
  private mouse: [number, number] | null = null;
  private key: FrameKey | null = null;
  private readonly controller = new AbortController();

  constructor(
    private readonly element: HTMLElement,
    private readonly getFreeArea: () => FreeArea,
    private readonly onFrame: (rect: ScreenRect) => void,
  ) {
    this.box = element.appendChild(document.createElement('div'));
    this.box.className = 'map-frame-zoom';
    const hint = this.box.appendChild(document.createElement('span'));
    hint.className = 'map-frame-zoom__hint';
    hint.textContent = 'Relâche pour zoomer · molette : taille';

    const signal = this.controller.signal;
    element.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        const bounds = element.getBoundingClientRect();
        this.mouse = [event.clientX - bounds.left, event.clientY - bounds.top];
        if (this.key) this.update();
      },
      { signal },
    );
    element.addEventListener(
      'pointerleave',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        this.mouse = null;
        this.cancel();
      },
      { signal },
    );
    // Molette pendant le rectangle : elle change sa taille au lieu de zoomer (écouteur posé avant celui du zoom).
    element.addEventListener(
      'wheel',
      (event) => {
        if (!this.key) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        rememberedDivisor = nextDivisor(rememberedDivisor, event.deltaY);
        this.update();
      },
      { signal, capture: true, passive: false },
    );
    window.addEventListener('keydown', (event) => this.onKeyDown(event), { signal });
    window.addEventListener('keyup', (event) => this.onKeyUp(event), { signal });
    window.addEventListener('blur', () => this.cancel(), { signal });
  }

  get active(): boolean {
    return this.key !== null;
  }

  /** Cadre le rectangle tout de suite (clic pendant que la touche est maintenue). */
  confirm(): void {
    const rect = this.rect();
    this.cancel();
    if (rect) this.onFrame(rect);
  }

  destroy(): void {
    this.controller.abort();
    this.box.remove();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key === 'Control' ? 'Control' : event.key === ' ' && !isTyping(event.target) ? ' ' : null;
    if (this.key) {
      if (key === this.key) {
        // Répétition de la touche maintenue : Espace ne doit ni faire défiler ni activer un bouton.
        if (key === ' ') event.preventDefault();
        return;
      }
      // Une autre touche (Échap, raccourci Ctrl+…) : on abandonne.
      this.cancel();
      return;
    }
    if (!key || !this.mouse || event.repeat) return;
    if (key === ' ') event.preventDefault();
    this.key = key;
    this.element.classList.add('is-framing');
    this.update();
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!this.key || event.key !== this.key) return;
    if (this.key === ' ') event.preventDefault();
    this.confirm();
  }

  private cancel(): void {
    this.key = null;
    this.element.classList.remove('is-framing');
    this.box.classList.remove('is-visible');
  }

  private rect(): ScreenRect | null {
    return this.mouse ? frameRect(this.mouse, this.getFreeArea(), rememberedDivisor) : null;
  }

  private update(): void {
    const rect = this.rect();
    if (!rect) return;
    this.box.style.width = `${rect.width}px`;
    this.box.style.height = `${rect.height}px`;
    this.box.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
    this.box.classList.add('is-visible');
  }
}
