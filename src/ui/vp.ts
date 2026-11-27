import { headsLostLastQuarter, quitLastQuarter, type VpRecap, type VpState, type VpView } from '../levels/vp';
import type { Run } from '../loop';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import {
  SCHEDULE_WORDS,
  careerLines,
  habitControls as habitControlsOf,
  habitsPanel,
  headcountChips,
  leaderCard,
  leaderChips,
  leaderLine,
  outsiderCard,
  playerChips,
  recapPart,
  sharedMeasureValue,
  trustChips,
  unitCard,
} from './org';
import { headsChangeLine, headsLostLine, quitLine, shareWord } from './text';
import type { Chip, LevelRenderer, MomentDetails, ScreenContext } from './app';

/** The VP's How to play topics. */
// @spec UI-VP-011
export const VP_HELP_TOPICS = [
  { id: 'how-to-play', title: 'How to play', text: 'Each quarter is a run of moments. Your directors run the divisions; you share a budget with the leadership team, carry the company’s priorities and speak to the whole function. Pick what you do, or let it wait. A recap ends the quarter.' },
  { id: 'first-team', title: 'Your first team', text: 'You sit on a leadership team with your CEO and two peer VPs. Putting them first earns their trust; putting your function first earns your directors’.' },
  { id: 'survey', title: 'The survey', text: 'You see your divisions’ mood as the last engagement survey measured it, twice a year.' },
  { id: 'planning', title: 'Planning and priorities', text: 'Each year the leadership team divides one budget; each half your CEO names what the company needs from your function. What you ask for, and whether you carry it, is remembered.' },
  { id: 'energy', title: 'Energy', text: 'Your energy falls with what you take on yourself. Two quarters in a row at the edge and you burn out.' },
  { id: 'reviews', title: 'Reviews', text: 'Every two quarters your CEO reviews you: the company’s priorities, delivery, retention, your divisions’ health and the leadership team’s confidence in you. From your third review on, two of your reviews in a row rated exceeds or better get you promoted. After three years without one, the run ends.' },
] as const;

const PANEL_HELP = {
  directors: 'Each division’s mood is from the last survey.',
  leadership: 'How much your CEO and peers trust you shapes the budget and how disputes settle.',
  plan: 'The year’s heads arrive over its four quarters, to the division that needs them most.',
  habits: 'Changes apply from this quarter’s end, and to moments from next quarter.',
};

const HABITS = {
  firstTeam: { label: 'Your first team', options: { function: 'Your function', leadership: 'The leadership team' }, what: 'Putting the leadership team first earns your CEO’s and peers’ trust; putting your function first earns your directors’, and a little more of the budget.' },
  directors: { label: 'How you lead your directors', options: { stepBack: 'Set direction and step back', review: 'Review their plans closely' }, what: 'Stepping back lets capable directors grow; reviewing closely speeds the company priority and steadies a struggling division, at a cost in your energy and their trust.' },
} as const;

const viewOf = (ctx: ScreenContext) => ctx.view as VpView;
/** A stake in words, not numbers. */
const stakeWords = (stake: number) => `stake: ${stake >= 11 ? 'a big win or a hard knock' : 'a win or a knock'}`;

// @spec UI-VP-005
const habitControls = (ctx: ScreenContext, withHelp: boolean): Child => habitControlsOf(ctx, HABITS, viewOf(ctx).habits as unknown as Record<string, string>, withHelp);

/** The year's heads and the company priority. */
// @spec UI-VP-004
function plan(v: VpView): Child {
  const p = v.plan;
  const division = new Map(v.divisions.map((d) => [d.id, d.name]));
  const heads = p.given === null ? 'The year is not planned yet.' : `${p.arrived} of ${p.given} new heads have arrived.`;
  const pr = p.priority;
  return h(
    'section',
    { 'data-panel': 'plan', class: 'projects' },
    h('h2', {}, 'The year’s plan'),
    h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.plan),
    h('p', { 'data-field': 'heads' }, heads),
    pr
      ? h('article', { 'data-priority': pr.projectId, class: 'project' },
          h('p', { 'data-field': 'priority' }, h('strong', {}, pr.name), ` · ${division.get(pr.divisionId) ?? 'a division'} · ${pr.progress} / ${pr.scope} done, due week ${pr.deadlineWeek + 1} · ${SCHEDULE_WORDS[pr.schedule]}`),
          h('p', {}, h('small', { 'data-field': 'stake' }, stakeWords(pr.stake))))
      : h('p', { 'data-field': 'priority', class: 'quiet' }, 'No company priority is set.'),
  );
}

