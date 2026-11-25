import { RATING_WORDS, WORK_LABELS, band, movedLastWeek, quitLastWeek, shippedLastWeek, type Habits, type HabitId, type LineState, type Recap, type View } from '../levels/line-manager';
import type { Run } from '../loop';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { HELP_TOPICS, PANEL_HELP } from './help';
import { lateness, moveLine, quitLine } from './text';
import type { Chip, LevelRenderer, MomentDetails, ScreenContext } from './app';

/** Each habit's name, what it does, and its settings' labels; engineer-naming habits list the team after the first. */
const HABITS: Record<HabitId, { label: string; what: string; options: Record<string, string> }> = {
  nightPages: {
    label: 'Night pages',
    what: 'Who answers when a service goes down overnight.',
    options: { rotation: 'A rotation through the team', seniors: 'The most skilled engineer', me: 'You take them' },
  },
  oneOnOnes: {
    label: '1:1s',
    what: 'How often you sit down with each engineer. They build trust and tell you what people want.',
    options: { fortnightly: 'Every other week', weekly: 'Every week', whenNeeded: 'Only when needed' },
  },
  approvals: { label: 'Routine approvals', what: 'Who signs off releases, access and expenses. Those beyond them come to you.', options: { me: 'You' } },
  ceremonies: {
    label: 'Ceremonies',
    what: 'Stand-ups, planning and retros: steadiness for the team, time for you.',
    options: { full: 'Full', light: 'Light' },
  },
  growth: { label: 'Growth focus', what: 'One engineer you coach each week.', options: { nobody: 'Nobody' } },
};
const HABIT_IDS = Object.keys(HABITS) as HabitId[];
const NAMES_ENGINEERS = new Set<HabitId>(['approvals', 'growth']);

const viewOf = (ctx: ScreenContext) => ctx.view as View;

/** A project's schedule status in words. */
const SCHEDULE_WORDS: Record<View['projects'][number]['schedule'], string> = { onSchedule: 'on schedule', behind: 'behind', overdue: 'overdue' };

/** A control per habit, sending a habit change at once. */
// @spec UI-LINE-006
function habitControls(ctx: ScreenContext, withHelp: boolean): Child {
  const v = viewOf(ctx);
  return HABIT_IDS.map((id) => {
    const habit = HABITS[id];
    const options = Object.entries(habit.options);
    if (NAMES_ENGINEERS.has(id)) options.push(...v.people.map((p): [string, string] => [p.id, p.name]));
    const control = `habit:${id}`;
    return h(
      'div',
      { class: 'habit' },
      h('label', {}, h('span', { class: 'habit-name' }, habit.label), ' ',
        h(
          'select',
          {
            'data-habit': id,
            value: v.habits[id as keyof Habits],
            onChange: (e: Event) => ctx.send({ kind: 'plan', command: { kind: 'habit', habit: id, value: (e.target as HTMLSelectElement).value } }, control, { keepFocus: true }),
          },
          options.map(([value, label]) => h('option', { value }, label)),
        ),
        ctx.errorFor(control)),
      withHelp ? h('p', { class: 'help' }, habit.what) : null,
    );
  });
}

