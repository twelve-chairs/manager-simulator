/** Words for bands 0 to 4, per kind of value. Skill and work difficulty share words so they compare directly. */
// @spec UI-BAND-001
export const BAND_WORDS = {
  motivation: ['struggling', 'flat', 'fine', 'good', 'energized'],
  stress: ['calm', 'steady', 'busy', 'strained', 'overwhelmed'],
  energy: ['running on fumes', 'tired', 'okay', 'good', 'fresh'],
  skill: ['learning', 'developing', 'capable', 'strong', 'expert'],
  risk: ['low', 'moderate', 'elevated', 'high', 'severe'],
  reputation: ['poor', 'mixed', 'fair', 'good', 'excellent'],
  trust: ['wary', 'guarded', 'neutral', 'trusting', 'loyal'],
} as const;

export const bandWord = (kind: keyof typeof BAND_WORDS, band: number) => BAND_WORDS[kind][Math.max(0, Math.min(4, band))]!;
