import { headcountWords, moverInto } from './chips';
import { draftObject } from './drafts';
import { quitLastQuarter, type DirectorRecap, type DirectorState, type DirectorView } from '../levels/director';
import type { Run } from '../loop';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { headsChangeLine, quitLine, shareWord } from './text';
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
  seniorManagers: 'Each group’s mood is from the last survey, unless your listening tour saw it this quarter.',
  upward: 'How much your executive and peers trust you shapes your headcount and your bets.',
  bets: 'A bet lands if its project ships by its deadline.',
  habits: 'Changes apply from this quarter’s end, and to moments from next quarter.',
};

const HABITS = {
  time: { label: 'Where your time goes', options: { organization: 'Your organization', balanced: 'Balanced', upward: 'The room above' }, what: 'Time upward earns your executive’s and peers’ trust; time with your organization keeps your groups and senior managers with you.' },
  staffMeeting: { label: 'Staff meeting', options: { weekly: 'Weekly', fortnightly: 'Fortnightly' }, what: 'Your senior managers together: it builds their trust and tells you what each wants. Weekly costs more of your energy.' },
  listeningTour: { label: 'Listening tour', options: { none: 'None', quarterly: 'Quarterly' }, what: 'Each quarter you spend time inside one group: you see how it really is, and hear what its senior manager hasn’t said.' },
} as const;
const SCHEDULE_WORDS = { onSchedule: 'on schedule', behind: 'behind', overdue: 'overdue' } as const;

const viewOf = (ctx: ScreenContext) => ctx.view as DirectorView;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** A bet's stakes in words, not numbers. */
const stakes = (landing: number, failing: number) => `lands: ${landing >= 10 ? 'a big win' : 'a win'}; fails: ${failing >= 12 ? 'a hard knock' : 'a knock'}`;

/** The habit controls, sending a habit change at once. */
// @spec UI-DIR-006
function habitControls(ctx: ScreenContext, withHelp: boolean): Child {
  const v = viewOf(ctx);
  return (Object.keys(HABITS) as (keyof typeof HABITS)[]).map((id) =>
    h(
      'div',
      { class: 'habit' },
      h('label', {}, h('span', { class: 'habit-name' }, HABITS[id].label), ' ',
        h(
          'select',
          { 'data-habit': id, value: v.habits[id], onChange: (e: Event) => ctx.send({ kind: 'plan', command: { kind: 'habit', habit: id, value: (e.target as HTMLSelectElement).value } }, `habit:${id}`, { keepFocus: true }) },
          Object.entries(HABITS[id].options).map(([value, text]) => h('option', { value }, text)),
        ),
        ctx.errorFor(`habit:${id}`)),
      withHelp ? h('p', { class: 'help' }, HABITS[id].what) : null,
    ),
  );
}

const projectLine = (p: { id: string; name: string; progress: number; scope: number; deadlineWeek: number; schedule: keyof typeof SCHEDULE_WORDS }) =>
  h('p', { 'data-project': p.id, class: 'project' },
    h('span', { 'data-field': 'name' }, p.name), ': ',
    h('span', { 'data-field': 'progress' }, `${p.progress} / ${p.scope}`), ' done, due week ', h('span', { 'data-field': 'deadline' }, p.deadlineWeek + 1),
    ' · ', h('span', { 'data-field': 'schedule' }, SCHEDULE_WORDS[p.schedule]));

