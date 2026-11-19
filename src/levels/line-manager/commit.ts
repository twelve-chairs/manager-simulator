import { applyEffects, type Cause, type Effect, type SimState, type Want } from '../../sim';
import { generatePerson, generateProject, calmRisk, invalidTarget, peopleNames, projectNames, reconcileVacancies, runsIn, teamEngineers, teamProjects } from './core';
import { subjectValid } from './inbox';
import { ACCEPT_INTAKE, ACTIONS, DECLINE_INTAKE, DELEGATE, LINE_TUNING } from './tuning';
import type { CalendarEntry, CommitReport, CommitResult, Decision, Demand, LineState } from './types';

const action = (actionId: string): Cause => ({ kind: 'action', actionId });
const rule = (ruleId: string): Cause => ({ kind: 'rule', ruleId });
const NO_CEREMONIES = rule('line-manager.no-ceremonies');
const OVERTIME = rule('line-manager.overtime');
const EXPIRED = rule('line-manager.demand-expired');

const E = LINE_TUNING.effects;

const person = (id: string, field: string, amount: number, cause: Cause, extra: { serves?: Want[]; note?: string } = {}): Effect => ({
  type: 'value',
  target: { kind: 'person', id },
  field,
  amount,
  cause,
  ...(extra.serves && { wantTags: { serves: extra.serves } }),
  ...(extra.note && { historyNote: extra.note }),
});
const project = (id: string, field: string, amount: number, cause: Cause): Effect => ({ type: 'value', target: { kind: 'project', id }, field, amount, cause });
const player = (field: string, amount: number, cause: Cause): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause });

/** The effects of one calendar entry that runs this week. */
function entryEffects(level: LineState, sim: SimState, entry: CalendarEntry): Effect[] {
  const cause = action(entry.action);
  const id = 'id' in entry.target ? entry.target.id : '';
  switch (entry.action) {
    case 'line-manager.one-on-one':
      return [person(id, 'trust', E.oneOnOneTrust, cause, { note: '1:1' }), person(id, 'motivation', E.oneOnOneMotivation, cause)];
    case 'line-manager.coaching':
      return [person(id, 'skill', E.coachingSkill, cause, { serves: ['growth'], note: 'Coaching' })];
    case 'line-manager.recognition':
      return [person(id, 'motivation', E.recognitionMotivation, cause, { serves: ['recognition'], note: 'Recognized' })];
    case 'line-manager.training':
      return [person(id, 'skill', E.trainingSkill, cause, { serves: ['growth'], note: 'Training' }), person(id, 'stress', E.trainingStress, cause)];
    case 'line-manager.ceremonies':
      return teamEngineers(level, sim).map((p) => person(p, 'motivation', E.ceremoniesMotivation, cause, { serves: ['stability'] }));
    case 'line-manager.project-planning':
      return [project(id, 'risk', E.planningRisk, cause)];
    case 'line-manager.scope-negotiation':
      return [project(id, 'scope', -Math.max(1, Math.round(sim.projects[id]!.scope * E.scopeCut)), cause), player('reputation', E.scopeReputation, cause)];
    case 'line-manager.team-event':
      return teamEngineers(level, sim).flatMap((p) => [person(p, 'motivation', E.teamEventMotivation, cause), person(p, 'stress', E.teamEventStress, cause)]);
    case 'line-manager.recovery':
      return [player('stress', E.recoveryStress, cause)];
    case 'line-manager.interview':
      return []; // interviews change level state; a hire follows once a vacancy has enough of them
  }
}

/** The consequence of a demand left to expire, scaled down for a delegation that fell short. */
function consequence(demand: Demand, scale: number): Effect[] {
  const x = LINE_TUNING.expiry;
  const n = (amount: number) => Math.round(amount * scale);
  const id = demand.subject.id;
  switch (demand.type) {
    case 'approval':
      return [project(id, 'progress', n(x.approvalProgress), EXPIRED)];
    case 'designReview':
      return [project(id, 'techDebt', n(x.designReviewTechDebt), EXPIRED)];
    case 'customerRequest':
      return [player('reputation', n(x.customerRequestReputation), EXPIRED)];
    case 'onCall':
      return [player('reputation', n(x.onCallReputation), EXPIRED), project(id, 'risk', n(x.onCallRisk), EXPIRED)];
    case 'expense':
      return [person(id, 'motivation', n(x.expenseMotivation), EXPIRED)];
    case 'workIntake':
      return [player('reputation', n(x.workIntakeReputation), EXPIRED)];
  }
}

