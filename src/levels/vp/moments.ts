import { band, NAMES } from '../line-manager';
import { applyLogged, finalEvaluation, knownRatings, leaderOf, newLeader, nextId, pick, placeMoments, projectNames, random, randomInt, restlessLeaders, stayAnswer, stayDraft, unusedName } from '../org';
import type { ChangeLogEntry, Effect, SimState } from '../../sim';
import { generateDirector, quarterOf } from './core';
import { setGoals } from './goals';
import { snapshotQuarter } from './recap';
import { VP_TUNING as T } from './tuning';
import type { VpMoment, VpState } from './types';

type Result<X> = ({ ok: true } & X) | { ok: false; error: string };
export type Choose = Result<{ level: VpState; sim: SimState; log: ChangeLogEntry[]; reaction: string }>;
type Draft = Omit<VpMoment, 'id' | 'week' | 'day' | 'time' | 'status'>;

const CHOICES: Record<Exclude<VpMoment['kind'], 'stay'>, { id: string; label: string }[]> = {
  finalEvaluation: [{ id: 'letGo', label: 'Let them go' }, { id: 'oneMore', label: 'Give them one more period' }],
  newDirector: [{ id: 'promote', label: 'Promote one of the division’s senior managers' }, { id: 'hire', label: 'Hire from outside' }],
  planning: [{ id: 'plan', label: 'Ask for what the plan needs' }, { id: 'more', label: 'Ask for more than it needs' }, { id: 'give', label: 'Give part of your share to a peer’s priority' }],
  priority: [{ id: 'spread', label: 'Spread it across the divisions' }, { id: 'push', label: 'Push back: the function’s commitments come first' }],
  cuts: [{ id: 'once', label: 'Cut once, whole projects, and say why' }, { id: 'across', label: 'Cut across every division' }, { id: 'waves', label: 'Cut in waves, a few each quarter' }],
  dispute: [{ id: 'company', label: 'Settle it on what the company needs' }, { id: 'function', label: 'Side with your function' }, { id: 'trade', label: 'Broker a trade' }],
  odds: [{ id: 'together', label: 'Have them settle it together' }, { id: 'decide', label: 'Decide it yourself' }, { id: 'leave', label: 'Leave it' }],
  allHands: [{ id: 'truth', label: 'Tell them what is hard, and the plan' }, { id: 'celebrate', label: 'Celebrate the wins' }, { id: 'short', label: 'Keep it short' }],
};

const name = (sim: SimState, id: string) => sim.people[id]?.name ?? 'Someone';
const divisionName = (sim: SimState, id: string) => sim.teams[id]?.name ?? 'A division';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const led = (s: VpState, sim: SimState) => s.divisionIds.filter((g) => sim.teams[g] && leaderOf(sim, g));

/** The planned headcount for the year: more with the CEO's trust in the player and the player's reputation. */
// @spec VP-BUDGET-001
export function plannedHeads(level: VpState, sim: SimState): number {
  const p = T.planning;
  const trust = sim.people[level.ceoId]?.trust ?? 50;
  return Math.max(0, Math.min(p.max, Math.round(p.base + (trust - 50) * p.perTrust + (sim.player.reputation - 50) * p.perReputation)));
}

/** Whether the quarter beginning now opens a year, or a half, of the level. */
const opensYear = (s: VpState, sim: SimState) => (quarterOf(s, sim) - 1) % T.quartersPerYear === 0;
const opensHalf = (s: VpState, sim: SimState) => (quarterOf(s, sim) - 1) % T.quartersPerHalf === 0;