/** The panels beside the scene: the team, open vacancies, projects and habits. */
// @spec UI-LINE-001, UI-LINE-002, UI-LINE-005, UI-LINE-006, UI-HELP-002
function panels(ctx: ScreenContext): Child {
  const v = viewOf(ctx);
  const chosen = ctx.drafts.get('habits')?.open;
  const habitsOpen = chosen === undefined ? ctx.run.sim.week === 0 : chosen === 'true';
  return [
    h(
      'section',
      { 'data-panel': 'team', class: 'team' },
      h('h2', {}, 'Your team'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.team),
      v.people.map((p) =>
        h(
          'article',
          { 'data-person': p.id, class: 'person' },
          h('div', { class: 'who' },
            h('strong', { 'data-field': 'name' }, p.name),
            h('span', { class: 'role' }, h('span', { 'data-field': 'role' }, p.role), ' · ', h('span', { 'data-field': 'personality' }, p.personality ?? ''))),
          h('p', { class: 'mood' },
            'Seems ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', p.motivation)),
            ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', p.stress)), '.'),
          h('p', { class: 'facts' },
            'Skill ', h('span', { 'data-field': 'skill' }, bandWord('skill', p.skill)),
            ' · wants ', h('span', { 'data-field': 'want' }, p.want),
            ' · ', h('span', { 'data-field': 'performance' }, p.performance),
            ' · ', h('span', { 'data-field': 'tenure' }, `${p.tenureWeeks} ${p.tenureWeeks === 1 ? 'week' : 'weeks'} here`)),
          p.memory.length ? h('ul', { 'data-part': 'memory', class: 'memory' }, p.memory.map((note) => h('li', {}, note))) : null,
        ),
      ),
    ),
    v.vacancies.length
      ? h(
          'section',
          { 'data-panel': 'vacancies' },
          h('h3', {}, 'Open roles'),
          h('ul', {}, v.vacancies.map((x) => h('li', { 'data-vacancy': x.id }, 'One open role: ', h('span', { 'data-field': 'interviews' }, `${x.interviews} ${x.interviews === 1 ? 'interview' : 'interviews'} so far`)))),
        )
      : null,
    h(
      'section',
      { 'data-panel': 'projects', class: 'projects' },
      h('h2', {}, 'Projects'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.projects),
      v.projects.map((p) =>
        h(
          'article',
          { 'data-project': p.id, class: 'project' },
          h('strong', { 'data-field': 'name' }, p.name),
          h('p', {},
            h('span', { 'data-field': 'progress' }, `${p.progress} / ${p.scope}`), ' done, due week ', h('span', { 'data-field': 'deadline' }, p.deadlineWeek + 1),
            ' · ', h('span', { 'data-field': 'schedule' }, SCHEDULE_WORDS[p.schedule])),
          h('p', {}, 'Risk ', h('span', { 'data-field': 'risk' }, bandWord('risk', p.risk)), ' · tech debt ', h('span', { 'data-field': 'tech-debt' }, bandWord('risk', p.techDebt))),
        ),
      ),
    ),
    h(
      'details',
      { 'data-panel': 'habits', class: 'habits', open: habitsOpen, onToggle: (e: Event) => ctx.drafts.set('habits', { open: String((e.target as HTMLDetailsElement).open) }) },
      h('summary', {}, 'Your habits'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.habits),
      habitControls(ctx, false),
    ),
  ];
}

/** A line manager moment for the scene: its words beside the choices that name an engineer. */
// @spec UI-LINE-007
function moment(ctx: ScreenContext, momentId: string): MomentDetails | undefined {
  const v = viewOf(ctx);
  const m = v.moments.find((x) => x.id === momentId);
  if (!m) return undefined;
  const people = new Map(v.people.map((p) => [p.id, p]));
  return {
    title: m.title,
    text: m.text,
    detail: m.difficulty === undefined ? null : h('p', { class: 'difficulty' }, 'Difficulty: ', h('strong', { 'data-field': 'difficulty' }, bandWord('skill', m.difficulty))),
    choices: m.choices.map((c) => {
      const id = c.id.startsWith('give:') ? c.id.slice('give:'.length) : c.id.startsWith('ask:') ? c.id.slice('ask:'.length) : undefined;
      const p = id ? people.get(id) : undefined;
      return { id: c.id, label: c.label, note: p ? `${bandWord('skill', p.skill)}, ${bandWord('stress', p.stress)}` : undefined };
    }),
  };
}

