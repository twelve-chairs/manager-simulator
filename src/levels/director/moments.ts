import { band, NAMES } from '../line-manager';
import {
  addTeam,
  applyEffects,
  behindScheduleProjects,
  closeTeam,
  moveHeads,
  overdueProjects,
  PERFORMANCE_LEVELS,
  type ChangeLogEntry,
  type Effect,
  type SimState,
} from '../../sim';
import { generateSeniorManager, leaderOf, nextId, pick, randomInt, unusedName } from './core';
import { finalEvaluation, newLeader, placeMoments } from '../org';
import { quartersPlayed, remember } from './review';
import { setGoals } from './goals';
import { snapshotQuarter } from './recap';
import { DIRECTOR_TUNING as T } from './tuning';
import type { Bet, BetOffer, DirectorMoment, DirectorState } from './types';

type Result<X> = ({ ok: true } & X) | { ok: false; error: string };
type Choose = Result<{ level: DirectorState; sim: SimState; log: ChangeLogEntry[]; reaction: string }>;

const CHOICES: Record<DirectorMoment['kind'] | 'orgSplit', { id: string; label: string }[]> = {
  finalEvaluation: [{ id: 'letGo', label: 'Let them go' }, { id: 'oneMore', label: 'Give them one more period' }],
  newSenior: [{ id: 'promote', label: 'Promote one of the group’s managers' }, { id: 'hire', label: 'Hire from outside' }],
  headcount: [{ id: 'spread', label: 'Spread them across the groups' }, { id: 'neediest', label: 'Give them all to the most stretched group' }, { id: 'hold', label: 'Hold them back' }],
  bets: [{ id: 'none', label: 'Fund none of them' }],
  surfaced: [{ id: 'coach', label: 'Coach them through it' }, { id: 'decide', label: 'Take the decision yourself' }, { id: 'replace', label: 'Replace them' }],
  trouble: [{ id: 'coach', label: 'Coach them through it' }, { id: 'decide', label: 'Take the decision yourself' }, { id: 'replace', label: 'Replace them' }],
  peerAsk: [{ id: 'agree', label: 'Agree' }, { id: 'negotiate', label: 'Negotiate a trade' }, { id: 'refuse', label: 'Refuse' }],
  orgDesign: [{ id: 'merge', label: 'Merge it into another group' }, { id: 'leave', label: 'Leave it as it is' }],
  orgSplit: [{ id: 'splitPromote', label: 'Split it, promoting one of its managers to lead the new group' }, { id: 'splitHire', label: 'Split it, hiring a senior manager for the new group' }, { id: 'leave', label: 'Leave it as it is' }],
  review: [{ id: 'straight', label: 'Tell it straight: what went wrong, and the plan' }, { id: 'wins', label: 'Lead with the wins' }, { id: 'promise', label: 'Promise more next quarter' }],
};

const name = (sim: SimState, id: string) => sim.people[id]?.name ?? 'Someone';
const groupName = (sim: SimState, id: string) => sim.teams[id]?.name ?? 'A group';
const inTrouble = (sim: SimState) => new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));

/** The heads the executive gives this quarter: more with their trust and the player's reputation. */
// @spec DIR-HEAD-001
export function headcountGiven(level: DirectorState, sim: SimState): number {
  const h = T.head;
  const trust = sim.people[level.executiveId]?.trust ?? 50;
  return Math.max(0, Math.min(h.max, Math.round(h.base + (trust - 50) * h.perTrust + (sim.player.reputation - 50) * h.perReputation)));
}

/** The groups' active projects in the player's organization, and how many are in trouble. */
function quarterHeld(level: DirectorState, sim: SimState) {
  const troubled = inTrouble(sim);
  const active = Object.values(sim.projects).filter((p) => p.status === 'active' && level.groupIds.includes(p.teamId));
  return { active, troubled: active.filter((p) => troubled.has(p.id)) };
}