/** The directors with their divisions, the leadership team, the year's plan and the habits. */
// @spec UI-VP-002, UI-VP-003, UI-VP-004, UI-VP-005
function panels(ctx: ScreenContext): Child {
  const v = viewOf(ctx);
  const leads = new Map(v.directors.map((m) => [m.id, m]));
  const division = (d: VpView['divisions'][number]) => unitCard({ ...d, leaderId: d.directorId }, 'division', 'No director yet', `at the survey in quarter ${d.quarter}`);
  return [
    h(
      'section',
      { 'data-panel': 'directors', class: 'team' },
      h('h2', {}, 'Your directors'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.directors),
      v.divisions.map((d) => {
        const m = d.directorId ? leads.get(d.directorId) : undefined;
        return m ? leaderCard(m, 'data-director', 'director', division(d)) : division(d);
      }),
    ),
    h(
      'section',
      { 'data-panel': 'leadership', class: 'team' },
      h('h2', {}, 'The leadership team'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.leadership),
      v.leadership.map((u) => outsiderCard(u, { executive: 'your CEO', peer: 'a peer VP' })),
    ),
    plan(v),
    habitsPanel(ctx, PANEL_HELP.habits, habitControls(ctx, false)),
  ];
}

/** A VP moment for the scene, with a director's skill beside choices that depend on them. */
// @spec UI-VP-006
function moment(ctx: ScreenContext, momentId: string): MomentDetails | undefined {
  const v = viewOf(ctx);
  const m = v.moments.find((x) => x.id === momentId);
  if (!m) return undefined;
  const skillOf = (id?: string) => {
    const d = id ? v.directors.find((x) => x.id === id) : undefined;
    return d ? `leads: ${bandWord('skill', d.skill)}` : undefined;
  };
  const leaderOfDivision = (id: string) => v.divisions.find((d) => d.id === id)?.directorId ?? undefined;
  return {
    title: m.title,
    text: m.text,
    choices: m.choices.map((c) => ({ ...c, note: c.id.startsWith('one:') ? skillOf(leaderOfDivision(c.id.slice('one:'.length))) : skillOf(m.personId) })),
  };
}

/** A chip per band that moved, per change in a division's headcount, and for the company priority's schedule. */
// @spec UI-VP-007
function chips(before: unknown, after: unknown, rose: (personId: string) => boolean = () => false): Chip[] {
  const a = before as VpView;
  const b = after as VpView;
  const out: Chip[] = [];
  leaderChips(a.directors, b.directors, 'dr', rose, out);
  headcountChips(a.divisions, b.divisions, 'division', out);
  trustChips(a.leadership, b.leadership, out);
  const was = a.plan.priority;
  const now = b.plan.priority;
  if (was && now?.projectId === was.projectId && was.schedule !== now.schedule) out.push({ key: `priority:${now.projectId}:schedule`, text: `${now.name}: ${SCHEDULE_WORDS[now.schedule]}`, tone: now.schedule === 'onSchedule' ? 'good' : 'bad' });
  playerChips(a.player, b.player, out);
  return out;
}

/** The VP's part of the recap: what changed, or a quiet quarter, and the routine folded away. */
// @spec UI-VP-008
function recap(run: Run, value: unknown): { changes: Child; routine: Child } {
  const r = value as VpRecap;
  const c = r.changes;
  const quits = quitLastQuarter(run.level as VpState, run.sim);
  const lost = headsLostLastQuarter(run.level as VpState, run.sim);
  const quiet = !(c.directors.length || c.survey || c.heads.length || c.cut || quits.length || lost.length || c.priority.length || c.leadership.length);
  return {
    changes: [
      quiet ? h('p', { 'data-part': 'recap-quiet', class: 'quiet' }, 'A quiet quarter.') : null,
      recapPart('recap-left', 'Who left', [...quits.map((q) => h('li', { 'data-director': q.personId }, quitLine(q))), ...lost.map((x) => h('li', { 'data-division': x.divisionId }, headsLostLine(x)))]),
      recapPart('recap-directors', 'Your directors', c.directors.map((m) => h('li', { 'data-director': m.id }, leaderLine(m)))),
      recapPart('recap-survey', c.survey ? `The survey, quarter ${c.survey.quarter}` : 'The survey', (c.survey?.divisions ?? []).map((g) => h('li', { 'data-division': g.id }, `${g.name}: ${bandWord('motivation', g.motivation)} and ${bandWord('stress', g.stress)}.`))),
      recapPart('recap-heads', 'People', c.heads.map((x) => h('li', {}, headsChangeLine(x)))),
      recapPart('recap-cut', 'Cuts', c.cut ? [h('li', {}, `${c.cut} ${c.cut === 1 ? 'head' : 'heads'} cut.`)] : []),
      recapPart('recap-priority', 'The company priority', c.priority.map((line) => h('li', {}, `${line}.`))),
      recapPart('recap-leadership', 'The leadership team', c.leadership.map((u) => h('li', { 'data-outsider': u.id }, `${u.name} ${u.change}.`))),
    ],
    routine: [recapPart('recap-habits', 'Your habits', r.routine.habits.map((line) => h('li', {}, line))), recapPart('recap-goals', 'Goals', r.routine.goals.map((g) => h('li', {}, `${g.text}: ${g.progress}`)))],
  };
}

