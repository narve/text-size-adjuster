export type WidgetPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type WidgetVisibility = 'always' | 'on-zoom';

export const DEFAULT_POSITION: WidgetPosition = 'bottom-right';

const POSITIONS: Record<string, WidgetPosition> = {
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right',
  tl: 'top-left',
  tr: 'top-right',
  bl: 'bottom-left',
  br: 'bottom-right',
};

const VISIBILITIES: Record<string, WidgetVisibility> = {
  always: 'always',
  'on-zoom': 'on-zoom',
};

/** Accepts long (`top-left`) and short (`tl`) forms, case-insensitively; anything else → null. */
export function parsePosition(value: string | null | undefined): WidgetPosition | null {
  if (!value) return null;
  return POSITIONS[value.trim().toLowerCase()] ?? null;
}

/** Accepts `always` or `on-zoom`, case-insensitively; anything else → null. */
export function parseShow(value: string | null | undefined): WidgetVisibility | null {
  if (!value) return null;
  return VISIBILITIES[value.trim().toLowerCase()] ?? null;
}