/** Final evaluations, divisions with no director and none on the way, and annual planning: the quarter's first week. */
function firstDrafts(s: VpState, sim: SimState): Draft[] {
  const first: Draft[] = [];
  for (const id of s.heldEvaluations) {
    if (sim.people[id]?.status !== 'active') continue;
    first.push({ kind: 'finalEvaluation', personId: id, divisionId: sim.people[id]?.teamId ?? undefined, title: `Final evaluation: ${name(sim, id)}`, text: `${name(sim, id)} is on an improvement plan, and their division is still struggling under them. A third low rating ends the plan. It's your call.`, choices: CHOICES.finalEvaluation });
  }
  for (const g of s.divisionIds) {
    if (sim.teams[g] && leaderOf(sim, g) === null && s.arriving[g] === undefined) first.push({ kind: 'newDirector', divisionId: g, title: `${divisionName(sim, g)} needs a director`, text: `${divisionName(sim, g)} has no director. Who leads it now?`, choices: CHOICES.newDirector });
  }
  // @spec VP-MOMENT-006
  for (const id of restlessLeaders(sim, s.divisionIds.map((g) => (sim.teams[g] ? leaderOf(sim, g) : null)))) {
    s.learnedWants[id] = true;
    first.push({ kind: 'stay', personId: id, divisionId: sim.people[id]!.teamId ?? undefined, ...stayDraft(sim, id) });
  }
  if (opensYear(s, sim)) {
    const planned = plannedHeads(s, sim);
    const peer = s.peerIds.find((id) => sim.people[id]?.status === 'active');
    const theirs = peer ? `, and ${name(sim, peer)} has a priority that needs people too` : '';
    first.push({ kind: 'planning', planned, ...(peer && { personId: peer }), title: 'Annual planning', text: `The leadership team divides next year's budget. Your plan needs ${plural(planned, 'new head', 'new heads')}${theirs}.`, choices: CHOICES.planning });
  }
  return first;
}

/** The half's company priority, the company's cuts, a leadership dispute, and directors at odds, in that order. */
function laterDrafts(s: VpState, sim: SimState): Draft[] {
  const drafts: Draft[] = [];
  if (opensHalf(s, sim) && !s.priority) {
    const divisions = led(s, sim);
    const choices = [...divisions.map((g) => ({ id: `one:${g}`, label: `Put ${divisionName(sim, g)} on it` })), ...CHOICES.priority];
    drafts.push({ kind: 'priority', title: 'The company priority', text: 'Your CEO names what the company needs from your function this half.', choices });
  }
  // @spec VP-CUT-001
  if (!s.cut.asked && quarterOf(s, sim) >= T.cuts.fromQuarter && random(s) < T.cuts.chance) {
    s.cut.asked = true;
    const total = s.divisionIds.reduce((n, g) => n + (sim.teams[g]?.aggregate?.headcount ?? 0), 0);
    const share = T.cuts.share[0] + random(s) * (T.cuts.share[1] - T.cuts.share[0]);
    const heads = Math.max(1, Math.round(total * share));
    drafts.push({ kind: 'cuts', heads, title: 'The company asks for cuts', text: `The budget has turned. Your CEO needs the function to lose ${plural(heads, 'head', 'heads')} this quarter.`, choices: CHOICES.cuts });
  }
  // @spec VP-LT-001
  const peers = s.peerIds.filter((id) => sim.people[id]?.status === 'active');
  if (peers.length && s.lastDispute !== sim.week && random(s) < T.dispute.chance) {
    const peer = pick(s, peers);
    s.lastDispute = sim.week;
    drafts.push({ kind: 'dispute', personId: peer, title: `${name(sim, peer)} disagrees`, text: `At the leadership meeting, ${name(sim, peer)} and you want different things from a dependency your function owns.`, choices: CHOICES.dispute });
  }
  // @spec VP-ODDS-001
  const busy = led(s, sim).filter((g) => Object.values(sim.projects).some((p) => p.teamId === g && p.status === 'active'));
  if (busy.length >= 2 && random(s) < T.odds.chance) {
    const [a, b] = [busy[0]!, busy[1]!];
    drafts.push({ kind: 'odds', divisionId: a, personId: leaderOf(sim, a)!, otherId: leaderOf(sim, b)!, title: 'Two directors at odds', text: `${name(sim, leaderOf(sim, a)!)} and ${name(sim, leaderOf(sim, b)!)} both say the shared work is the other's to carry.`, choices: CHOICES.odds });
  }
  return drafts;
}

