import { draftObject } from './drafts';
import { DIRECTOR_TUNING, headsLostLastQuarter, quitLastQuarter, type DirectorRecap, type DirectorState, type DirectorView } from '../levels/director';
import type { Run } from '../loop';
import { band } from '../levels/line-manager';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { headsChangeLine, headsLostLine, quitLine, shareWord } from './text';
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
  plural,
  recapPart,
  sharedMeasureValue,
  trustChips,
  unitCard,
} from './org';
import type { Chip, LevelRenderer, MomentDetails, ScreenContext } from './app';

/** The director's How to play topics. */
// @spec UI-DIR-014
export const DIRECTOR_HELP_TOPICS = [
  { id: 'how-to-play', title: 'How to play', text: 'Each quarter is a run of moments. Your senior managers run the groups; you set the headcount, place the bets and answer to your executive. Pick what you do, or let it wait. A recap ends the quarter.' },
  { id: 'room-above', title: 'The room above', text: 'Your executive and your peers each trust you more or less. Time with them earns headcount and backing; time away from your organization costs it.' },
  { id: 'survey', title: 'The survey', text: 'You see your groups’ mood as the last engagement survey measured it, twice a year. A listening tour shows one group as it is now.' },
  { id: 'bets-review', title: 'Bets and the review', text: 'Fund bets your groups can carry. Each quarter you tell your executive how it went; what you leave out tends to come back.' },
  { id: 'energy', title: 'Energy', text: 'Your energy falls with what you take on yourself. Two quarters in a row at the edge and you burn out.' },
  { id: 'reviews', title: 'Reviews', text: 'Every two quarters your executive reviews you: the bets, delivery, retention, your groups’ health and their confidence in you. From your third review on, two of your reviews in a row rated exceeds or better get you promoted. After three years without one, the run ends.' },
] as const;

const PANEL_HELP = {
  seniorManagers: 'Each group’s mood is from the last survey, unless your listening tour saw it this quarter. A group’s risk of losing people rises as its motivation falls and its stress climbs.',
  upward: 'How much your executive and peers trust you shapes your headcount and your bets.',
  bets: 'A bet lands if its project ships by its deadline.',
  habits: 'Changes apply from this quarter’s end, and to moments from next quarter.',
};

const HABITS = {
  time: { label: 'Where your time goes', options: { organization: 'Your organization', balanced: 'Balanced', upward: 'The room above' }, what: 'Time upward earns your executive’s and peers’ trust; time with your organization keeps your groups and senior managers with you.' },
  staffMeeting: { label: 'Staff meeting', options: { weekly: 'Weekly', fortnightly: 'Fortnightly' }, what: 'Your senior managers together: it builds their trust and tells you what each wants. Weekly costs more of your energy.' },
  listeningTour: { label: 'Listening tour', options: { none: 'None', quarterly: 'Quarterly' }, what: 'Each quarter you spend time inside one group: you see how it really is, and hear what its senior manager hasn’t said.' },
} as const;

const viewOf = (ctx: ScreenContext) => ctx.view as DirectorView;
/** A bet's stakes in words, not numbers. */
/** What landing and failing a bet do, in words: reputation and the executive's trust, a lot or some. */
const stakes = (landing: number, failing: number) => `If it lands, your reputation and your executive's trust rise ${landing >= 10 ? 'a lot' : 'some'}; if it fails, both fall ${failing >= 12 ? 'a lot' : 'some'}.`;
/** The trust band at which a peer speeds a bet that touches their organization. */
const PEER_HELPS_BAND = band(DIRECTOR_TUNING.bets.peerTrust);

/** The habit controls, sending a habit change at once. */
// @spec UI-DIR-006
const habitControls = (ctx: ScreenContext, withHelp: boolean): Child => habitControlsOf(ctx, HABITS, viewOf(ctx).habits as unknown as Record<string, string>, withHelp);

