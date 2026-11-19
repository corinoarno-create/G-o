// Graphiques de « Ma progression », dessinés à la main en SVG (pas de bibliothèque) dans le style du carnet.
// Couleurs vérifiées pour le daltonisme (validateur de palette) : bleu-vert / terracotta / bleu.
// Survol : une infobulle native (<title>) sur chaque barre ou point, avec une zone de survol plus large que la marque.
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Couleurs des séries (ordre fixe). */
export const SERIES_COLORS = {
  correct: '#008f86',
  wrong: '#c8623b',
  pin: '#008f86',
  type: '#c8623b',
  choice: '#2f6db5',
} as const;

/** Largeur disponible, mesurée en continu : les graphiques se dessinent en pixels réels (textes lisibles sur téléphone). */
function useWidth(): [{ current: HTMLDivElement | null }, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.floor(element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Barre aux coins du haut arrondis (le bas reste posé sur la ligne de base). */
function barPath(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.min(radius, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Graduation « ronde » au-dessus d'une valeur (1, 2, 5, 10, 20, 50…). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

const shortDate = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
const longDate = (date: Date) => date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function Legend({ items }: { items: Array<{ label: string; color: string; line?: boolean }> }) {
  return (
    <ul class="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span class={`chart-legend__swatch ${item.line ? 'is-line' : ''}`} style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ChartFrame({ label, children }: { label: string; children: (width: number) => ComponentChildren }) {
  const [ref, width] = useWidth();
  return (
    <div class="chart" ref={ref} role="img" aria-label={label}>
      {width > 0 && children(width)}
    </div>
  );
}

const PAD = { top: 12, right: 8, bottom: 24, left: 30 };

/** Lignes de graduation horizontales (discrètes) et leurs valeurs. */
function YGrid({ width, height, max, format }: { width: number; height: number; max: number; format: (v: number) => string }) {
  const plotHeight = height - PAD.top - PAD.bottom;
  return (
    <g class="chart-grid">
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + plotHeight * (1 - t);
        return (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
            <text x={PAD.left - 6} y={y + 4} text-anchor="end">
              {format(max * t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Activité : premières réponses justes et à revoir, jour par jour (barres empilées). */
export function ActivityChart({ data }: { data: Array<{ day: Date; correct: number; wrong: number }> }) {
  const total = data.reduce((sum, d) => sum + d.correct + d.wrong, 0);
  return (
    <ChartFrame label={`Activité des ${data.length} derniers jours : ${total} premières réponses`}>
      {(width) => {
        const height = 170;
        const plotWidth = width - PAD.left - PAD.right;
        const plotHeight = height - PAD.top - PAD.bottom;
        const max = niceMax(Math.max(...data.map((d) => d.correct + d.wrong), 1));
        const slot = plotWidth / data.length;
        const barWidth = Math.max(2, Math.min(18, slot - 3));
        const scale = (v: number) => (v / max) * plotHeight;
        const baseline = PAD.top + plotHeight;
        return (
          <svg width={width} height={height}>
            <YGrid width={width} height={height} max={max} format={(v) => String(Math.round(v))} />
            {data.map((d, i) => {
              const x = PAD.left + i * slot + (slot - barWidth) / 2;
              const correctHeight = scale(d.correct);
              const wrongHeight = scale(d.wrong);
              // 2 px de papier entre les deux segments.
              const gap = d.correct && d.wrong ? 2 : 0;
              return (
                <g key={i} class="chart-hover">
                  <title>{`${longDate(d.day)} : ${d.correct} juste${d.correct > 1 ? 's' : ''}, ${d.wrong} à revoir`}</title>
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotHeight} fill="transparent" />
                  {d.correct > 0 && (
                    <path
                      d={
                        wrongHeight
                          ? `M${x},${baseline}V${baseline - correctHeight}H${x + barWidth}V${baseline}Z`
                          : barPath(x, baseline - correctHeight, barWidth, correctHeight, 4)
                      }
                      fill={SERIES_COLORS.correct}
                    />
                  )}
                  {d.wrong > 0 && (
                    <path
                      d={barPath(x, baseline - correctHeight - gap - wrongHeight, barWidth, wrongHeight, 4)}
                      fill={SERIES_COLORS.wrong}
                    />
                  )}
                  {(i % 7 === data.length % 7 || i === data.length - 1) && (
                    <text class="chart-axis" x={x + barWidth / 2} y={height - 6} text-anchor="middle">
                      {i === data.length - 1 ? 'auj.' : shortDate(d.day)}
                    </text>
                  )}
                </g>
              );
            })}
            <line class="chart-baseline" x1={PAD.left} x2={width - PAD.right} y1={baseline} y2={baseline} />
          </svg>
        );
      }}
    </ChartFrame>
  );
}

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  values: Array<number | null>;
}

/** Courbes semaine par semaine (une seule échelle verticale). Les semaines sans mesure laissent un trou. */
export function LineChart({
  labels,
  series,
  format,
  ariaLabel,
}: {
  labels: Date[];
  series: LineSeries[];
  format: (value: number) => string;
  ariaLabel: string;
}) {
  return (
    <ChartFrame label={ariaLabel}>
      {(width) => {
        const height = 180;
        const left = 40;
        const right = series.length > 1 ? 64 : 16; // place pour les étiquettes en bout de courbe
        const plotWidth = width - left - right;
        const plotHeight = height - PAD.top - PAD.bottom;
        const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
        const max = niceMax(Math.max(...all, 1) * 1.1);
        const x = (i: number) => left + (labels.length > 1 ? (i / (labels.length - 1)) * plotWidth : plotWidth / 2);
        const y = (v: number) => PAD.top + plotHeight * (1 - v / max);
        return (
          <svg width={width} height={height}>
            <g class="chart-grid">
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line x1={left} x2={left + plotWidth} y1={y(max * t)} y2={y(max * t)} />
                  <text x={left - 6} y={y(max * t) + 4} text-anchor="end">
                    {format(max * t)}
                  </text>
                </g>
              ))}
            </g>
            {labels.map((date, i) => (
              <text key={i} class="chart-axis" x={x(i)} y={height - 6} text-anchor="middle">
                {i === labels.length - 1 ? 'cette sem.' : i % 2 === (labels.length - 1) % 2 ? shortDate(date) : ''}
              </text>
            ))}
            {series.map((s) => {
              // Tracé en morceaux : une semaine sans mesure coupe la courbe.
              const segments: string[] = [];
              let current = '';
              s.values.forEach((v, i) => {
                if (v === null) {
                  if (current) segments.push(current);
                  current = '';
                } else current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
              });
              if (current) segments.push(current);
              const lastIndex = s.values.map((v, i) => (v === null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
              return (
                <g key={s.id}>
                  {segments.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                  ))}
                  {s.values.map((v, i) =>
                    v === null ? null : (
                      <g key={i} class="chart-hover">
                        <title>{`${s.label}, semaine du ${shortDate(labels[i]!)} : ${format(v)}`}</title>
                        <circle cx={x(i)} cy={y(v)} r="12" fill="transparent" />
                        <circle cx={x(i)} cy={y(v)} r="4" fill={s.color} stroke="var(--paper-light)" stroke-width="2" />
                      </g>
                    ),
                  )}
                  {series.length > 1 && lastIndex >= 0 && (
                    <text class="chart-direct" x={x(lastIndex) + 8} y={y(s.values[lastIndex]!) + 4}>
                      {s.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line class="chart-baseline" x1={left} x2={left + plotWidth} y1={y(0)} y2={y(0)} />
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/** Révisions prévues sur les prochains jours (une barre par jour, avec sa valeur). */
export function UpcomingChart({ data }: { data: Array<{ day: Date; count: number }> }) {
  return (
    <ChartFrame label={`Révisions prévues : ${data.map((d) => d.count).join(', ')}`}>
      {(width) => {
        const height = 140;
        const top = 20;
        const bottom = 24;
        const plotHeight = height - top - bottom;
        const max = Math.max(...data.map((d) => d.count), 1);
        const slot = width / data.length;
        const barWidth = Math.min(36, slot - 10);
        const baseline = top + plotHeight;
        return (
          <svg width={width} height={height}>
            {data.map((d, i) => {
              const h = (d.count / max) * plotHeight;
              const x = i * slot + (slot - barWidth) / 2;
              const label = i === 0 ? 'auj.' : d.day.toLocaleDateString('fr-FR', { weekday: 'short' });
              return (
                <g key={i} class="chart-hover">
                  <title>{`${longDate(d.day)} : ${d.count} révision${d.count > 1 ? 's' : ''}`}</title>
                  <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
                  {d.count > 0 && <path d={barPath(x, baseline - h, barWidth, h, 4)} fill={SERIES_COLORS.choice} />}
                  <text class="chart-value" x={x + barWidth / 2} y={baseline - h - 6} text-anchor="middle">
                    {d.count}
                  </text>
                  <text class="chart-axis" x={x + barWidth / 2} y={height - 6} text-anchor="middle">
                    {label}
                  </text>
                </g>
              );
            })}
            <line class="chart-baseline" x1={0} x2={width} y1={baseline} y2={baseline} />
          </svg>
        );
      }}
    </ChartFrame>
  );
}
