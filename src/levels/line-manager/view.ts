import { behindScheduleProjects, overdueProjects, type HistoryEntry, type SimState } from '../../sim';
import { band, isEngineer, nameOf, teamEngineers, teamProjects } from './core';
import { goalStatus } from './goals';
import { HABIT_CAUSE, LINE_TUNING } from './tuning';
import { NAMES } from './names';
import { WORK_LABELS, itemNumber } from './work';
import type { LevelMoment, LineState, View, WorkItem } from './types';

export { band };

const habitCauses = new Set<string>(Object.values(HABIT_CAUSE));

/** Tech debt bands in the words the UI shows for them (UI-BAND-001), for the text of a design review. */
const DEBT_WORDS = ['low', 'moderate', 'elevated', 'high', 'severe'] as const;

/** Phrasings for routine work, picked by the item's number so the same week reads the same on replay. */
const DESIGN_REVIEW = [
  '{project} needs a design reviewed before the team builds on it. Its tech debt is {debt}, and if nobody reviews the design in time, the debt rises.',
  'A design for {project} is waiting for review. Its tech debt is {debt}, and if the team builds on an unreviewed design, the debt rises.',
  'The next part of {project} rests on a design nobody has checked yet. The project’s tech debt is {debt}, and if the review never happens, the debt rises.',
];
const CUSTOMER_REQUEST = [
  '{customer} is asking for a change to {project}. If nobody answers in time, your reputation slips.',
  '{customer} wants {project} to work differently for them, and soon. Leave them waiting and your reputation slips.',
  'A request from {customer} about {project} has reached your team. If it goes unanswered, your reputation slips.',
];
const pick = (phrasings: readonly string[], item: WorkItem) => phrasings[itemNumber(item) % phrasings.length]!;

/** The history an engineer remembers: entries with a note, leaving out a habit's routine notes such as each 1:1. */
// @spec LINE-VIS-011
const remembered = (history: HistoryEntry[]) => history.filter((h) => h.note && !(h.cause.kind === 'action' && habitCauses.has(h.cause.actionId)));

/** Notes, newest first, with a note repeated back to back shown once with how many times. */
function collapsed(notes: string[]): string[] {
  const lines: { note: string; times: number }[] = [];
  for (const note of notes) {
    const last = lines.at(-1);
    if (last?.note === note) last.times++;
    else lines.push({ note, times: 1 });
  }
  return lines.map(({ note, times }) => (times === 1 ? note : `${note}, ${times === 2 ? 'twice' : `${times} times`}`));
}

/** Why a project is due a check-in, as the rest of a sentence about it: the first that holds of overdue, behind schedule and high risk. */
// @spec LINE-CHECK-007
function checkInReason(sim: SimState, projectId: string): string {
  if (overdueProjects(sim).some((p) => p.id === projectId)) return 'is overdue';
  if (behindScheduleProjects(sim).some((p) => p.id === projectId)) return 'is behind schedule';
  return 'is at high risk';
}

/** A moment's heading and the scene it sets. */
export function describeMoment(level: LineState, sim: SimState, m: LevelMoment): { title: string; text: string; difficulty?: number } {
  if (m.kind === 'finalEvaluation') return { title: `Final evaluation: ${nameOf(sim, m.ref)}`, text: `${nameOf(sim, m.ref)} is on an improvement plan, and this quarter's work would be their third low rating in a row. A third ends the plan. It's your call.` };
  if (m.kind === 'interview') return { title: 'Interview', text: 'A candidate for the open role is in the building this afternoon. Who talks to them?' };
  if (m.kind === 'checkIn') {
    const p = sim.projects[m.ref];
    const name = p?.name ?? m.ref;
    return { title: `Check-in: ${name}`, text: `Monday's project check-in. ${name} ${checkInReason(sim, m.ref)}. What do you do about it?` };
  }
  const item = level.items.find((i) => i.id === m.ref);
  const about = item ? (item.subject.kind === 'project' ? (sim.projects[item.subject.id]?.name ?? '') : nameOf(sim, item.subject.id)) : '';
  const difficulty = item ? { difficulty: band(item.difficulty) } : {};
  // @spec LINE-MOMENT-005
  if (m.kind === 'onCall') return { title: 'Night page', text: `A change from ${about} has taken production down, and ${nameOf(sim, m.personId!)} is on call.`, ...difficulty };
  switch (item?.kind) {
    // @spec LINE-MOMENT-006
    case 'designReview': {
      const debt = DEBT_WORDS[Math.min(4, band(sim.projects[item.subject.id]?.techDebt ?? 0))]!;
      return { title: 'Design review', text: pick(DESIGN_REVIEW, item).replaceAll('{project}', about).replaceAll('{debt}', debt), ...difficulty };
    }
    // @spec LINE-MOMENT-007
    case 'customerRequest': {
      const customer = NAMES.customers[itemNumber(item) % NAMES.customers.length]!;
      return { title: 'Customer request', text: pick(CUSTOMER_REQUEST, item).replaceAll('{project}', about).replaceAll('{customer}', customer), ...difficulty };
    }
    case 'workIntake':
      return { title: 'New work on offer', text: 'Another team has work it wants yours to take on as a new project.', ...difficulty };
    default:
      return { title: item ? WORK_LABELS[item.kind] : 'Work', text: about, ...difficulty };
  }
}