/** The senior managers with their groups, the room above, the bets and the habits. */
// @spec UI-DIR-002, UI-DIR-003, UI-DIR-004, UI-DIR-005, UI-DIR-006
function panels(ctx: ScreenContext): Child {
  const v = viewOf(ctx);
  const leads = new Map(v.seniorManagers.map((m) => [m.id, m]));
  const groupNames = new Map(v.groups.map((g) => [g.id, g.name]));
  const group = (g: DirectorView['groups'][number]) => unitCard({ ...g, leaderId: g.seniorManagerId }, 'group', 'No senior manager yet', g.seen === 'tour' ? 'as you saw it' : `at the survey in quarter ${g.quarter}`);
  return [
    h(
      'section',
      { 'data-panel': 'senior-managers', class: 'team' },
      h('h2', {}, 'Your senior managers'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.seniorManagers),
      v.groups.map((g) => {
        const m = g.seniorManagerId ? leads.get(g.seniorManagerId) : undefined;
        return m ? leaderCard(m, 'data-senior-manager', 'senior manager', group(g)) : group(g);
      }),
    ),
    h(
      'section',
      { 'data-panel': 'upward', class: 'team' },
      h('h2', {}, 'Above and beside you'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.upward),
      v.upward.map((u) => outsiderCard(u, { executive: 'your executive', peer: 'a peer director' })),
    ),
    h(
      'section',
      { 'data-panel': 'bets', class: 'projects' },
      h('h2', {}, 'Your bets'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.bets),
      v.bets.length
        ? v.bets.map((b) =>
            h('article', { 'data-bet': b.projectId, class: 'project' },
              h('strong', { 'data-field': 'name' }, b.name),
              h('p', {}, h('span', { 'data-field': 'group' }, groupNames.get(b.groupId) ?? 'a group'), ' · ', h('span', { 'data-field': 'progress' }, `${b.progress} / ${b.scope}`), ' done, due week ', h('span', { 'data-field': 'deadline' }, b.deadlineWeek + 1),
                ' · ', h('span', { 'data-field': 'schedule' }, SCHEDULE_WORDS[b.schedule])),
              h('p', {}, h('small', { 'data-field': 'stakes' }, stakes(b.landing, b.failing)))))
        : h('p', { class: 'quiet' }, 'No bet is funded.'),
    ),
    habitsPanel(ctx, PANEL_HELP.habits, habitControls(ctx, false)),
  ];
}

/** Headcount planning: a stepper per group and per funded bet, and the heads still to place. */
// @spec UI-DIR-007
function headcount(ctx: ScreenContext, m: DirectorView['moments'][number]): Child {
  const v = viewOf(ctx);
  const key = `headcount:${m.id}`;
  const counts = draftObject<number>(ctx.drafts.get(key)?.counts);
  const given = m.heads ?? 0;
  const placed = Object.values(counts).reduce((a, b) => a + b, 0);
  const set = (target: string, by: number) => () => {
    counts[target] = Math.max(0, (counts[target] ?? 0) + by);
    ctx.drafts.set(key, { counts: JSON.stringify(counts) });
    ctx.refresh();
  };
  const row = (target: string, name: string, field = 'bet') =>
    h('li', { 'data-target': target },
      h('span', { 'data-field': field }, name), ' ',
      h('button', { 'data-step-down': target, onClick: set(target, -1), disabled: !(counts[target] ?? 0) }, '−'),
      h('strong', { 'data-field': 'count' }, counts[target] ?? 0),
      h('button', { 'data-step-up': target, onClick: set(target, 1), disabled: placed >= given }, '+'));
  return h(
    'div',
    { 'data-detail': 'headcount', class: 'placement' },
    h('p', {}, 'Heads given: ', h('strong', { 'data-field': 'heads-given' }, given), ' · still to place: ', h('strong', { 'data-field': 'heads-left' }, given - placed)),
    h('ul', {}, v.groups.map((g) => row(`group:${g.id}`, `${g.name}: ${bandWord('stress', g.stress)}, ${plural(g.projects.length, 'project', 'projects')}`, 'group')), v.bets.map((b) => row(`bet:${b.projectId}`, `Behind ${b.name}`))),
    h('button', {
      'data-action': 'place-heads',
      class: 'primary',
      onClick: () => {
        const plan = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0).map(([t, n]) => [t.startsWith('group:') ? t.slice('group:'.length) : t, n]));
        ctx.send({ kind: 'answer', momentId: m.id, choiceId: `place:${JSON.stringify(plan)}` }, `moment:${m.id}`);
      },
    }, 'Place the heads'),
  );
}

