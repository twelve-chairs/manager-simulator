/**
 * The player action catalogue: every action id a career level uses as a cause, by the level that declares it.
 * Situation content may name these in `history` conditions; the content validator checks them against this list.
 */
// @spec SIT-CONTENT-021, LINE-STATE-004
export const PLAYER_ACTIONS = {
  'line-manager': [
    'line-manager.habit.night-pages',
    'line-manager.habit.one-on-ones',
    'line-manager.habit.approvals',
    'line-manager.habit.ceremonies',
    'line-manager.habit.growth',
    'line-manager.self',
    'line-manager.delegate',
    'line-manager.on-call',
    'line-manager.check-in',
    'line-manager.interview',
    'line-manager.accept-intake',
    'line-manager.decline-intake',
    'line-manager.pay-down',
    'line-manager.smaller-change',
  ],
} as const;

export const PLAYER_ACTION_IDS: readonly string[] = Object.values(PLAYER_ACTIONS).flat();
