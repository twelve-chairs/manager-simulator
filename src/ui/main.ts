import bundle from 'virtual:situations';
import { lineManagerLevel } from '../levels/line-manager';
import { conductReview } from '../review';
import { loadContent } from '../situations';
import { createApp } from './app';
import './style.css';

const { situations, errors } = loadContent(bundle);

/** A new run's seed: the only randomness outside the game's seeded generators, shown to the player. */
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

createApp(document.getElementById('app')!, {
  content: situations,
  contentErrors: errors,
  showContentErrors: import.meta.env.DEV,
  deps: { levels: [lineManagerLevel], review: conductReview },
  newSeed,
});
