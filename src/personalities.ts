/**
 * The personality catalogue: the traits career levels give people, and the only ones situation content may name.
 * A trait changes no simulation number; content conditions on it to choose which reaction a choice gets.
 */
// @spec SIT-CONTENT-025, LINE-ORG-004
export const PERSONALITIES = ['ambitious', 'quiet', 'eager', 'steady', 'blunt', 'anxious'] as const;

export type Personality = (typeof PERSONALITIES)[number];
