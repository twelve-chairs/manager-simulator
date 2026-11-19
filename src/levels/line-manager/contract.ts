import type { CareerLevel } from '../../loop/types';
import { editCalendar } from './calendar';
import { commitWeek, invalidDecision } from './commit';
import { arriveDemands } from './inbox';
import { afterAdvance, assess, scorecard } from './review';
import { LEVEL, startRun } from './start';
import type { LinePlan, LinePlanCommand, LineState } from './types';
import { view } from './view';

/** The line manager level as the turn loop sees it. */
// @spec LINE-CONTRACT-001, LINE-CONTRACT-002, LINE-CONTRACT-003
export const lineManagerLevel: CareerLevel<LineState, LinePlan, LinePlanCommand> = {
  params: LEVEL,
  start: startRun,
  beginWeek: arriveDemands,
  emptyPlan: () => ({ decisions: {} }),
  updatePlan(level, sim, plan, command) {
    // Commands can come back from a saved run, so their shape is checked rather than trusted.
    if (typeof command !== 'object' || command === null) return { ok: false, error: 'a planning command must be an object' };
    switch (command.kind) {
      case 'calendar': {
        const edited = editCalendar(level, sim, command);
        return edited.ok ? { ok: true, level: edited.level, plan } : edited;
      }
      case 'decide': {
        if (typeof command.demandId !== 'string') return { ok: false, error: 'a decision names a demand' };
        const demand = level.inbox.find((d) => d.id === command.demandId);
        if (!demand) return { ok: false, error: `no demand ${command.demandId} in the inbox` };
        const error = invalidDecision(sim, demand, command.decision);
        if (error) return { ok: false, error };
        return { ok: true, level, plan: { decisions: { ...plan.decisions, [demand.id]: structuredClone(command.decision) } } };
      }
      case 'clear': {
        const rest = Object.fromEntries(Object.entries(plan.decisions).filter(([id]) => id !== command.demandId));
        return { ok: true, level, plan: { decisions: rest } };
      }
      default:
        return { ok: false, error: `unknown planning command ${String((command as { kind?: unknown }).kind)}` };
    }
  },
  commit: (level, sim, plan) => commitWeek(level, sim, plan.decisions),
  afterAdvance,
  scorecard,
  assess,
  view,
};
