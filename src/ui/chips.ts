import type { Chip } from './app';

/** Records a chip when a band moved, good or bad by which way is better. */
export type Mover = (key: string, who: string, was: number, now: number, upIsGood: boolean, up: string, down: string) => void;

/** A mover that adds its chips to `out`. */
export const moverInto =
  (out: Chip[]): Mover =>
  (key, who, was, now, upIsGood, up, down) => {
    if (was !== now) out.push({ key, text: `${who}: ${now > was ? up : down}`, tone: now > was === upIsGood ? 'good' : 'bad' });
  };

/** A change in a team's or group's headcount, in words. */
export function headcountWords(d: number): string {
  if (d === 1) return 'one more person';
  if (d > 1) return `${d} more people`;
  return d === -1 ? 'one person fewer' : `${-d} people fewer`;
}