/** What the player can see: exact where a manager would know, bands where they would only have a sense. */
// @spec LINE-VIS-001, LINE-VIS-002, LINE-VIS-003, LINE-VIS-004, LINE-VIS-005, LINE-VIS-006, LINE-VIS-011, LINE-VIS-012, LINE-VIS-013, LINE-GOAL-002
export function view(level: LineState, sim: SimState): View {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  return {
    people: teamEngineers(level, sim).map((id) => {
      const p = sim.people[id]!;
      return {
        id,
        name: p.name,
        role: p.role,
        tenureWeeks: sim.week - p.joinedWeek,
        personality: p.personality,
        performance: p.performance,
        motivation: band(p.motivation),
        stress: band(p.stress),
        skill: band(p.skill),
        want: Object.hasOwn(level.learnedWants, id) ? level.learnedWants[id]!.want : ('unknown' as const),
        memory: collapsed(remembered(p.history).map((h) => h.note!).reverse()).slice(0, 3),
        notes: remembered(p.history).length,
        lastNote: remembered(p.history).at(-1)?.note ?? null,
      };
    }),
    projects: teamProjects(level, sim).map((id) => {
      const p = sim.projects[id]!;
      return {
        id,
        name: p.name,
        progress: p.progress,
        scope: p.scope,
        deadlineWeek: p.deadlineWeek,
        schedule: overdue.has(id) ? ('overdue' as const) : behind.has(id) ? ('behind' as const) : ('onSchedule' as const),
        risk: band(p.risk),
        techDebt: band(p.techDebt),
      };
    }),
    player: {
      energy: band(100 - sim.player.stress),
      reputation: band(sim.player.reputation),
      // @spec LINE-VIS-015
      edge: { at: sim.player.stress >= LINE_TUNING.burnoutThreshold, weeks: level.burnoutWeeks, limit: LINE_TUNING.burnoutWeeks },
    },
    habits: { ...level.habits },
    vacancies: structuredClone(level.vacancies),
    goals: level.goals.map((g) => {
      const status = goalStatus(g, level, sim);
      return { id: g.id, text: status.text, progress: status.progress };
    }),
    moments: level.moments
      .filter((m) => m.week === sim.week)
      .map((m) => {
        const { week: _week, ...rest } = structuredClone(m);
        // A choice that names someone who has since left can no longer be made.
        const gone = (c: { id: string }) => /^(give|ask):/.test(c.id) && !isEngineer(level, sim, c.id.slice(c.id.indexOf(':') + 1));
        return { ...rest, choices: rest.choices.filter((c) => !gone(c)), ...describeMoment(level, sim, m) };
      }),
    career: career(level, sim),
  };
}

/** The run so far: projects shipped by their deadline, who joined the team after it started, and who left and why. */
// @spec LINE-VIS-014
function career(level: LineState, sim: SimState): View['career'] {
  const shippedOnTime = Object.entries(level.completions).filter(([id, when]) => {
    const p = sim.projects[id];
    return p !== undefined && when <= p.deadlineWeek;
  }).length;
  const members = Object.values(sim.people).filter((p) => p.teamId === level.teamId && p.role === 'engineer');
  return {
    shippedOnTime,
    joined: members.filter((p) => p.joinedWeek > 0).map((p) => ({ id: p.id, name: p.name })),
    left: members
      .filter((p) => p.status === 'departed' && p.departure)
      .sort((a, b) => a.departure!.week - b.departure!.week)
      .map((p) => ({ id: p.id, name: p.name, reason: p.departure!.reason })),
  };
}
