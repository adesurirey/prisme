/*
 * PROTOTYPE (throwaway, issue #173) — hardcoded mirror of the decided
 * token mechanics (@prisme/tokens): two palette objects, picked by
 * useColorScheme(). Values copied from web/src/styles/global.css.
 */
import { useColorScheme } from 'react-native';

export const light = {
  canvas: '#fcfcfc',
  surface: '#ffffff',
  line: 'rgba(17,17,20,0.08)',
  lineStrong: 'rgba(17,17,20,0.18)',
  ink: '#1b1b1f',
  prose: '#52525b',
  muted: '#6f6f76',
  faint: '#a1a1aa',
  gauche: '#e0415e',
  centre: '#dfa414',
  droite: '#2e7ce4',
  onLeaning: '#ffffff',
  toggleTrack: '#f0f0f2',
  trending: '#0d9488',
};

export const dark = {
  canvas: '#0e0e10',
  surface: '#151517',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.22)',
  ink: '#e6e6ea',
  prose: '#c9c9d0',
  muted: '#9b9ba3',
  faint: '#6c6c75',
  gauche: '#f28498',
  centre: '#f6c65b',
  droite: '#63a8ea',
  onLeaning: '#1b1b1f',
  toggleTrack: '#26262b',
  trending: '#2dd4bf',
};

export type Palette = typeof light;
export type Group = 'gauche' | 'centre' | 'droite';
export const GROUPS: Group[] = ['gauche', 'centre', 'droite'];
export const GROUP_LABELS: Record<Group, string> = {
  gauche: 'Gauche',
  centre: 'Centre',
  droite: 'Droite',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