function betOffers(level: DirectorState, sim: SimState): BetOffer[] {
  const b = T.bets;
  return Array.from({ length: randomInt(level, b.offers) }, () => ({
    id: `bo${++level.counters.bet}`,
    name: unusedName(level, NAMES.projects, Object.values(sim.projects).map((p) => p.name)),
    ...(() => {
      const deadlineWeeks = randomInt(level, b.deadline);
      return { deadlineWeeks, scope: deadlineWeeks * randomInt(level, b.scopePerWeek) };
    })(),
    landing: randomInt(level, b.landing),
    failing: randomInt(level, b.failing),
    peerId: level.peerIds.length ? pick(level, level.peerIds) : null,
  }));
}

type Draft = Omit<DirectorMoment, 'id' | 'week' | 'day' | 'time' | 'status'>;

/** Final evaluations, groups with no senior manager and none on the way, and the quarter's headcount: the quarter's first week. */
function firstDrafts(s: DirectorState, sim: SimState): Draft[] {
  const first: Draft[] = [];
  for (const id of s.heldEvaluations) {
    if (sim.people[id]?.status !== 'active') continue;
    first.push({ kind: 'finalEvaluation', personId: id, groupId: sim.people[id]?.teamId ?? undefined, title: `Final evaluation: ${name(sim, id)}`, text: `${name(sim, id)} is on an improvement plan, and their group is still struggling under them. A third low rating ends the plan. It's your call.`, choices: CHOICES.finalEvaluation });
  }
  for (const g of s.groupIds) {
    if (sim.teams[g] && leaderOf(sim, g) === null && s.arriving[g] === undefined) first.push({ kind: 'newSenior', groupId: g, title: `${groupName(sim, g)} needs a senior manager`, text: `${groupName(sim, g)} has no senior manager. Who leads it now?`, choices: CHOICES.newSenior });
  }
  const heads = headcountGiven(s, sim);
  first.push({ kind: 'headcount', heads, title: 'Headcount for the quarter', text: `Your executive has ${heads} new ${heads === 1 ? 'head' : 'heads'} for your organization this quarter. Where do they go?`, choices: CHOICES.headcount });
  return first;
}

/** Bets, in the first quarter of each review period; then what listening tours surfaced; then groups in trouble. */
function betsListeningAndTrouble(s: DirectorState, sim: SimState): Draft[] {
  const drafts: Draft[] = [];
  if (Math.floor(quartersPlayed(s, sim)) % T.reviewEveryQuarters === 0) {
    const offers = betOffers(s, sim);
    drafts.push({ kind: 'bets', offers, title: 'Strategy bets', text: `Your executive has ${offers.length} bets on the table, and room to fund two. Each needs a group to carry it.`, choices: CHOICES.bets });
  }
  for (const x of s.surfaced) {
    const lead = leaderOf(sim, x.groupId);
    if (lead) drafts.push({ kind: 'surfaced', groupId: x.groupId, personId: lead, title: `What ${groupName(sim, x.groupId)} told you`, text: `On your listening tour, people in ${groupName(sim, x.groupId)} raised something ${name(sim, lead)} hasn't brought to you.`, choices: CHOICES.surfaced });
  }
  const troubled = inTrouble(sim);
  for (const g of s.groupIds) {
    const a = sim.teams[g]?.aggregate;
    const lead = leaderOf(sim, g);
    if (!a || !lead) continue;
    const behind = Object.values(sim.projects).some((p) => p.teamId === g && p.status === 'active' && troubled.has(p.id));
    if (band(a.stress) >= 3 || band(a.attritionRisk) >= 3 || behind) drafts.push({ kind: 'trouble', groupId: g, personId: lead, title: `${groupName(sim, g)} is in trouble`, text: `${name(sim, lead)} comes to you: ${groupName(sim, g)} is ${behind ? 'falling behind' : 'stretched thin'}.`, choices: CHOICES.trouble });
  }
  return drafts;
}

/** A peer's ask, at most every other quarter so it stays a moment rather than a fixture. */
function peerAskDrafts(s: DirectorState, sim: SimState): Draft[] {
  const peers = s.peerIds.filter((id) => sim.people[id]?.status === 'active');
  const askedLately = s.lastPeerAsk !== undefined && sim.week - s.lastPeerAsk <= T.weeksPerQuarter;
  if (!peers.length || askedLately) return [];
  const peer = pick(s, peers);
  const g = [...s.groupIds].filter((x) => sim.teams[x]).sort((x, y) => sim.teams[x]!.aggregate!.stress - sim.teams[y]!.aggregate!.stress)[0];
  return g ? [{ kind: 'peerAsk', personId: peer, groupId: g, title: `${name(sim, peer)} needs something`, text: `${name(sim, peer)} needs ${groupName(sim, g)} to move a dependency up its list.`, choices: CHOICES.peerAsk }] : [];
}

