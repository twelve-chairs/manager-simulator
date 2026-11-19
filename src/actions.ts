/**
 * The player action catalogue: every action id a career level uses as a cause, by the level that declares it.
 * Situation content may name these in `history` conditions; the content validator checks them against this list.
 */
// @spec SIT-CONTENT-021, LINE-ACT-014
export const PLAYER_ACTIONS = {
  'line-manager': [
    'line-manager.one-on-one',
    'line-manager.coaching',
    'line-manager.recognition',
    'line-manager.training',
    'line-manager.ceremonies',
    'line-manager.project-planning',
    'line-manager.scope-negotiation',
    'line-manager.team-event',
    'line-manager.interview',
    'line-manager.recovery',
    'line-manager.delegate',
    'line-manager.accept-intake',
    'line-manager.decline-intake',
  ],
} as const;

export const PLAYER_ACTION_IDS: readonly string[] = Object.values(PLAYER_ACTIONS).flat();
