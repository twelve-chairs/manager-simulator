import { behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import { band, isEngineer, nameOf, teamEngineers, teamProjects } from './core';
import { goalStatus } from './goals';
import { WORK_LABELS } from './work';
import type { LevelMoment, LineState, View } from './types';

export { band };

/** A moment's heading and the scene it sets. */
export function describeMoment(level: LineState, sim: SimState, m: LevelMoment): { title: string; text: string; difficulty?: number } {
  if (m.kind === 'interview') return { title: 'Interview', text: 'A candidate for the open role is in the building this afternoon. Who talks to them?' };
  if (m.kind === 'checkIn') {
    const p = sim.projects[m.ref];
    const name = p?.name ?? m.ref;
    return { title: `Check-in: ${name}`, text: `Monday's project check-in. ${name} is ${p && p.deadlineWeek < sim.week ? 'overdue' : 'in trouble or at risk'}. What do you do about it?` };
  }
  const item = level.items.find((i) => i.id === m.ref);
  const about = item ? (item.subject.kind === 'project' ? (sim.projects[item.subject.id]?.name ?? '') : nameOf(sim, item.subject.id)) : '';
  const difficulty = item ? { difficulty: band(item.difficulty) } : {};
  if (m.kind === 'onCall') return { title: 'Night page', text: `${about} is down, and ${nameOf(sim, m.personId!)} is on call.`, ...difficulty };
  switch (item?.kind) {
    case 'designReview':
      return { title: 'Design review', text: `${about} needs a design reviewed before the team builds on it.`, ...difficulty };
    case 'customerRequest':
      return { title: 'Customer request', text: `A customer is asking for a change to ${about}.`, ...difficulty };
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
        memory: p.history
          .filter((h) => h.note)
          .slice(-3)
          .reverse()
          .map((h) => h.note!),
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
    player: { energy: band(100 - sim.player.stress), reputation: band(sim.player.reputation) },
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
  };
}
