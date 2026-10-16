/**
 * Shared pieces of the "Mis à jour …" stamps (StoryHero, Story page): a
 * Paris-timezone day key for today/yesterday comparisons, a compact clock
 * ("18h45"), and the spelled-out day marker — "aujourd'hui à 18h45",
 * "hier à …", "le 11 oct. 2026 à …". Days are compared by their formatted
 * Paris date so the build host's timezone never leaks in. Callers pick
 * their own wording: the hero's single stamp drops "aujourd'hui" (the
 * bare clock already says "just now"), the Story page's two-half sentence
 * keeps it so both timestamps carry their day.
 */
import { formatParisDate } from './paris-date';

export const parisDayKey = (date: Date) =>
  formatParisDate(date, { day: 'numeric', month: 'short', year: 'numeric' });

export const parisTime = (date: Date) =>
  formatParisDate(date, { hour: '2-digit', minute: '2-digit' }).replace(
    ':',
    'h',
  );

export function dayStamp(date: Date): string {
  const k = parisDayKey(date);
  const now = new Date();
  if (k === parisDayKey(now)) return `aujourd’hui à ${parisTime(date)}`;
  if (k === parisDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000)))
    return `hier à ${parisTime(date)}`;
  return `le ${k} à ${parisTime(date)}`;
}