/** Groups grown too large for one senior manager, or shrunk too small to carry one. */
function orgDesignDrafts(s: DirectorState, sim: SimState): Draft[] {
  const drafts: Draft[] = [];
  for (const g of s.groupIds) {
    const a = sim.teams[g]?.aggregate;
    if (a && a.headcount > T.org.max) drafts.push({ kind: 'orgDesign', groupId: g, title: `${groupName(sim, g)} has grown large`, text: `${groupName(sim, g)} is ${a.headcount} people now, more than one senior manager can lead well.`, choices: CHOICES.orgSplit });
    else if (a && a.headcount < T.org.min && s.groupIds.length > 1) drafts.push({ kind: 'orgDesign', groupId: g, title: `${groupName(sim, g)} is small`, text: `${groupName(sim, g)} is down to ${a.headcount} people, small to carry a senior manager.`, choices: CHOICES.orgDesign });
  }
  return drafts;
}

/** The quarterly review with the executive, which closes the quarter. */
function reviewDraft(s: DirectorState, sim: SimState): Draft {
  const held = quarterHeld(s, sim);
  const onSchedule = held.active.length - held.troubled.length;
  const projects = onSchedule === 1 ? 'one project' : `${onSchedule} projects`;
  return {
    kind: 'review',
    title: 'The quarterly review',
    text: `You present the quarter to your executive: ${projects} on schedule and ${held.troubled.length} in trouble.`,
    choices: CHOICES.review,
  };
}

/** Makes the quarter's moments, in the order they play. */
// @spec DIR-MOMENT-001, DIR-MOMENT-002, DIR-MOMENT-003, DIR-MOMENT-004, DIR-PLAN-003, DIR-BET-001, DIR-QBR-001, DIR-PEER-001
export function beginQuarter(level: DirectorState, sim: SimState): DirectorState {
  const s = structuredClone(level);
  // A new review period begins with this quarter: its goals.
  if (sim.week > s.periodStart && (sim.week - s.startWeek) % (T.reviewEveryQuarters * T.weeksPerQuarter) === 0) setGoals(s, sim);
  // In this order: the level's generator is drawn on along the way, so the order is part of the run.
  const first = firstDrafts(s, sim);
  const optional = [...betsListeningAndTrouble(s, sim), ...peerAskDrafts(s, sim), ...orgDesignDrafts(s, sim)];
  const review = reviewDraft(s, sim);
  const room = Math.max(0, T.momentCap - first.length - 1);
  const rest = optional.slice(0, room);
  // Only an ask the player is shown counts toward the next one's wait.
  if (rest.some((d) => d.kind === 'peerAsk')) s.lastPeerAsk = sim.week;
  // Final evaluations, new senior managers and headcount fill the quarter's first week; the rest spread through it.
  s.moments = placeMoments(first, rest, review).map((d) => ({ ...d, id: `dm${++s.counters.moment}`, status: 'open' }));
  s.quarterStart = snapshotQuarter(s, sim);
  return s;
}

const value = (kind: 'person' | 'team' | 'project', id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind, id }, field, amount, cause: { kind: 'action', actionId: ruleId } });
const player = (field: 'stress' | 'reputation', amount: number, id: string): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause: { kind: 'action', actionId: id } });

function apply(sim: SimState, effects: Effect[], log: ChangeLogEntry[]): SimState {
  if (!effects.length) return sim;
  const r = applyEffects(sim, effects);
  if (!r.ok) throw new Error(`director moment: ${r.error.message}`);
  log.push(...r.log);
  return r.state;
}