/** Why a decision is invalid for its demand, or undefined when it is allowed. */
export function invalidDecision(sim: SimState, demand: Demand, decision: Decision): string | undefined {
  if (typeof decision !== 'object' || decision === null) return `${demand.id}: a decision must be an object`;
  if (decision.kind === 'delegate' && typeof decision.to !== 'string') return `${demand.id}: a delegation names a person`;
  const intake = demand.type === 'workIntake';
  switch (decision.kind) {
    case 'accept':
    case 'decline':
      return intake ? undefined : `${demand.id}: only work intake can be accepted or declined`;
    case 'handle':
      return intake ? `${demand.id}: work intake is accepted or declined, not handled` : undefined;
    case 'delegate':
      if (intake) return `${demand.id}: work intake cannot be delegated`;
      if (!Object.hasOwn(sim.people, decision.to)) return `${demand.id}: ${decision.to} is not a person`;
      if (demand.subject.kind === 'person' && demand.subject.id === decision.to) return `${demand.id}: a request cannot be delegated to its requester`;
      return undefined;
    default:
      return `${demand.id}: unknown decision`;
  }
}

/** Hours the week would charge: calendar entries that run with valid targets, and demands handled or accepted. */
// The commit charges exactly this, so the view's preview and the week's charge cannot disagree.
export function plannedHours(level: LineState, sim: SimState, decisions: Record<string, Decision>): number {
  const s = structuredClone(level);
  reconcileVacancies(s, sim);
  const entries = s.calendar.filter((e) => runsIn(e, sim.week) && !invalidTarget(s, sim, e.target));
  const demands = s.inbox.filter((d) => subjectValid(s, sim, d) && ['handle', 'accept'].includes(decisions[d.id]?.kind ?? ''));
  return entries.reduce((h, e) => h + ACTIONS[e.action].hours, 0) + demands.reduce((h, d) => h + d.hours, 0);
}