/** Strategy bets: each offer, with a group to carry it or none. */
// @spec UI-DIR-008
function bets(ctx: ScreenContext, m: DirectorView['moments'][number]): Child {
  const v = viewOf(ctx);
  const key = `bets:${m.id}`;
  const picks = draftObject<string>(ctx.drafts.get(key)?.picks);
  const peers = new Map(v.upward.map((u) => [u.id, u]));
  // @spec UI-DIR-008
  const touches = (peerId: string) => {
    const p = peers.get(peerId);
    const who = p?.name ?? 'a peer';
    return ` · touches ${who}'s organization: ${who} ${p && p.trust >= PEER_HELPS_BAND ? 'trusts you enough to speed it' : "doesn't trust you enough yet to speed it"}`;
  };
  return h(
    'div',
    { 'data-detail': 'bets', class: 'bets' },
    h('p', { 'data-part': 'bet-capacity', class: 'help' }, 'A strained group carries a bet slowly; a peer who trusts you speeds the work that touches their organization.'),
    (m.offers ?? []).map((o) =>
      h('div', { 'data-offer': o.id, class: 'offer' },
        h('strong', { 'data-field': 'name' }, o.name),
        h('p', {}, `About ${o.scope} units of work, due in ${o.deadlineWeeks} weeks`, o.peerId ? touches(o.peerId) : ''),
        h('p', {}, h('small', { 'data-field': 'stakes' }, stakes(o.landing, o.failing))),
        h('label', {}, 'Carried by ',
          h('select', {
            value: picks[o.id] ?? '',
            onChange: (e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              if (value) picks[o.id] = value;
              else delete picks[o.id];
              ctx.drafts.set(key, { picks: JSON.stringify(picks) });
            },
          }, h('option', { value: '' }, 'Not funded'), v.groups.map((g) => h('option', { value: g.id }, `${g.name}: ${bandWord('stress', g.stress)}, ${plural(g.projects.length, 'project', 'projects')}`)))))),
    h('button', { 'data-action': 'fund-bets', class: 'primary', onClick: () => ctx.send({ kind: 'answer', momentId: m.id, choiceId: `fund:${JSON.stringify(picks)}` }, `moment:${m.id}`) }, 'Fund these bets'),
  );
}

/** A director moment for the scene: headcount's and bets' own scenes, and a senior manager's skill beside choices that depend on them. */
// @spec UI-DIR-007, UI-DIR-008, UI-DIR-009
function moment(ctx: ScreenContext, momentId: string): MomentDetails | undefined {
  const v = viewOf(ctx);
  const m = v.moments.find((x) => x.id === momentId);
  if (!m) return undefined;
  if (m.kind === 'headcount') return { title: m.title, text: m.text, detail: headcount(ctx, m), choices: m.choices };
  if (m.kind === 'bets') return { title: m.title, text: m.text, detail: bets(ctx, m), choices: m.choices };
  const lead = m.personId ? v.seniorManagers.find((x) => x.id === m.personId) : undefined;
  return { title: m.title, text: m.text, choices: m.choices.map((c) => ({ ...c, note: lead ? `leads: ${bandWord('skill', lead.skill)}` : undefined })) };
}

function betChips(a: DirectorView, b: DirectorView, out: Chip[]) {
  const betsNow = new Map(b.bets.map((x) => [x.projectId, x]));
  for (const x of a.bets) {
    const n = betsNow.get(x.projectId);
    if (n && n.schedule !== x.schedule) out.push({ key: `bet:${x.projectId}:schedule`, text: `${x.name}: ${SCHEDULE_WORDS[n.schedule]}`, tone: n.schedule === 'onSchedule' ? 'good' : 'bad' });
  }
}

/** A chip per band that moved, per change in a group's headcount, and per bet whose schedule changed. */
// @spec UI-DIR-010
function chips(before: unknown, after: unknown, rose: (personId: string) => boolean = () => false): Chip[] {
  const a = before as DirectorView;
  const b = after as DirectorView;
  const out: Chip[] = [];
  leaderChips(a.seniorManagers, b.seniorManagers, 'sm', rose, out);
  headcountChips(a.groups, b.groups, 'group', out);
  trustChips(a.upward, b.upward, out);
  betChips(a, b, out);
  playerChips(a.player, b.player, out);
  return out;
}

/** The director's part of the recap: what changed, or a quiet quarter, and the routine folded away. */
// @spec UI-DIR-011
function recap(run: Run, value: unknown): { changes: Child; routine: Child } {
  const r = value as DirectorRecap;
  const part = recapPart;
  const c = r.changes;
  const moved = c.moved ?? [];
  const quits = quitLastQuarter(run.level as DirectorState, run.sim);
  const lost = headsLostLastQuarter(run.level as DirectorState, run.sim);
  const quiet = !(c.seniorManagers.length || c.survey || c.heads.length || moved.length || quits.length || lost.length || c.bets.length || c.upward.length);
  return {
    changes: [
      quiet ? h('p', { 'data-part': 'recap-quiet', class: 'quiet' }, 'A quiet quarter.') : null,
      part('recap-left', 'Who left', [...quits.map((q) => h('li', { 'data-senior-manager': q.personId }, quitLine(q))), ...lost.map((x) => h('li', { 'data-group': x.groupId }, headsLostLine(x)))]),
      part('recap-senior-managers', 'Your senior managers', c.seniorManagers.map((m) => h('li', { 'data-senior-manager': m.id }, leaderLine(m)))),
      part('recap-survey', c.survey ? `The survey, quarter ${c.survey.quarter}` : 'The survey', (c.survey?.groups ?? []).map((g) => h('li', { 'data-group': g.id }, `${g.name}: ${bandWord('motivation', g.motivation)} and ${bandWord('stress', g.stress)}.`))),
      part('recap-heads', 'People', c.heads.map((x) => h('li', {}, headsChangeLine(x)))),
      part('recap-moved', 'Reorganized', moved.map((m) => h('li', {}, m.kind === 'split' ? `${m.from} split: ${m.count} moved to ${m.to}.` : `${m.from} merged into ${m.to}: ${m.count} moved.`))),
      part('recap-bets', 'Bets', c.bets.map((line) => h('li', {}, `${line}.`))),
      part('recap-upward', 'Above and beside you', c.upward.map((u) => h('li', { 'data-outsider': u.id }, `${u.name} ${u.change}.`))),
    ],
    routine: [part('recap-habits', 'Your habits', r.routine.habits.map((line) => h('li', {}, line))), part('recap-goals', 'Goals', r.routine.goals.map((g) => h('li', {}, `${g.text}: ${g.progress}`)))],
  };
}