/** The VP's review measures by name. */
// @spec UI-VP-009
const MEASURE_NAMES: Record<string, string> = {
  prioritiesLanded: 'Company priorities landed',
  projectsOnTime: 'Projects shipped on time',
  regrettedAttrition: "People you'd have kept who left",
  motivation: 'Division motivation at the survey',
  stress: 'Division stress at the survey',
  ceoConfidence: "Your CEO's confidence",
  peerConfidence: "Your peers' confidence",
  reputation: 'Your reputation',
};

/** What moves each of the level's review measures, said beside one that held the rating back. */
// @spec UI-REVIEW-003
const MEASURE_LEVERS: Record<string, string> = {
  prioritiesLanded: "carry the company priority: reviewing your directors' plans closely speeds it, and asking for more than you deliver is remembered",
  projectsOnTime: "divisions deliver what they can carry; a calm division carries more",
  regrettedAttrition: "a division's risk of losing people follows its mood, low motivation twice as much as high stress, and a division drifts toward what its director sustains, so a stronger director keeps more of its people; the recap's Who left names the divisions",
  motivation: "divisions drift toward what their directors sustain",
  stress: "divisions drift toward what their directors sustain, and cuts land on the divisions that take them",
  ceoConfidence: "landing the company priority, settling disputes on what the company needs and putting the leadership team first build it",
  peerConfidence: "putting the leadership team first and giving peers what they ask for at planning build it; asking for more yourself costs it",
  reputation: "the company priority landing or failing moves it most",
};

const measureValue = (_view: unknown, id: string, value: number): string | undefined => (id === 'prioritiesLanded' ? shareWord(value, 'all') : sharedMeasureValue(id, value, ['ceoConfidence', 'peerConfidence']));

// @spec UI-VP-010
const career = (view: unknown): Child => careerLines((view as VpView).career, 'VP', { label: 'Directors', field: 'directors' });

export const vpRenderer: LevelRenderer = {
  turn: 'quarter',
  help: VP_HELP_TOPICS,
  firstTurn: { where: 'Before the quarter', heading: 'How you run your function', intro: 'Your divisions now run through their directors, and you sit on the leadership team with your CEO and two peers. Decide which team you put first and how closely you lead your directors, before the quarter begins.' },
  // @spec UI-VP-012
  handover: {
    question: () => 'Who leads your organization now?',
    hire: 'An outside hire: a capable director you don’t know yet',
    trade: 'One of your senior managers brings the trust they’ve built with you. An outside hire is capable, but a stranger in charge unsettles the division at first.',
  },
  stayed: {
    outcome: 'This was your last review as a VP. Three years in, the promotion never came.',
    ending: 'You stayed a VP. Three years went by without the promotion.',
  },
  panels,
  habits: (ctx) => habitControls(ctx, true),
  moment,
  chips,
  recap,
  status: (view) => {
    const v = view as VpView;
    return { energy: v.player.energy, reputation: v.player.reputation, goals: v.goals, edge: { at: v.player.edge.at, weeks: v.player.edge.quarters, limit: v.player.edge.limit } };
  },
  measureName: (view, id) => MEASURE_NAMES[id] ?? (view as VpView).goals.find((g) => `goal:${g.id}` === id)?.text,
  measureValue,
  measureLever: (id) => MEASURE_LEVERS[id],
  career,
};
