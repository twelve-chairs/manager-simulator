import bundle from 'virtual:situations';
import { lineManagerLevel } from '../levels/line-manager';
import { seniorManagerLevel } from '../levels/senior-manager';
import { directorLevel } from '../levels/director';
import { vpLevel } from '../levels/vp';
import { conductReview } from '../review';
import { loadContent } from '../situations';
import { createApp, type SaveStorage } from './app';
import './style.css';

const { situations, errors } = loadContent(bundle);

/** A new run's seed: the only randomness outside the game's seeded generators. It is saved, never shown. */
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** The browser's storage, or one that always fails when even reaching it throws (some privacy settings), so the game says it cannot save. */
function browserStorage(): SaveStorage {
  try {
    return window.localStorage;
  } catch {
    const fail = () => {
      throw new Error('storage unavailable');
    };
    return { getItem: fail, setItem: fail, removeItem: fail };
  }
}

createApp(document.getElementById('app')!, {
  content: situations,
  contentErrors: errors,
  showContentErrors: import.meta.env.DEV,
  // A promotion hands the run up a level (UI-SHELL-013), to the VP at the top (UI-VP-013).
  deps: { levels: [lineManagerLevel, seniorManagerLevel, directorLevel, vpLevel], review: conductReview },
  newSeed,
  version: __APP_VERSION__,
  storage: browserStorage(),
});
