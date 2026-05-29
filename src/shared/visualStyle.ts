export type AppVisualStyle = 'kurzgesagt';

export const DEFAULT_VISUAL_STYLE: AppVisualStyle = 'kurzgesagt';

export function isAppVisualStyle(value: unknown): value is AppVisualStyle {
  return value === DEFAULT_VISUAL_STYLE;
}