function parse(json: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(json);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Places the quarter's heads: in groups, behind bets, the rest held back. */
// @spec DIR-HEAD-002, DIR-HEAD-003, DIR-HEAD-004
/** The effects of placing `n` heads at one target, a funded bet (`bet:<project>`) or a group; or why the target is refused. */
function placementEffects(s: DirectorState, sim: SimState, key: string, n: number): Result<{ effects: Effect[] }> {
  if (key.startsWith('bet:')) {
    const bet = s.bets.find((b) => b.projectId === key.slice(4));
    if (!bet || !sim.teams[bet.groupId]) return { ok: false, error: `${key.slice(4)} is not a funded bet` };
    return { ok: true, effects: n ? [value('team', bet.groupId, 'headcount', n, 'director.headcount'), value('project', bet.projectId, 'progress', n * T.head.betSpeed, 'director.headcount')] : [] };
  }
  if (!s.groupIds.includes(key) || !sim.teams[key]) return { ok: false, error: `${key} is not one of your groups` };
  return { ok: true, effects: n ? [value('team', key, 'headcount', n, 'director.headcount'), value('team', key, 'stress', n * T.head.onboardingStress, 'director.headcount')] : [] };
}

function place(s: DirectorState, sim: SimState, m: DirectorMoment, plan: Record<string, unknown>, log: ChangeLogEntry[]): Result<{ sim: SimState }> {
  const given = m.heads ?? 0;
  let placed = 0;
  const effects: Effect[] = [];
  for (const [key, n] of Object.entries(plan)) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return { ok: false, error: `${key}: a count must be a whole number, not ${String(n)}` };
    placed += n;
    const at = placementEffects(s, sim, key, n);
    if (!at.ok) return at;
    effects.push(...at.effects);
  }
  if (placed > given) return { ok: false, error: `only ${given} heads were given, not ${placed}` };
  if (placed < given) effects.push(value('person', s.executiveId, 'trust', -(given - placed) * T.head.heldTrust, 'director.headcount'));
  return { ok: true, sim: apply(sim, effects, log) };
}

/** Funds up to two bets, each on a named group. */
// @spec DIR-BET-002, DIR-BET-005
function fund(s: DirectorState, sim: SimState, m: DirectorMoment, plan: Record<string, unknown>, log: ChangeLogEntry[]): Result<{ sim: SimState }> {
  const entries = Object.entries(plan);
  if (entries.length > 2) return { ok: false, error: 'at most two bets can be funded' };
  const effects: Effect[] = [];
  const bets: Bet[] = [];
  for (const [offerId, groupId] of entries) {
    const offer = m.offers?.find((o) => o.id === offerId);
    if (!offer) return { ok: false, error: `${offerId} is not on offer` };
    if (typeof groupId !== 'string' || !s.groupIds.includes(groupId) || !sim.teams[groupId]) return { ok: false, error: `${String(groupId)} is not one of your groups` };
    const projectId = nextId(s, 'project', 'bp', sim.projects);
    effects.push({ type: 'startProject', project: { id: projectId, name: offer.name, teamId: groupId, scope: offer.scope, risk: 30, techDebt: 20, deadlineWeek: sim.week + offer.deadlineWeeks }, cause: { kind: 'action', actionId: 'director.bets' } });
    bets.push({ projectId, groupId, landing: offer.landing, failing: offer.failing, peerId: offer.peerId });
  }
  const next = apply(sim, effects, log);
  s.bets.push(...bets);
  s.funded.push(...bets.map((b) => ({ week: sim.week, projectId: b.projectId })));
  return { ok: true, sim: next };
}

/** Merges a small group into the smallest other group: heads, senior manager, projects, then closes it. */
// @spec DIR-MOMENT-004
function merge(s: DirectorState, sim0: SimState, groupId: string, log: ChangeLogEntry[]): SimState {
  const cause = { kind: 'action', actionId: 'director.orgDesign' } as const;
  const into = s.groupIds.filter((g) => g !== groupId && sim0.teams[g]).sort((x, y) => sim0.teams[x]!.aggregate!.headcount - sim0.teams[y]!.aggregate!.headcount || (x < y ? -1 : 1))[0]!;
  let sim = sim0;
  s.quarterStart?.moved.push({ from: groupId, fromName: sim0.teams[groupId]!.name, to: into, toName: sim0.teams[into]!.name, count: sim0.teams[groupId]!.aggregate!.headcount, kind: 'merge' });
  for (const l of PERFORMANCE_LEVELS) {
    const n = sim.teams[groupId]!.aggregate!.ratings[l];
    if (!n) continue;
    const r = moveHeads(sim, { from: groupId, to: into, level: l, count: n }, cause);
    if (!r.ok) throw new Error(`merge: ${r.error}`);
    log.push(...r.log);
    sim = r.state;
  }
  const lead = leaderOf(sim, groupId);
  const effects: Effect[] = [];
  if (lead) effects.push({ type: 'move', personId: lead, teamId: into, cause });
  for (const p of Object.values(sim.projects)) if (p.teamId === groupId && p.status === 'active') effects.push({ type: 'reassignProject', projectId: p.id, teamId: into, cause });
  sim = apply(sim, effects, log);
  const closed = closeTeam(sim, groupId, cause);
  if (!closed.ok) throw new Error(`merge: ${closed.error}`);
  log.push(...closed.log);
  s.groupIds = s.groupIds.filter((g) => g !== groupId);
  return closed.state;
}