/** Applies the week's plan: calendar entries, demand decisions, overtime and expiries. */
// @spec LINE-CAL-002, LINE-CAL-003, LINE-CAL-005, LINE-CAL-006, LINE-CAL-007, LINE-CAL-008
// @spec LINE-ACT-001, LINE-ACT-002, LINE-ACT-003, LINE-ACT-004, LINE-ACT-005, LINE-ACT-006, LINE-ACT-007, LINE-ACT-008
// @spec LINE-ACT-009, LINE-ACT-010, LINE-ACT-011, LINE-ACT-012, LINE-ACT-013
// @spec LINE-INBOX-004, LINE-INBOX-005, LINE-INBOX-006, LINE-INBOX-007, LINE-INBOX-008, LINE-INBOX-009, LINE-INBOX-010
// @spec LINE-INBOX-011, LINE-INBOX-012, LINE-INBOX-013, LINE-INBOX-014, LINE-INBOX-015, LINE-INBOX-016, LINE-INBOX-017, LINE-HIRE-002, LINE-HIRE-003
export function commitWeek(level: LineState, sim: SimState, decisions: Record<string, Decision>): CommitResult {
  for (const [demandId, decision] of Object.entries(decisions)) {
    const demand = level.inbox.find((d) => d.id === demandId);
    if (!demand) return { ok: false, error: `no demand ${demandId} in the inbox` };
    const error = invalidDecision(sim, demand, decision);
    if (error) return { ok: false, error };
  }

  const s = structuredClone(level);
  const week = sim.week;
  const report: CommitReport = { hours: 0, overtime: 0, dropped: [], delegations: [], undelegated: [], voided: [], expired: [], demands: {} };
  const describe = (d: Demand) => (report.demands[d.id] = { type: d.type, subject: { ...d.subject } });
  const effects: Effect[] = [];
  reconcileVacancies(s, sim);

  // Calendar entries
  let ceremonies = false;
  const ran = new Set<string>();
  const roster = new Set(teamEngineers(s, sim));
  for (const entry of s.calendar) {
    // A stale entry is removed whether or not it would run this week, so the calendar never shows it.
    const reason = invalidTarget(s, sim, entry.target);
    if (reason) {
      report.dropped.push({ entryId: entry.id, reason });
      continue;
    }
    if (!runsIn(entry, week)) continue;
    ran.add(entry.id);
    effects.push(...entryEffects(s, sim, entry));
    if (entry.action === 'line-manager.ceremonies') ceremonies = true;
    if (entry.action === 'line-manager.one-on-one' && entry.target.kind === 'person') {
      s.learnedWants[entry.target.id] = { want: sim.people[entry.target.id]!.want, week };
    }
    const target = entry.target;
    if (entry.action === 'line-manager.interview' && target.kind === 'vacancy') {
      const vacancy = s.vacancies.find((v) => v.id === target.id);
      if (vacancy) vacancy.interviews += 1;
    }
  }
  const dropped = new Set(report.dropped.map((d) => d.entryId));
  s.calendar = s.calendar.filter((e) => !dropped.has(e.id) && !(e.cadence === 'once' && ran.has(e.id)));
  if (!ceremonies) for (const id of teamProjects(s, sim)) effects.push(project(id, 'risk', E.noCeremoniesRisk, NO_CEREMONIES));

  // Hires for vacancies with enough interviews
  const names = peopleNames(sim);
  for (const vacancy of s.vacancies.filter((v) => v.interviews >= LINE_TUNING.interviewsPerHire)) {
    const hire = generatePerson(s, names);
    names.push(hire.name);
    effects.push({ type: 'hire', teamId: s.teamId, person: hire, cause: action('line-manager.interview') });
    s.vacancies = s.vacancies.filter((v) => v !== vacancy);
  }

  // Inbox
  for (const demand of s.inbox) {
    if (!subjectValid(s, sim, demand) && decisions[demand.id]) {
      report.voided.push({ demandId: demand.id, reason: `the ${demand.subject.kind} ${demand.subject.id} is no longer there to act on` });
      describe(demand);
    }
  }
  s.inbox = s.inbox.filter((d) => subjectValid(s, sim, d));
  const decided = new Set<string>();
  const undone = new Set<string>();
  for (const demand of s.inbox) {
    const decision = decisions[demand.id];
    if (!decision) continue;
    switch (decision.kind) {
      case 'handle':
        decided.add(demand.id);
        break;
      case 'delegate': {
        if (!roster.has(decision.to)) {
          report.undelegated.push({ demandId: demand.id, reason: `${decision.to} is no longer an active engineer on the team` });
          undone.add(demand.id);
          describe(demand);
          break;
        }
        const succeeded = sim.people[decision.to]!.skill >= demand.difficulty;
        effects.push(person(decision.to, 'stress', E.delegateStress, action(DELEGATE), { serves: ['growth', 'autonomy'], note: `Took on a ${demand.type}` }));
        if (!succeeded) effects.push(person(decision.to, 'skill', E.delegateSkillOnStretch, action(DELEGATE)), ...consequence(demand, LINE_TUNING.reducedConsequence));
        report.delegations.push({ demandId: demand.id, to: decision.to, succeeded });
        describe(demand);
        decided.add(demand.id);
        break;
      }
      case 'accept': {
        const started = generateProject(s, projectNames(sim), s.teamId, week, calmRisk(s));
        effects.push({ type: 'startProject', project: started, cause: action(ACCEPT_INTAKE) });
        decided.add(demand.id);
        break;
      }
      case 'decline':
        effects.push(player('reputation', E.declineIntakeReputation, action(DECLINE_INTAKE)));
        decided.add(demand.id);
        break;
    }
  }
  for (const demand of s.inbox) {
    if (decided.has(demand.id) || demand.lastWeek > week) continue;
    if (undone.has(demand.id)) {
      // A situation undid the player's decision; give them another week rather than penalize it.
      demand.lastWeek = week + 1;
      continue;
    }
    effects.push(...consequence(demand, 1));
    report.expired.push(demand.id);
    describe(demand);
    decided.add(demand.id);
  }
  s.inbox = s.inbox.filter((d) => !decided.has(d.id));

  // Overtime
  report.hours = plannedHours(level, sim, decisions);
  const limit = LINE_TUNING.weeklyHours + LINE_TUNING.overtimeCapHours;
  if (report.hours > limit) return { ok: false, error: `the week needs ${report.hours} hours, more than the ${limit} allowed with overtime` };
  report.overtime = Math.max(0, report.hours - LINE_TUNING.weeklyHours);
  if (report.overtime > 0) effects.push(player('stress', report.overtime * LINE_TUNING.overtimeStressPerHour, OVERTIME));

  const applied = applyEffects(sim, effects);
  if (!applied.ok) return { ok: false, error: `the simulation rejected the week: ${applied.error.message}` };
  return { ok: true, level: s, sim: applied.state, log: applied.log, report };
}