/** A chip per band that moved between two views, per person who left or joined, and per new memory note on someone with no band chip. */
// @spec UI-WEEK-008, UI-WEEK-010, UI-WEEK-018
function chips(before: unknown, after: unknown): Chip[] {
  const a = before as View;
  const b = after as View;
  const out: Chip[] = [];
  const move = (key: string, who: string, was: number, now: number, upIsGood: boolean, up: string, down: string) => {
    if (was !== now) out.push({ key, text: `${who}: ${now > was ? up : down}`, tone: now > was === upIsGood ? 'good' : 'bad' });
  };
  const afterPeople = new Map(b.people.map((p) => [p.id, p]));
  for (const p of a.people) {
    const q = afterPeople.get(p.id);
    if (!q) {
      out.push({ key: `person:${p.id}:left`, text: `${p.name}: left the team`, tone: 'bad' });
      continue;
    }
    move(`person:${p.id}:motivation`, p.name, p.motivation, q.motivation, true, 'more motivated', 'less motivated');
    move(`person:${p.id}:stress`, p.name, p.stress, q.stress, false, 'more stressed', 'less stressed');
    const banded = p.motivation !== q.motivation || p.stress !== q.stress;
    if (!banded && q.notes > p.notes && q.lastNote) out.push({ key: `person:${p.id}:note`, text: `${p.name}: ${q.lastNote}`, tone: 'neutral' });
  }
  const was = new Set(a.people.map((p) => p.id));
  for (const q of b.people) if (!was.has(q.id)) out.push({ key: `person:${q.id}:joined`, text: `${q.name}: joined the team`, tone: 'good' });
  move('player:energy', 'You', a.player.energy, b.player.energy, true, 'more energy', 'less energy');
  // One piece of work rarely moves a band of energy; without this, doing it yourself would look free.
  if (a.player.energy === b.player.energy && b.player.energySpent > a.player.energySpent) out.push({ key: 'player:energy-spent', text: 'You: energy spent', tone: 'bad' });
  move('player:reputation', 'Your reputation', a.player.reputation, b.player.reputation, true, 'up', 'down');
  const afterProjects = new Map(b.projects.map((p) => [p.id, p]));
  for (const p of a.projects) {
    const q = afterProjects.get(p.id);
    if (!q) continue;
    move(`project:${p.id}:risk`, p.name, p.risk, q.risk, false, 'riskier', 'less risky');
    move(`project:${p.id}:techDebt`, p.name, p.techDebt, q.techDebt, false, 'more tech debt', 'less tech debt');
  }
  return out;
}

const LEFT_WORDS: Record<string, string> = { quit: 'quit', fired: 'let go', transferred: 'moved' };

/** The line manager's part of the career summary: projects shipped on time, who joined, who left and why. */
// @spec UI-LINE-010
function career(view: unknown): Child {
  const c = (view as View).career;
  const names = (xs: string[]) => (xs.length ? xs.join(', ') : 'nobody');
  return [
    h('li', {}, 'Projects shipped on time: ', h('span', { 'data-field': 'shipped' }, c.shippedOnTime)),
    h('li', {}, 'Joined: ', h('span', { 'data-field': 'joined' }, names(c.joined.map((p) => p.name)))),
    h('li', {}, 'Left: ', h('span', { 'data-field': 'left' }, names(c.left.map((p) => `${p.name} (${LEFT_WORDS[p.reason] ?? p.reason})`)))),
  ];
}

/** The line manager's review measures by name. */
// @spec UI-LINE-009
const MEASURE_NAMES: Record<string, string> = {
  completedOnTime: 'Projects shipped on time',
  onScheduleShare: 'Projects on schedule',
  regrettedQuits: 'People who quit',
  motivation: 'Team motivation',
  stress: 'Team stress',
  oneOnOneShare: '1:1s held',
  reputation: 'Your reputation',
};

/** A line manager review measure's value in words: counts, shares, bands, and a goal met or missed. */
// @spec UI-LINE-009
function measureValue(_view: unknown, id: string, value: number): string | undefined {
  // A share short of all, or above none, never rounds to 100% or 0%.
  const share = (all: string) => (value >= 1 ? all : value <= 0 ? 'none' : `${Math.min(99, Math.max(1, Math.round(value * 100)))}%`);
  if (id.startsWith('goal:')) return value >= 1 ? 'met' : 'missed';
  switch (id) {
    case 'completedOnTime':
    case 'regrettedQuits':
      return value === 0 ? 'none' : String(value);
    case 'onScheduleShare':
      return share('all');
    case 'oneOnOneShare':
      return share('everyone');
    case 'motivation':
    case 'stress':
    case 'reputation':
      return bandWord(id, band(value));
    default:
      return undefined;
  }
}