/**
 * Splits a large group: a new, empty group is added, led by a manager promoted from the group or, with a hire, leaderless
 * until they arrive next quarter; half the heads at each rating and every other active project move into it.
 */
// @spec DIR-MOMENT-004
function split(s: DirectorState, sim0: SimState, groupId: string, promote: boolean, log: ChangeLogEntry[]): { sim: SimState; groupId: string } {
  const cause = { kind: 'action', actionId: 'director.orgDesign' } as const;
  const a = sim0.teams[groupId]!.aggregate!;
  const id = nextId(s, 'team', 'g', sim0.teams);
  const manager = promote ? generateSeniorManager(s, sim0, { skill: randomInt(s, T.newSenior.promotedSkill), trust: T.newSenior.promotedTrust }) : undefined;
  const added = addTeam(sim0, { team: { id, name: unusedName(s, NAMES.teams, Object.values(sim0.teams).map((t) => t.name)), aggregate: { headcount: 0, skill: a.skill, motivation: a.motivation, stress: a.stress } }, ...(manager && { manager }) }, cause);
  if (!added.ok) throw new Error(`split: ${added.error}`);
  log.push(...added.log);
  let sim = added.state;
  for (const l of PERFORMANCE_LEVELS) {
    const n = Math.floor(sim.teams[groupId]!.aggregate!.ratings[l] / 2);
    if (!n) continue;
    const r = moveHeads(sim, { from: groupId, to: id, level: l, count: n }, cause);
    if (!r.ok) throw new Error(`split: ${r.error}`);
    log.push(...r.log);
    sim = r.state;
  }
  const projects = Object.values(sim.projects).filter((p) => p.teamId === groupId && p.status === 'active').sort((x, y) => (x.id < y.id ? -1 : 1));
  sim = apply(sim, projects.filter((_, i) => i % 2 === 1).map((p): Effect => ({ type: 'reassignProject', projectId: p.id, teamId: id, cause })), log);
  if (manager) {
    s.leniency[manager.id] = randomInt(s, [0, 2]);
    s.joined.push(manager.id);
    sim = apply(sim, [value('team', groupId, 'skill', -T.newSenior.promoteSkill, 'director.orgDesign')], log);
  } else s.arriving[id] = sim.week;
  s.groupIds.push(id);
  s.quarterStart?.moved.push({ from: groupId, fromName: sim.teams[groupId]!.name, to: id, toName: sim.teams[id]!.name, count: sim.teams[id]!.aggregate!.headcount, kind: 'split' });
  return { sim, groupId: id };
}

/** What a choice handler works on: the level's copy, the simulation before the choice, the moment, and the log to add to. */
type Ctx = { s: DirectorState; sim0: SimState; m: DirectorMoment; choiceId: string; log: ChangeLogEntry[] };
type Handled = Result<{ sim: SimState; reaction: string }>;

