// Petites icônes dessinées à la plume (traits, sans émoji), partagées par les écrans.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

interface IconProps {
  size?: number;
}

/** Rose des vents (logo). */
export function CompassLogo({ size = 44 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="var(--paper-light)" stroke="var(--ink)" stroke-width="2" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3" />
      <path d="M24 7 L28 24 L24 41 L20 24 Z" fill="var(--terracotta)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M7 24 L24 20 L41 24 L24 28 Z" fill="var(--paper-dark)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round" />
      <circle cx="24" cy="24" r="2.4" fill="var(--ink)" />
    </svg>
  );
}

export function MapIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

/** Courbe de progression (page « Ma progression »). */
export function ChartIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4 4v16h16" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}

export function BookIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4 19V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2" />
      <path d="M8 8h6M8 12h4" />
    </svg>
  );
}

export function ArrowIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width="2.6">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BulbIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width="2.6">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width="3">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlaneIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

/** Punaise qui tient l'étiquette de la question. */
export function PushPin() {
  return (
    <svg class="pushpin" width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
      <circle cx="13" cy="10" r="9" fill="var(--terracotta)" stroke="var(--ink)" stroke-width="1.5" />
      <circle cx="10" cy="7" r="2.5" fill="#f4c5a8" />
      <path d="M13 19 L13 29" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

/** Rose des vents décorative posée sur la carte. */
export function CompassRose({ size = 110 }: IconProps) {
  return (
    <svg class="compass-rose" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="44" fill="none" stroke="var(--ink-soft)" stroke-width="1.5" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="2 4" />
      <path d="M60 8 L67 60 L60 112 L53 60 Z" fill="var(--paper-dark)" stroke="var(--ink-soft)" stroke-width="1.2" />
      <path d="M60 8 L67 60 L53 60 Z" fill="var(--terracotta)" stroke="var(--ink-soft)" stroke-width="1.2" />
      <path d="M8 60 L60 53 L112 60 L60 67 Z" fill="var(--paper-light)" stroke="var(--ink-soft)" stroke-width="1.2" />
      <text x="60" y="7" text-anchor="middle" font-family="Caveat, cursive" font-size="17" font-weight="700" fill="var(--ink)">
        N
      </text>
    </svg>
  );
}

/** Globe (case « Monde » du carnet). */
export function GlobeIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </svg>
  );
}

/** Flèche de retour. */
export function BackIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width="2.4">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** Coupe (défis entre amis). */
export function TrophyIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </svg>
  );
}

/** Envoyer (partager un défi). */
export function SendIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
    </svg>
  );
}

/** Sceau de cire (mode Expert) : un rond festonné avec une étoile. */
export function SealIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 2.5l2 1.6 2.5-.4 1 2.3 2.3 1-.4 2.5 1.6 2-1.6 2 .4 2.5-2.3 1-1 2.3-2.5-.4-2 1.6-2-1.6-2.5.4-1-2.3-2.3-1 .4-2.5-1.6-2 1.6-2-.4-2.5 2.3-1 1-2.3 2.5.4z" />
      <path d="M12 8.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" />
    </svg>
  );
}
