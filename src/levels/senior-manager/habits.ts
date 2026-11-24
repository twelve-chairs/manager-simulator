import type { SeniorHabits } from './types';

/** The habits every senior manager starts with, but oversight, which is set per manager. */
// @spec SENIOR-HABIT-001
export const DEFAULT_SENIOR_HABITS: Omit<SeniorHabits, 'oversight'> = { oneOnOnes: 'fortnightly', backfill: 'holdTheBar', skipLevel: 'none', newWork: 'ask' };
