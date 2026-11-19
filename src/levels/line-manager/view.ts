import { behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import { plannedHours } from './commit';
import { teamEngineers, teamProjects } from './core';
import { LINE_TUNING } from './tuning';
import type { Band, LinePlan, LineState, View } from './types';

/** The band a 0–100 value falls in; every banded value uses this one scale. */
// @spec LINE-VIS-009
export const band = (value: number): Band => LINE_TUNING.bandEdges.filter((edge) => value >= edge).length;

/** What the player can see: exact where a manager would know, bands where they would only have a sense. */
// @spec LINE-VIS-001, LINE-VIS-002, LINE-VIS-003, LINE-VIS-004, LINE-VIS-005, LINE-VIS-006, LINE-VIS-007, LINE-VIS-008, LINE-VIS-010
export function view(level: LineState, sim: SimState, plan: LinePlan = { decisions: {} }): View {
  const hours = plannedHours(level, sim, plan.decisions);
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
        performance: p.performance,
        motivation: band(p.motivation),
        stress: band(p.stress),
        skill: band(p.skill),
        want: Object.hasOwn(level.learnedWants, id) ? level.learnedWants[id]!.want : ('unknown' as const),
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
    player: { reputation: band(sim.player.reputation), stress: band(sim.player.stress) },
    calendar: structuredClone(level.calendar),
    vacancies: structuredClone(level.vacancies),
    inbox: level.inbox.map((d) => ({ id: d.id, type: d.type, subject: { ...d.subject }, hours: d.hours, lastWeek: d.lastWeek, difficulty: band(d.difficulty) })),
    plannedHours: hours,
    overtime: Math.max(0, hours - LINE_TUNING.weeklyHours),
  };
}