/** The director's review measures by name. */
// @spec UI-DIR-012
const MEASURE_NAMES: Record<string, string> = {
  betsLanded: 'Bets landed',
  projectsOnTime: 'Projects shipped on time',
  regrettedAttrition: "People you'd have kept who left",
  motivation: 'Group motivation at the survey',
  stress: 'Group stress at the survey',
  executiveConfidence: "Your executive's confidence",
  reputation: 'Your reputation',
};

/** What moves each of the level's review measures, said beside one that held the rating back. */
// @spec UI-REVIEW-003
/** What keeps a stay conversation's promise at this level: the habit or state that serves the want it promised. */
// @spec UI-PROMISE-004
const PROMISE_KEEPS: Record<string, string> = {
  "stay:growth": "your time is not spent upward",
  "stay:autonomy": "your time is not all with your organization",
  "stay:recognition": "your staff meeting is weekly",
  "stay:stability": "their group stays below strained",
};

const MEASURE_LEVERS: Record<string, string> = {
  betsLanded: "fund a bet on a group with room, and put heads behind it; a strained group carries one slowly, and a peer who trusts you speeds it",
  projectsOnTime: "groups deliver what they can carry; heads placed where the work is, and calm groups, speed it",
  regrettedAttrition: "a group's risk of losing people follows its mood, low motivation twice as much as high stress: time with your organization lifts motivation, a stronger senior manager steadies both, and coaching or taking the decision on a group in trouble eases its stress; the recap's Who left names the groups",
  motivation: "groups drift toward what their senior managers sustain, and time with your organization lifts them",
  stress: "groups drift toward what their senior managers sustain; new heads add onboarding stress for a quarter",
  executiveConfidence: "telling the quarterly review straight, landing bets and time with the room above build it; heads held back, a failed bet or spin found out cost it",
  reputation: "bets landing raise it and bets failing lower it; leading the quarterly review with the wins earns some now and costs more if a problem surfaces",
};

function measureValue(_view: unknown, id: string, value: number): string | undefined {
  return id === 'betsLanded' ? shareWord(value, 'all') : sharedMeasureValue(id, value, ['executiveConfidence']);
}

/** The director's part of the career summary: quarters at the level, and the senior managers who joined and were let go. */
// @spec UI-DIR-013
const career = (view: unknown): Child => careerLines((view as DirectorView).career, 'director', { label: 'Senior managers', field: 'senior-managers' });

export const directorRenderer: LevelRenderer = {
  turn: 'quarter',
  help: DIRECTOR_HELP_TOPICS,
  firstTurn: { where: 'Before the quarter', heading: 'How you run your organization', intro: 'Your groups now run through their senior managers, and your executive and peers are watching. Decide where your time goes, how you meet your senior managers and whether you listen inside the groups, before the quarter begins.' },
  // @spec UI-DIR-015
  handover: {
    question: () => 'Who leads your group now?',
    hire: 'An outside hire: a capable senior manager you don’t know yet',
    trade: 'One of your managers brings the trust they’ve built with you. An outside hire is capable, but a stranger in charge unsettles the group at first.',
  },
  stayed: {
    outcome: 'This was your last review as a director. Three years in, the promotion never came.',
    ending: 'You stayed a director. Three years went by without the promotion.',
  },
  panels,
  habits: (ctx) => habitControls(ctx, true),
  moment,
  chips,
  recap,
  status: (view) => {
    const v = view as DirectorView;
    return { energy: v.player.energy, reputation: v.player.reputation, goals: v.goals, edge: { at: v.player.edge.at, weeks: v.player.edge.quarters, limit: v.player.edge.limit } };
  },
  measureName: (view, id) => MEASURE_NAMES[id] ?? (view as DirectorView).goals.find((g) => `goal:${g.id}` === id)?.text,
  measureValue,
  measureLever: (id) => MEASURE_LEVERS[id],
  promiseKeeps: (kindId) => PROMISE_KEEPS[kindId],
  career,
};
