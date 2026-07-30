import type { ReactNode } from 'react';

export interface Theme {
  accentColor: string;
  panelName: string;
  panelIcon: string;
  cardStyle: string;
  background: string;
  font: string;
  attribution: boolean;
  setupComplete: boolean;
  [key: string]: unknown;
}

export interface ThemeContextValue {
  theme: Theme;
  loading: boolean;
  refresh: () => Promise<Theme>;
  previewTheme: (patch: Partial<Theme>) => void;
}

export function applyTheme(theme: Theme | null): void;
export function ThemeProvider(props: { children: ReactNode }): JSX.Element;
export function useTheme(): ThemeContextValue;