/** The senior managers with their groups, the room above, the bets and the habits. */
// @spec UI-DIR-002, UI-DIR-003, UI-DIR-004, UI-DIR-005, UI-DIR-006
function panels(ctx: ScreenContext): Child {
  const v = viewOf(ctx);
  const leads = new Map(v.seniorManagers.map((m) => [m.id, m]));
  const groupNames = new Map(v.groups.map((g) => [g.id, g.name]));
  const group = (g: DirectorView['groups'][number]) =>
    h(
      'div',
      { 'data-group': g.id, ...(g.seniorManagerId ? {} : { 'data-leaderless': true }), class: 'team-card' },
      h('strong', { 'data-field': 'group-name' }, g.name),
      g.seniorManagerId ? null : h('p', { class: 'leaderless' }, 'No senior manager yet'),
      h('p', { class: 'facts' },
        h('span', { 'data-field': 'headcount' }, plural(g.headcount, 'person', 'people')),
        ' · seem ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', g.motivation)),
        ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', g.stress)),
        ' · risk of losing people ', h('span', { 'data-field': 'attrition' }, bandWord('risk', g.attritionRisk))),
      h('p', { class: 'source' }, h('small', { 'data-field': 'source' }, g.seen === 'tour' ? 'as you saw it' : `at the survey in quarter ${g.quarter}`)),
      g.projects.map(projectLine),
    );
  return [
    h(
      'section',
      { 'data-panel': 'senior-managers', class: 'team' },
      h('h2', {}, 'Your senior managers'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.seniorManagers),
      v.groups.map((g) => {
        const m = g.seniorManagerId ? leads.get(g.seniorManagerId) : undefined;
        if (!m) return group(g);
        return h(
          'article',
          { 'data-senior-manager': m.id, class: 'person' },
          h('div', { class: 'who' }, h('strong', { 'data-field': 'name' }, m.name), h('span', { class: 'role' }, 'senior manager · ', h('span', { 'data-field': 'personality' }, m.personality ?? ''))),
          h('p', { class: 'mood' }, 'Seems ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', m.motivation)), ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', m.stress)), '.'),
          h('p', { class: 'facts' }, 'Leads: ', h('span', { 'data-field': 'skill' }, bandWord('skill', m.skill)), ' · wants ', h('span', { 'data-field': 'want' }, m.want), ' · ', h('span', { 'data-field': 'performance' }, m.performance)),
          m.memory.length ? h('ul', { 'data-part': 'memory', class: 'memory' }, m.memory.map((note) => h('li', {}, note))) : null,
          group(g),
        );
      }),
    ),
    h(
      'section',
      { 'data-panel': 'upward', class: 'team' },
      h('h2', {}, 'Above and beside you'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.upward),
      v.upward.map((u) =>
        h(
          'article',
          { 'data-outsider': u.id, class: 'person' },
          h('div', { class: 'who' }, h('strong', { 'data-field': 'name' }, u.name), h('span', { class: 'role' }, h('span', { 'data-field': 'role' }, u.role === 'executive' ? 'your executive' : 'a peer director'), ' · ', h('span', { 'data-field': 'personality' }, u.personality ?? ''))),
          h('p', { class: 'facts' }, 'Trusts you: ', h('span', { 'data-field': 'trust' }, bandWord('trust', u.trust)), ' · wants ', h('span', { 'data-field': 'want' }, u.want)),
          u.memory.length ? h('ul', { 'data-part': 'memory', class: 'memory' }, u.memory.map((note) => h('li', {}, note))) : null,
        ),
      ),
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
    h(
      'details',
      { 'data-panel': 'habits', class: 'habits', open: ctx.drafts.get('habits')?.open === 'true', onToggle: (e: Event) => ctx.drafts.set('habits', { open: String((e.target as HTMLDetailsElement).open) }) },
      h('summary', {}, 'Your habits'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.habits),
      habitControls(ctx, false),
    ),
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
  const row = (target: string, name: string) =>
    h('li', { 'data-target': target },
      h('span', {}, name), ' ',
      h('button', { 'data-step-down': target, onClick: set(target, -1), disabled: !(counts[target] ?? 0) }, '−'),
      h('strong', { 'data-field': 'count' }, counts[target] ?? 0),
      h('button', { 'data-step-up': target, onClick: set(target, 1), disabled: placed >= given }, '+'));
  return h(
    'div',
    { 'data-detail': 'headcount', class: 'placement' },
    h('p', {}, 'Heads given: ', h('strong', { 'data-field': 'heads-given' }, given), ' · still to place: ', h('strong', { 'data-field': 'heads-left' }, given - placed)),
    h('ul', {}, v.groups.map((g) => row(`group:${g.id}`, g.name)), v.bets.map((b) => row(`bet:${b.projectId}`, `Behind ${b.name}`))),
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
  const peers = new Map(v.upward.map((u) => [u.id, u.name]));
  return h(
    'div',
    { 'data-detail': 'bets', class: 'bets' },
    h('p', { 'data-part': 'bet-capacity', class: 'help' }, 'A strained group carries a bet slowly; a peer who trusts you speeds the work that touches their organization.'),
    (m.offers ?? []).map((o) =>
      h('div', { 'data-offer': o.id, class: 'offer' },
        h('strong', { 'data-field': 'name' }, o.name),
        h('p', {}, `About ${o.scope} units of work, due in ${o.deadlineWeeks} weeks`, o.peerId ? ` · touches ${peers.get(o.peerId) ?? 'a peer'}'s organization` : ''),
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

function leaderChips(a: DirectorView, b: DirectorView, rose: (personId: string) => boolean, out: Chip[]) {
  const move = moverInto(out);
  const leads = new Map(b.seniorManagers.map((m) => [m.id, m]));
  for (const m of a.seniorManagers) {
    const n = leads.get(m.id);
    if (!n) continue;
    move(`sm:${m.id}:motivation`, m.name, m.motivation, n.motivation, true, 'more motivated', 'less motivated');
    move(`sm:${m.id}:stress`, m.name, m.stress, n.stress, false, 'more stressed', 'less stressed');
    if (m.stress === n.stress && rose(m.id)) out.push({ key: `sm:${m.id}:heavier`, text: `${m.name}: a heavier week`, tone: 'bad' });
    move(`sm:${m.id}:skill`, m.name, m.skill, n.skill, true, 'a better leader', 'a weaker leader');
  }
}

function groupChips(a: DirectorView, b: DirectorView, out: Chip[]) {
  const groups = new Map(b.groups.map((g) => [g.id, g]));
  for (const g of a.groups) {
    const n = groups.get(g.id);
    const d = n ? n.headcount - g.headcount : 0;
    if (d !== 0) out.push({ key: `group:${g.id}:headcount`, text: `${g.name}: ${headcountWords(d)}`, tone: d > 0 ? 'good' : 'bad' });
  }
}

function outsiderAndBetChips(a: DirectorView, b: DirectorView, out: Chip[]) {
  const move = moverInto(out);
  const above = new Map(b.upward.map((u) => [u.id, u]));
  for (const u of a.upward) {
    const n = above.get(u.id);
    if (n) move(`outsider:${u.id}:trust`, u.name, u.trust, n.trust, true, 'trusts you more', 'trusts you less');
  }
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
  leaderChips(a, b, rose, out);
  groupChips(a, b, out);
  outsiderAndBetChips(a, b, out);
  const move = moverInto(out);
  move('player:energy', 'You', a.player.energy, b.player.energy, true, 'more energy', 'less energy');
  move('player:reputation', 'Your reputation', a.player.reputation, b.player.reputation, true, 'up', 'down');
  return out;
}

/** The director's part of the recap: what changed, or a quiet quarter, and the routine folded away. */
// @spec UI-DIR-011
function recap(run: Run, value: unknown): { changes: Child; routine: Child } {
  const r = value as DirectorRecap;
  const part = (name: string, title: string, items: Child[]) => (items.length ? h('div', { 'data-part': name }, h('h3', {}, title), h('ul', {}, items)) : h('div', { 'data-part': name }));
  const c = r.changes;
  const moved = c.moved ?? [];
  const quits = quitLastQuarter(run.level as DirectorState, run.sim);
  const quiet = !(c.seniorManagers.length || c.survey || c.heads.length || moved.length || quits.length || c.bets.length || c.upward.length);
  return {
    changes: [
      quiet ? h('p', { 'data-part': 'recap-quiet', class: 'quiet' }, 'A quiet quarter.') : null,
      part('recap-left', 'Who left', quits.map((q) => h('li', { 'data-senior-manager': q.personId }, quitLine(q)))),
      part('recap-senior-managers', 'Your senior managers', c.seniorManagers.map((m) => h('li', { 'data-senior-manager': m.id }, h('strong', {}, m.changes.length ? `${m.name}: ${m.changes.join(' and ')}.` : `${m.name}.`), m.notes.length ? ` ${m.notes.join('. ')}.` : ''))),
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

function measureValue(_view: unknown, id: string, value: number): string | undefined {
  if (id.startsWith('goal:')) return value >= 1 ? 'met' : 'missed';
  const band = Math.max(0, Math.min(4, Math.floor(value / 20)));
  switch (id) {
    case 'betsLanded':
      return shareWord(value, 'all');
    case 'projectsOnTime':
    case 'regrettedAttrition':
      return value === 0 ? 'none' : String(value);
    case 'executiveConfidence':
      return bandWord('trust', band);
    case 'motivation':
    case 'stress':
    case 'reputation':
      return bandWord(id, band);
    default:
      return undefined;
  }
}

/** The director's part of the career summary: quarters at the level, and the senior managers who joined and were let go. */
// @spec UI-DIR-013
function career(view: unknown): Child {
  const c = (view as DirectorView).career;
  const names = (xs: string[]) => (xs.length ? xs.join(', ') : 'nobody');
  return [
    h('li', {}, 'Quarters as a director: ', h('span', { 'data-field': 'quarters' }, c.quarters)),
    h('li', {}, 'Senior managers who joined: ', h('span', { 'data-field': 'senior-managers-joined' }, names(c.joined))),
    h('li', {}, 'Senior managers you let go: ', h('span', { 'data-field': 'senior-managers-let-go' }, names(c.letGo))),
  ];
}

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
  career,
};
