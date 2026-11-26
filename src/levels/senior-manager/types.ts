/** How closely the player manages one of their managers. */
export type Oversight = 'handsOff' | 'coaching' | 'close';

export interface SeniorHabits {
  /** Per manager id. */
  oversight: Record<string, Oversight>;
  oneOnOnes: 'weekly' | 'fortnightly' | 'monthly';
  backfill: 'fast' | 'holdTheBar';
  skipLevel: 'none' | 'monthly';
  /** New work for an idle team: the player decides each time, or the player's manager gives it to a team with room. */
  newWork: 'ask' | 'assign';
}

/** A head a team has lost and not yet replaced. */
export interface Backfill {
  teamId: string;
  /** The game week the head was lost. */
  since: number;
  /** Month ends the head has been missing for. */
  months: number;
}

/** A team's heads at each performance level. */
export type RatingCounts = Record<'unrated' | 'below' | 'partial' | 'meets' | 'exceeds' | 'outstanding', number>;

export type SeniorMomentKind =
  | 'finalEvaluation'
  | 'replaceManager'
  | 'calibration'
  | 'surfaced'
  | 'escalation'
  | 'staffing'
  | 'dispute'
  | 'approval'
  | 'newWork'
  | 'restructuring';

/** One team in the calibration moment: what it delivered, what its manager proposes, and what the player settled on. */
export interface CalibrationEntry {
  teamId: string;
  managerId: string | null;
  delivered: RatingCounts;
  proposed: RatingCounts;
  final: RatingCounts | null;
}

export type GoalKind = 'growManager' | 'zeroRegretted' | 'shipProject' | 'unstrainTeam';

export interface SeniorGoal {
  id: string;
  kind: GoalKind;
  /** The game week the goal was set. */
  week: number;
  managerId?: string;
  /** For growing a manager: the skill band to reach. */
  targetBand?: number;
  projectId?: string;
  /** For shipping a project: its deadline as it stood when the goal was set. */
  deadlineWeek?: number;
  teamId?: string;
}

/** What the player could see at a month's start, for the recap to compare against. */
export interface MonthStart {
  week: number;
  managers: Record<string, { motivation: number; stress: number; skill: number }>;
  teams: Record<string, { motivation: number; stress: number; attritionRisk: number; headcount: number }>;
  projects: Record<string, string>;
}

/** One of the month's moments: a scene with a few choices. */
export interface SeniorMoment {
  id: string;
  kind: SeniorMomentKind;
  /** The week of the month, 0 to 3. */
  week: number;
  /** 0 is Monday, 4 is Friday. */
  day: number;
  time: 'morning' | 'afternoon' | 'night';
  status: 'open' | 'answered' | 'waited';
  title: string;
  text: string;
  teamId?: string;
  otherTeamId?: string;
  projectId?: string;
  otherProjectId?: string;
  /** For an approval: what the manager proposes. */
  detail?: 'promote' | 'letGo';
  /** For a final evaluation: the manager. */
  managerId?: string;
  /** For new work for the group: what kind of offer it is. */
  offer?: 'launch' | 'handover' | 'own';
  /** For a surfaced problem: which problem it is, so the answer can be recorded against it. */
  issue?: string;
  /** For calibration: each team's proposal. */
  calibration?: CalibrationEntry[];
  /** For calibration: the most top ratings the group may hold. */
  curve?: number;
  /** For calibration settled over the curve: the top ratings the group holds, and the curve's room. */
  overCurve?: { held: number; room: number };
  choices: { id: string; label: string }[];
}

export interface SeniorState {
  /** The level's own generator, apart from the simulation's and the situation engine's. */
  rngState: number;
  /** The game week the level began; its months and reviews count from here. */
  startWeek: number;
  /** The player's group, the old team first. */
  teamIds: string[];
  /** Per manager id: how many rating steps their proposals run above what their team delivered. Never shown. */
  leniency: Record<string, number>;
  habits: SeniorHabits;
  /** Managers whose want a 1:1 has revealed. */
  learnedWants: Record<string, true>;
  /** Teams a skip-level session listened to this month. */
  listenedTo: string[];
  backfills: Backfill[];
  /** Per manager id: months in a row under close oversight. */
  closeMonths: Record<string, number>;
  /** The next team a skip-level session listens to, as an index into the group. */
  skipRotation: number;
  /** Problems skip-level listening surfaced, to become moments next month. */
  surfaced: { teamId: string; week: number }[];
  /** Each team's surfaced problems the player has answered, by problem: when, how, and whether the answer settled it. */
  issues: Record<string, Record<string, { week: number; settled: boolean; answer: 'coach' | 'stepIn' | 'letThem' }>>;
  /** Months in a row the player has ended at the edge. */
  burnoutMonths: number;
  /** Each team's headcount as the level last saw it, so a lost head can be noticed. */
  knownHeadcount: Record<string, number>;
  /** Each team's rating counts as the level last saw them, so heads lost from them can be counted. */
  knownRatings: Record<string, RatingCounts>;
  /** Heads rated meets or better that left, by the week they left. */
  regretted: { week: number; count: number }[];
  /** Heads each team lost while the simulation advanced, by the week the month began: how many, and how many rated meets or better. */
  headsLost: { week: number; teamId: string; count: number; regretted: number }[];
  /** Per project id: the week it was completed. */
  completions: Record<string, number>;
  /** The review period's start: when, the managers' average skill, and each team's health bands. */
  periodStart: { week: number; skill: number; health: Record<string, { motivation: number; stress: number }> };
  /** The month's moments, in the order they play. */
  moments: SeniorMoment[];
  /** Per team id: the week its manager last asked for an approval. */
  lastApproval: Record<string, number>;
  /** Pairs of teams whose dispute the player agreed or decided, and the week they settled it. */
  settledDisputes: { teams: [string, string]; week: number }[];
  /** Whether the group has been offered its fourth team. */
  restructured: boolean;
  /** Per team id: the week a manager hired from outside starts leading it; until then the team is leaderless. */
  arriving: Record<string, number>;
  /** Managers on a plan whose third low rating is held for a final evaluation. */
  heldEvaluations: string[];
  /** Each calibration's average gap, in rating steps, between the ratings settled and what the teams delivered. */
  calibrations: { week: number; gap: number }[];
  /** The review period's goals. */
  goals: SeniorGoal[];
  /** What the player could see when the month began. */
  monthStart: MonthStart | null;
  /** Managers who joined the group after the handover, and those the player let go, for the career summary. */
  joinedManagers: string[];
  letGoManagers: string[];
  counters: { person: number; team: number; project: number; hire: number; moment: number; goal: number };
}