/** The all-hands, which closes the quarter, with what the quarter held. */
// @spec VP-HANDS-001
function allHandsDraft(s: VpState, sim: SimState): Draft {
  const pr = s.priority ? sim.projects[s.priority.projectId] : undefined;
  const priority = pr ? ` The company priority, ${pr.name}, is ${Math.round((100 * pr.progress) / pr.scope)}% done.` : '';
  const cuts = s.cut.waves.length ? ` ${plural(s.cut.waves.reduce((a, b) => a + b, 0), 'more head goes', 'more heads go')} in the cuts still to come.` : '';
  return { kind: 'allHands', title: 'The all-hands', text: `The whole function gathers for the end of the quarter.${priority}${cuts}`, choices: CHOICES.allHands };
}

/** Makes the quarter's moments, in the order they play. */
// @spec VP-MOMENT-001, VP-MOMENT-002, VP-PLAN-003, VP-PRIO-001, VP-GOAL-001
export function beginQuarter(level: VpState, sim: SimState): VpState {
  const s = structuredClone(level);
  // A review period begins with this quarter: its goals.
  if ((sim.week - s.startWeek) % (T.reviewEveryQuarters * T.weeksPerQuarter) === 0) setGoals(s, sim);
  // In this order: the level's generator is drawn on along the way, so the order is part of the run.
  const first = firstDrafts(s, sim);
  const later = laterDrafts(s, sim);
  const closing = allHandsDraft(s, sim);
  const rest = later.slice(0, Math.max(0, T.momentCap - first.length - 1));
  s.moments = placeMoments(first, rest, closing).map((d) => ({ ...d, id: `vm${++s.counters.moment}`, status: 'open' }));
  s.quarterStart = snapshotQuarter(s, sim);
  return s;
}

const value = (kind: 'person' | 'team' | 'project', id: string, field: string, amount: number, actionId: string): Effect => ({ type: 'value', target: { kind, id }, field, amount, cause: { kind: 'action', actionId } });
const player = (field: 'stress' | 'reputation', amount: number, actionId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause: { kind: 'action', actionId } });
const apply = (sim: SimState, effects: Effect[], log: ChangeLogEntry[]) => applyLogged(sim, effects, log, 'VP moment');

/** Spreads the year's heads over its four quarters, as evenly as whole heads allow, earliest quarters first. */
// @spec VP-BUDGET-005
export function spreadYear(heads: number): number[] {
  const n = T.quartersPerYear;
  return Array.from({ length: n }, (_, i) => Math.floor(heads / n) + (i < heads % n ? 1 : 0));
}

type Ctx = { s: VpState; sim0: SimState; m: VpMoment; choiceId: string; log: ChangeLogEntry[] };
type Handled = Result<{ sim: SimState; reaction: string }>;