function chooseFinalEvaluation({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const lead = m.personId!;
  return finalEvaluation(s, sim0, lead, choiceId, { oneMore: `${name(sim0, lead)} has one more period to turn it around.`, letGo: `${name(sim0, lead)} leaves. Their group needs a new senior manager.` }, 'director.finalEvaluation', log);
}

function chooseNewSenior({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const g = m.groupId!;
  const promote = (now: SimState) => generateSeniorManager(s, now, { skill: randomInt(s, T.newSenior.promotedSkill), trust: T.newSenior.promotedTrust });
  const r = newLeader(s, sim0, g, choiceId, promote, T.newSenior.promoteSkill, 'director.newSenior', log);
  const reaction = r.promoted ? `${r.promoted.name}, one of ${groupName(r.sim, g)}'s managers, steps up to lead it.` : `You start a search. ${groupName(sim0, g)} waits a quarter for its new senior manager.`;
  return { ok: true, sim: r.sim, reaction };
}

/** The placement a headcount choice stands for: the player's own, spread evenly, all to the most stressed group, or none. */
function headcountPlan(s: DirectorState, sim: SimState, given: number, choiceId: string): Record<string, unknown> | null {
  const groups = s.groupIds.filter((g) => sim.teams[g]);
  if (choiceId.startsWith('place:')) return parse(choiceId.slice('place:'.length));
  if (choiceId === 'spread') {
    const plan: Record<string, number> = Object.fromEntries(groups.map((g) => [g, 0]));
    for (let i = 0; i < given; i++) plan[groups[i % groups.length]!]! += 1;
    return plan;
  }
  if (choiceId === 'neediest') {
    const g = [...groups].sort((x, y) => sim.teams[y]!.aggregate!.stress - sim.teams[x]!.aggregate!.stress)[0]!;
    return { [g]: given };
  }
  return {};
}

function chooseHeadcount({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const plan = headcountPlan(s, sim0, m.heads ?? 0, choiceId);
  if (!plan) return { ok: false, error: 'a placement must be JSON naming groups or bets' };
  const r = place(s, sim0, m, plan, log);
  if (!r.ok) return r;
  return { ok: true, sim: r.sim, reaction: choiceId === 'hold' ? 'You hold the heads back. Your executive notices.' : 'The new heads start next week.' };
}

function chooseBets({ s, sim0, m, choiceId, log }: Ctx): Handled {
  if (choiceId === 'none') return { ok: true, sim: sim0, reaction: 'You fund none of them this time.' };
  const plan = parse(choiceId.slice('fund:'.length));
  if (!plan) return { ok: false, error: 'a funding must be JSON naming bets and groups' };
  const r = fund(s, sim0, m, plan, log);
  if (!r.ok) return r;
  return { ok: true, sim: r.sim, reaction: 'The bets are on. Your executive will be watching them.' };
}

function chooseTrouble({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const g = m.groupId!;
  const lead = m.personId!;
  const t = T.trouble;
  if (choiceId === 'coach') {
    const grows = band(sim0.people[lead]!.skill) >= 1;
    const sim = apply(sim0, [value('team', g, 'stress', -t.coachFix, 'director.trouble'), ...(grows ? [value('person', lead, 'skill', t.coachGrowth, 'director.trouble')] : [])], log);
    return { ok: true, sim, reaction: `${name(sim0, lead)} works it through with you, and owns the plan.` };
  }
  if (choiceId === 'decide') {
    const sim = apply(sim0, [value('team', g, 'stress', -t.decideFix, 'director.trouble'), value('person', lead, 'trust', -t.decideTrust, 'director.trouble'), player('stress', t.decideEnergy, 'director.trouble')], log);
    return { ok: true, sim, reaction: `You make the call. It works, and ${name(sim0, lead)} learns nothing from it.` };
  }
  const sim = apply(sim0, [{ type: 'remove', personId: lead, reason: 'fired', cause: { kind: 'action', actionId: 'director.trouble' } }], log);
  s.letGo.push(lead);
  return { ok: true, sim, reaction: `${name(sim0, lead)} goes. ${groupName(sim, g)} has no senior manager for now.` };
}

function choosePeerAsk({ sim0, m, choiceId, log }: Ctx): Handled {
  const peer = m.personId!;
  const p = T.peer;
  if (choiceId === 'agree') {
    const sim = apply(sim0, [value('team', m.groupId!, 'stress', p.askStress, 'director.peer'), value('person', peer, 'trust', p.agreeTrust, 'director.peer')], log);
    return { ok: true, sim, reaction: `${name(sim0, peer)} is grateful. ${groupName(sim, m.groupId!)} is busier.` };
  }
  if (choiceId === 'negotiate') {
    const sim = apply(sim0, [value('person', peer, 'trust', sim0.people[peer]!.trust >= p.negotiateAt ? p.negotiateTrust : -p.negotiateTrust, 'director.peer')], log);
    return { ok: true, sim, reaction: `You trade what each of you can give.` };
  }
  const sim = apply(sim0, [value('person', peer, 'trust', -p.refuseTrust, 'director.peer')], log);
  return { ok: true, sim, reaction: choiceId === 'refuse' ? `${name(sim0, peer)} takes the no, and remembers it.` : `You trade what each of you can give.` };
}

function chooseOrgDesign({ s, sim0, m, choiceId, log }: Ctx): Handled {
  const g = m.groupId!;
  if (choiceId === 'splitPromote' || choiceId === 'splitHire') {
    const added = split(s, sim0, g, choiceId === 'splitPromote', log);
    return { ok: true, sim: added.sim, reaction: `${groupName(sim0, g)} becomes two groups: ${groupName(added.sim, added.groupId)} is the new one.` };
  }
  if (choiceId === 'merge') return { ok: true, sim: merge(s, sim0, g, log), reaction: `${groupName(sim0, g)} joins another group.` };
  return { ok: true, sim: sim0, reaction: `${groupName(sim0, g)} stays as it is.` };
}

function chooseReview({ s, sim0, choiceId, log }: Ctx): Handled {
  const r = T.review;
  const troubled = quarterHeld(s, sim0).troubled.map((p) => p.id);
  if (choiceId === 'straight') {
    const sim = apply(sim0, [value('person', s.executiveId, 'trust', r.straightTrust, 'director.review'), player('reputation', -troubled.length * r.troubleReputation, 'director.review')], log);
    return { ok: true, sim, reaction: 'Your executive appreciates hearing it plainly.' };
  }
  if (choiceId === 'wins') {
    const sim = apply(sim0, [player('reputation', r.winsReputation, 'director.review')], log);
    s.leftOut.push(...troubled.map((id) => ({ id, week: sim.week })));
    return { ok: true, sim, reaction: 'The room likes the quarter you describe.' };
  }
  const sim = apply(sim0, [player('reputation', r.promiseReputation, 'director.review')], log);
  for (const b of s.bets) {
    b.landing = Math.round(b.landing * T.bets.promiseFactor);
    b.failing = Math.round(b.failing * T.bets.promiseFactor);
  }
  return { ok: true, sim, reaction: 'Your executive writes the new numbers down.' };
}

const HANDLERS: Record<DirectorMoment['kind'], (ctx: Ctx) => Handled> = {
  finalEvaluation: chooseFinalEvaluation,
  newSenior: chooseNewSenior,
  headcount: chooseHeadcount,
  bets: chooseBets,
  surfaced: chooseTrouble,
  trouble: chooseTrouble,
  peerAsk: choosePeerAsk,
  orgDesign: chooseOrgDesign,
  review: chooseReview,
};

/** Applies the player's choice for one of the quarter's open moments. */
// @spec DIR-MOMENT-005, DIR-MOMENT-003, DIR-PLAN-003, DIR-QBR-002, DIR-QBR-003, DIR-QBR-004, DIR-PEER-001
export function chooseDirector(level: DirectorState, sim0: SimState, momentId: string, choiceId: string): Choose {
  const s = structuredClone(level);
  const m = s.moments.find((x) => x.id === momentId);
  if (m?.status !== 'open') return { ok: false, error: `moment ${momentId} is not open` };
  const structured = (m.kind === 'headcount' && choiceId.startsWith('place:')) || (m.kind === 'bets' && choiceId.startsWith('fund:'));
  if (!structured && !m.choices.some((c) => c.id === choiceId)) return { ok: false, error: `${choiceId} is not a choice in ${m.title}` };
  const log: ChangeLogEntry[] = [];
  const handled = HANDLERS[m.kind]({ s, sim0, m, choiceId, log });
  if (!handled.ok) return handled;
  const { sim, reaction } = handled;
  m.status = 'answered';
  // Heads moved or added by a choice are not lost to attrition: remember the groups as they are now.
  remember(s, sim);
  return { ok: true, level: s, sim, log, reaction };
}
