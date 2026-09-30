// The app's look. Two token sets live in styles/tokens.css; slice 6 picks one here.

export const THEMES = ['sunrise', 'midnight'] as const
export type Theme = (typeof THEMES)[number]

export const APP_THEME: Theme = 'sunrise'

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}