function chooseFinalEvaluation({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const lead = m.personId!;
  return finalEvaluation(s, sim0, lead, choiceId, { oneMore: `${name(sim0, lead)} has one more period to turn it around.`, letGo: `${name(sim0, lead)} leaves. Their division needs a new director.` }, 'vp.finalEvaluation', log);
}

function chooseNewDirector({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const g = m.divisionId!;
  const promote = (now: SimState) => generateDirector(s, now, { skill: randomInt(s, T.newDirector.promotedSkill), trust: T.newDirector.promotedTrust });
  const r = newLeader(s, sim0, g, choiceId, { promote, promoteSkill: T.newDirector.promoteSkill, actionId: 'vp.newDirector' }, log);
  const reaction = r.promoted ? `${r.promoted.name}, one of ${divisionName(r.sim, g)}'s senior managers, steps up to lead it.` : `You start a search. ${divisionName(sim0, g)} waits a quarter for its new director.`;
  return { ok: true, sim: r.sim, reaction };
}

/** Sets the year's headcount by how the player argued for it. */
// @spec VP-BUDGET-002, VP-BUDGET-003, VP-BUDGET-004
function choosePlanning({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const p = T.planning;
  const planned = m.planned ?? plannedHeads(s, sim0);
  const effects: Effect[] = [];
  let given = planned;
  let reaction = 'The plan holds. The heads arrive over the year.';
  if (choiceId === 'plan' && s.habits.firstTeam === 'function') given += p.functionFirst;
  if (choiceId === 'more') {
    if ((sim0.people[s.ceoId]?.trust ?? 0) >= p.moreAt) given += p.more;
    for (const peer of s.peerIds) if (sim0.people[peer]?.status === 'active') effects.push(value('person', peer, 'trust', -p.morePeerTrust, 'vp.planning'));
    reaction = 'You argue for more. The peers notice what it leaves them.';
  }
  if (choiceId === 'give' && m.personId) {
    given = Math.max(0, given - p.give);
    effects.push(value('person', m.personId, 'trust', p.givePeerTrust, 'vp.planning'), value('person', s.ceoId, 'trust', p.giveCeoTrust, 'vp.planning'));
    reaction = `${name(sim0, m.personId)} gets the people their priority needs. Your CEO saw who offered.`;
  }
  s.year = { quarter: quarterOf(s, sim0), given, arrived: 0, due: spreadYear(given), askedMore: choiceId === 'more' };
  return { ok: true, sim: apply(sim0, effects, log), reaction };
}

/** Starts the half's company priority on one division or spread across them, or pushes back. */
// @spec VP-PRIO-002, VP-PRIO-003
function choosePriority({ s, sim0, choiceId, log }: Ctx): Handled {
  const t = T.priority;
  if (choiceId === 'push') {
    const strained = s.divisionIds.some((g) => sim0.teams[g] && band(sim0.teams[g].aggregate!.stress) >= 3);
    const sim = strained ? sim0 : apply(sim0, [value('person', s.ceoId, 'trust', -t.pushTrust, 'vp.priority')], log);
    return { ok: true, sim, reaction: strained ? 'Your CEO looks at how stretched the function is, and agrees.' : 'Your CEO hears you out, and is not pleased.' };
  }
  const one = choiceId.startsWith('one:') ? choiceId.slice('one:'.length) : null;
  // A division without a director can still carry the work; only naming one asks a director to own it.
  const divisions = s.divisionIds.filter((x) => sim0.teams[x]);
  const g = one ?? [...divisions].sort((x, y) => sim0.teams[x]!.aggregate!.stress - sim0.teams[y]!.aggregate!.stress)[0];
  if (!g || !divisions.includes(g)) return { ok: false, error: `${String(g)} is not one of your divisions` };
  const weeks = randomInt(s, t.deadline);
  const scope = weeks * randomInt(s, t.scopePerWeek);
  const stake = randomInt(s, t.stake);
  const projectId = nextId(s, 'project', 'pp', sim0.projects);
  const effects: Effect[] = [{ type: 'startProject', project: { id: projectId, name: unusedName(s, NAMES.projects, projectNames(sim0)), teamId: g, scope, risk: 30, techDebt: 20, deadlineWeek: sim0.week + weeks }, cause: { kind: 'action', actionId: 'vp.priority' } }];
  if (one) effects.push(value('team', g, 'stress', t.oneStress, 'vp.priority'));
  const sim = apply(sim0, effects, log);
  s.priority = { projectId, divisionId: g, stake, week: sim0.week, spreadSlow: one ? 0 : Math.round((scope / weeks) * T.weeksPerQuarter * t.spreadShare) };
  return { ok: true, sim, reaction: one ? `${divisionName(sim, g)} takes it on, and feels the weight.` : 'Every division takes a piece of it.' };
}

/** Each division's share of the heads cut, by headcount, the largest remainders taking what is left. */
function shares(s: VpState, sim: SimState, heads: number): Record<string, number> {
  const ds = s.divisionIds.filter((g) => sim.teams[g]);
  const total = ds.reduce((n, g) => n + sim.teams[g]!.aggregate!.headcount, 0) || 1;
  const exact = ds.map((g) => ({ g, x: (heads * sim.teams[g]!.aggregate!.headcount) / total }));
  const out: Record<string, number> = Object.fromEntries(exact.map(({ g, x }) => [g, Math.floor(x)]));
  let left = heads - Object.values(out).reduce((a, b) => a + b, 0);
  for (const { g } of [...exact].sort((a, b) => b.x - Math.floor(b.x) - (a.x - Math.floor(a.x)) || (a.g < b.g ? -1 : 1))) if (left-- > 0) out[g]! += 1;
  return out;
}

/** The effects of losing heads from divisions by share, each wave lowering motivation and raising attrition risk. */
export function cutEffects(s: VpState, sim: SimState, heads: number, motivation: number, risk: number): Effect[] {
  const effects: Effect[] = [];
  for (const [g, n] of Object.entries(shares(s, sim, heads))) {
    const a = sim.teams[g]!.aggregate!;
    if (n > 0) effects.push(value('team', g, 'headcount', -Math.min(n, a.headcount), 'vp.cuts'));
    if (motivation) effects.push(value('team', g, 'motivation', -motivation, 'vp.cuts'));
    if (risk) effects.push(value('team', g, 'attritionRisk', risk, 'vp.cuts'));
  }
  return effects;
}

/** A single cut: whole projects of the largest division, furthest from done first, until its heads are covered. */
function cutOnce(s: VpState, sim: SimState, heads: number): Effect[] {
  const g = s.divisionIds.filter((x) => sim.teams[x]).sort((x, y) => sim.teams[y]!.aggregate!.headcount - sim.teams[x]!.aggregate!.headcount || (x < y ? -1 : 1))[0]!;
  const a = sim.teams[g]!.aggregate!;
  const projects = Object.values(sim.projects).filter((p) => p.teamId === g && p.status === 'active' && p.id !== s.priority?.projectId);
  const perProject = projects.length ? a.headcount / (projects.length + 1) : 0;
  const effects: Effect[] = [];
  let covered = 0;
  for (const p of [...projects].sort((x, y) => x.progress / x.scope - y.progress / y.scope || (x.id < y.id ? -1 : 1))) {
    if (covered >= heads) break;
    effects.push({ type: 'cancelProject', projectId: p.id, cause: { kind: 'action', actionId: 'vp.cuts' } });
    covered += perProject;
  }
  effects.push(value('team', g, 'headcount', -Math.min(heads, a.headcount), 'vp.cuts'));
  for (const d of s.divisionIds) if (sim.teams[d]) effects.push(value('team', d, 'motivation', -T.cuts.onceMotivation, 'vp.cuts'));
  return effects;
}

/** Makes the company's cut: once, across every division, or the first of three waves. */
// @spec VP-CUT-002, VP-CUT-003, VP-CUT-004, VP-CUT-005
export function makeCut(s: VpState, sim0: SimState, heads: number, how: string, log: ChangeLogEntry[]): SimState {
  const c = T.cuts;
  let effects: Effect[];
  let now = heads;
  if (how === 'once') effects = cutOnce(s, sim0, heads);
  else if (how === 'waves') {
    now = Math.round(heads / 3);
    const later = heads - now;
    s.cut.waves = [Math.ceil(later / 2), Math.floor(later / 2)];
    effects = cutEffects(s, sim0, now, c.waveMotivation, c.waveRisk);
  } else {
    effects = cutEffects(s, sim0, heads, c.acrossMotivation, 0);
    for (const p of Object.values(sim0.projects)) if (p.status === 'active' && s.divisionIds.includes(p.teamId)) effects.push(value('project', p.id, 'progress', -Math.min(p.progress, Math.round(p.scope * c.acrossSlow)), 'vp.cuts'));
  }
  const sim = apply(sim0, effects, log);
  const divisions: Record<string, number> = {};
  for (const e of effects) if (e.type === 'value' && e.target.kind === 'team' && e.field === 'headcount') divisions[e.target.id] = (divisions[e.target.id] ?? 0) - e.amount;
  s.cutHeads.push({ week: sim0.week, count: now, divisions });
  // Heads cut are not attrition: remember the divisions as they are now.
  s.knownRatings = knownRatings(s.divisionIds, sim);
  return sim;
}

function chooseCuts({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const sim = makeCut(s, sim0, m.heads ?? 0, choiceId, log);
  const reaction = { once: 'You cut once, and say why. It hurts, and then it is over.', across: 'Every division loses people. Every project slows.', waves: 'The first wave goes. Everyone wonders who is next.' }[choiceId] ?? '';
  return { ok: true, sim, reaction };
}

/** Settles a leadership dispute on the company's needs, for the function, or by a trade. */
// @spec VP-LT-002
function chooseDispute({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const d = T.dispute;
  const peer = m.personId!;
  if (choiceId === 'company') return { ok: true, sim: apply(sim0, [value('person', s.ceoId, 'trust', d.ceoTrust, 'vp.dispute'), value('person', peer, 'trust', -d.loserTrust, 'vp.dispute')], log), reaction: 'You settle it on what the company needs. Your CEO nods.' };
  if (choiceId === 'function') {
    const leads = led(s, sim0).map((g) => leaderOf(sim0, g)!);
    const effects = [...leads.map((id) => value('person', id, 'trust', d.functionTrust, 'vp.dispute')), ...s.peerIds.filter((id) => sim0.people[id]?.status === 'active').map((id) => value('person', id, 'trust', -d.peersTrust, 'vp.dispute'))];
    return { ok: true, sim: apply(sim0, effects, log), reaction: 'Your directors hear you fought for them. The peers hear it too.' };
  }
  const works = (sim0.people[peer]?.trust ?? 0) >= d.tradeAt || s.habits.firstTeam === 'leadership';
  return { ok: true, sim: apply(sim0, [value('person', peer, 'trust', works ? d.tradeTrust : -d.tradeTrust, 'vp.dispute'), player('stress', d.tradeEnergy, 'vp.dispute')], log), reaction: works ? `You and ${name(sim0, peer)} find a trade.` : `${name(sim0, peer)} doesn't trust the trade.` };
}

/** Two directors at odds: settled together, decided by the player, or left. */
// @spec VP-ODDS-001
function chooseOdds({ sim0, m, choiceId, log }: Ctx): Handled {
  const o = T.odds;
  const [a, b] = [m.personId!, m.otherId!];
  if (choiceId === 'together') {
    const grow = [a, b].every((id) => band(sim0.people[id]?.skill ?? 0) >= 1);
    return { ok: true, sim: apply(sim0, grow ? [value('person', a, 'skill', o.growth, 'vp.odds'), value('person', b, 'skill', o.growth, 'vp.odds')] : [], log), reaction: grow ? 'They work it out between them, and both come out sharper.' : 'They try. It takes longer than it should.' };
  }
  if (choiceId === 'decide') return { ok: true, sim: apply(sim0, [value('person', b, 'trust', -o.trust, 'vp.odds')], log), reaction: `You decide. ${name(sim0, b)} takes it badly.` };
  const both = new Set([sim0.people[a]?.teamId, sim0.people[b]?.teamId]);
  const effects = Object.values(sim0.projects).filter((p) => p.status === 'active' && both.has(p.teamId)).map((p) => value('project', p.id, 'progress', -Math.min(p.progress, Math.round(p.scope * o.slow)), 'vp.odds'));
  return { ok: true, sim: apply(sim0, effects, log), reaction: 'Nobody carries the shared work, and both divisions slow.' };
}

/** Whether the quarter so far holds hard news: a cut, a failed priority, or a strained division. */
export function hardNews(s: VpState, sim: SimState, since: number): boolean {
  return s.cutHeads.some((c) => c.week >= since) || s.priorityResults.some((r) => r.week >= since && !r.landed) || s.divisionIds.some((g) => sim.teams[g] && band(sim.teams[g].aggregate!.stress) >= 3);
}

/** The all-hands: the truth, a celebration, or a short one. */
// @spec VP-HANDS-002, VP-HANDS-003, VP-HANDS-004
function chooseAllHands({ s, sim0, choiceId, log }: Ctx): Handled {
  const h = T.allHands;
  const quarter = quarterOf(s, sim0);
  const divisions = s.divisionIds.filter((g) => sim0.teams[g]);
  if (choiceId === 'short') return { ok: true, sim: sim0, reaction: 'You keep it short. People go back to work.' };
  if (choiceId === 'celebrate') {
    s.told = { what: 'celebration', quarter };
    return { ok: true, sim: apply(sim0, divisions.map((g) => value('team', g, 'motivation', h.celebrateMotivation, 'vp.allHands')), log), reaction: 'The room cheers the wins.' };
  }
  const hard = hardNews(s, sim0, s.quarterStart?.week ?? sim0.week);
  s.told = { what: 'truth', quarter };
  return { ok: true, sim: apply(sim0, hard ? divisions.map((g) => value('team', g, 'motivation', h.truthMotivation, 'vp.allHands')) : [], log), reaction: hard ? 'You tell them what is hard. They trust the plan more for it.' : 'You tell them how things stand. No surprises.' };
}

/** A stay conversation: keep the director by giving them what they want, or wish them well. */
// @spec VP-MOMENT-007
function chooseStay({ sim0, m, choiceId, log }: Ctx): Handled {
  const r = stayAnswer(sim0, m.personId!, choiceId, T.stay, 'vp.stay');
  return { ok: true, sim: apply(sim0, r.effects, log), reaction: r.reaction };
}

const HANDLERS: Record<VpMoment['kind'], (ctx: Ctx) => Handled> = {
  finalEvaluation: chooseFinalEvaluation,
  newDirector: chooseNewDirector,
  planning: choosePlanning,
  priority: choosePriority,
  cuts: chooseCuts,
  dispute: chooseDispute,
  odds: chooseOdds,
  allHands: chooseAllHands,
  stay: chooseStay,
};

/** Applies the player's choice for one of the quarter's open moments, and reveals the wants of the people in it. */
// @spec VP-MOMENT-003, VP-VIS-001, VP-VIS-003, VP-PLAN-003
export function chooseVp(level: VpState, sim0: SimState, momentId: string, choiceId: string): Choose {
  const s = structuredClone(level);
  const m = s.moments.find((x) => x.id === momentId);
  if (m?.status !== 'open') return { ok: false, error: `moment ${momentId} is not open` };
  if (!m.choices.some((c) => c.id === choiceId)) return { ok: false, error: `${choiceId} is not a choice in ${m.title}` };
  const log: ChangeLogEntry[] = [];
  const handled = HANDLERS[m.kind]({ s, sim0, m, choiceId, log });
  if (!handled.ok) return handled;
  m.status = 'answered';
  for (const id of [m.personId, m.otherId]) if (id) s.learnedWants[id] = true;
  // Heads moved or added by a choice are not lost to attrition: remember the divisions as they are now.
  s.knownRatings = knownRatings(s.divisionIds, handled.sim);
  return { ok: true, level: s, sim: handled.sim, log, reaction: handled.reaction };
}

/** What letting each kind of moment wait means: the choice it is answered with, if any. */
const WAITED: Partial<Record<VpMoment['kind'], string>> = { finalEvaluation: 'oneMore', planning: 'plan', priority: 'spread', cuts: 'across', allHands: 'short' };

/** Closes the quarter's unanswered moments as waited, answering each kind that has one with what waiting means. */
// @spec VP-MOMENT-004
export function waitMoments(s: VpState, sim0: SimState, log: ChangeLogEntry[]): SimState {
  let sim = sim0;
  for (const m of s.moments) {
    if (m.status !== 'open') continue;
    const choiceId = WAITED[m.kind];
    if (choiceId) {
      const handled = HANDLERS[m.kind]({ s, sim0: sim, m, choiceId, log });
      if (handled.ok) sim = handled.sim;
    }
    m.status = 'waited';
  }
  return sim;
}