/** The line manager's part of the recap: what changed (people, evaluations, what slipped...) and the routine (habits, goals). */
// @spec UI-LINE-008, UI-LINE-011, UI-QUIT-001
function recap(run: Run, recapValue: unknown): { changes: Child; routine: Child } {
  const r = recapValue as Recap;
  const shipped = shippedLastWeek(run.level as LineState, run.sim);
  const quits = quitLastWeek(run.level as LineState, run.sim);
  // A project that went backwards or had a setback is news; the rest moved by the team's work, most weeks alone.
  const moves = movedLastWeek(run.level as LineState, run.sim);
  const lostGround = moves.filter((m) => m.end < m.start || m.causes.some((c) => c.cause === 'setback'));
  const moved = moves.filter((m) => !lostGround.includes(m));
  const subject = ({ kind, id }: { kind: string; id: string }) =>
    kind === 'person' ? (run.sim.people[id]?.name ?? id) : kind === 'project' ? (run.sim.projects[id]?.name ?? id) : (run.sim.teams[id]?.name ?? id);
  const part = (name: string, title: string, items: Child[]) => (items.length ? h('div', { 'data-part': name }, h('h3', {}, title), h('ul', {}, items)) : h('div', { 'data-part': name }));
  const quiet = !(r.recalled || r.people.length || r.evaluations.length || r.habitChanges.length || r.expired.length || r.held.length || r.assigned.length || shipped.length || quits.length || lostGround.length);
  return {
    changes: [
      quiet ? h('p', { 'data-part': 'recap-quiet', class: 'quiet' }, 'A quiet week.') : null,
      part('recap-shipped', 'Shipped', shipped.map((p) => h('li', {}, `${p.name} shipped ${lateness(p.weeksLate)}.`))),
      part('recap-left', 'Who left', quits.map((q) => h('li', { 'data-person': q.personId }, quitLine(q)))),
      r.people.length || r.recalled
        ? h(
            'div',
            { 'data-part': 'recap-people' },
            h('h3', {}, 'Your people'),
            r.people.length ? h('ul', {}, r.people.map((p) => h('li', { 'data-person': p.personId }, h('strong', {}, p.changes.length ? `${p.name}: ${p.changes.join(' and ')}.` : `${p.name}.`), p.notes.length ? ` ${p.notes.join('. ')}.` : ''))) : null,
            r.recalled ? h('p', { 'data-recalled': r.recalled.personId, class: 'recalled' }, r.recalled.text) : null,
          )
        : h('div', { 'data-part': 'recap-people' }),
      part('recap-evaluations', 'Evaluations', r.evaluations.map((e) => h('li', { 'data-person': e.personId }, `You rated ${e.name} ${RATING_WORDS[e.rating]} on what they delivered.`))),
      part('recap-habit-changes', 'Habits that changed', r.habitChanges.map((line) => h('li', {}, line))),
      part('recap-lost-ground', 'Projects that lost ground', lostGround.map((m) => h('li', { 'data-project': m.projectId }, moveLine(m)))),
      part('recap-slipped', 'What slipped', r.expired.map((e) => h('li', {}, `A ${WORK_LABELS[e.kind]} for ${subject(e.subject)}`))),
      part('recap-held', 'Waiting for you', r.held.map((p) => h('li', { 'data-person': p.personId }, `${p.name}'s final evaluation waits for you on Monday.`))),
      part('recap-assigned', 'New work', r.assigned.map((p) => h('li', {}, `Your manager assigned ${p.name} to the team.`))),
    ],
    routine: [
      part('recap-habits', 'Your habits', r.habits.map((line) => h('li', {}, line))),
      part('recap-projects', 'Projects', moved.map((m) => h('li', { 'data-project': m.projectId }, moveLine(m)))),
      part('recap-goals', 'Goals', r.goals.map((g) => h('li', {}, g.text))),
    ],
  };
}

export const lineManagerRenderer: LevelRenderer = {
  turn: 'week',
  help: HELP_TOPICS,
  firstTurn: { where: 'Before Monday', heading: 'How you run your team', intro: 'Your habits handle the routine, so the week can be about the moments that matter. You can change them any time.' },
  stayed: {
    outcome: 'This was your last review as a line manager. Two years in, the promotion never came.',
    ending: 'You stayed a line manager. Two years went by without the promotion.',
  },
  panels,
  habits: (ctx) => habitControls(ctx, true),
  moment,
  chips,
  recap,
  status: (view) => {
    const v = view as View;
    return { energy: v.player.energy, reputation: v.player.reputation, goals: v.goals, edge: v.player.edge };
  },
  measureName: (view, id) => MEASURE_NAMES[id] ?? (view as View).goals.find((g) => `goal:${g.id}` === id)?.text,
  measureValue,
  career,
};
