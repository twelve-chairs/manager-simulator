import { ACTIONS, type ActionId, type Cadence, type Decision, type LinePlan, type LineState, type NewEntry, type Target, type View } from '../levels/line-manager';
import type { SimState } from '../sim';
import type { ScreenContext } from './app';
import { bandWord } from './bands';
import { h, type Child } from './dom';

const ACTION_LABELS: Record<ActionId, string> = {
  'line-manager.one-on-one': '1:1',
  'line-manager.coaching': 'Coaching',
  'line-manager.recognition': 'Recognition',
  'line-manager.training': 'Training',
  'line-manager.ceremonies': 'Ceremonies',
  'line-manager.project-planning': 'Project planning',
  'line-manager.scope-negotiation': 'Scope negotiation',
  'line-manager.team-event': 'Team event',
  'line-manager.interview': 'Interview',
  'line-manager.recovery': 'Recovery time',
};

const CADENCE_LABELS: Record<Cadence, string> = { weekly: 'every week', biweekly: 'every other week', once: 'this week only' };

const nameOf = (sim: SimState, level: LineState, target: { kind: string; id?: string }): string => {
  switch (target.kind) {
    case 'person':
      return sim.people[target.id!]?.name ?? target.id!;
    case 'project':
      return sim.projects[target.id!]?.name ?? target.id!;
    case 'team':
      return sim.teams[target.id!]?.name ?? target.id!;
    case 'vacancy':
      return `vacancy ${target.id}`;
    default:
      return level.teamId === target.id ? 'your team' : 'you';
  }
};

/** The line manager's panels on the week screen: team, projects, inbox and calendar. */
export function lineManagerPanels(ctx: ScreenContext): Child {
  const level = ctx.run.level as LineState;
  const plan = ctx.run.plan as LinePlan;
  const view = ctx.view as View;
  return [team(view), projects(view), inbox(ctx, level, plan, view), calendar(ctx, level, view)];
}

// @spec UI-LINE-001
function team(view: View) {
  return h(
    'section',
    { 'data-panel': 'team' },
    h('h2', {}, 'Your team'),
    h(
      'table',
      {},
      h('tr', {}, ['Name', 'Role', 'Weeks here', 'Rating', 'Motivation', 'Stress', 'Skill', 'Wants'].map((c) => h('th', {}, c))),
      view.people.map((p) =>
        h(
          'tr',
          { 'data-person': p.id },
          h('td', { 'data-field': 'name' }, p.name),
          h('td', { 'data-field': 'role' }, p.role),
          h('td', { 'data-field': 'tenure' }, p.tenureWeeks),
          h('td', { 'data-field': 'performance' }, p.performance),
          h('td', { 'data-field': 'motivation' }, bandWord('motivation', p.motivation)),
          h('td', { 'data-field': 'stress' }, bandWord('stress', p.stress)),
          h('td', { 'data-field': 'skill' }, bandWord('skill', p.skill)),
          h('td', { 'data-field': 'want' }, p.want),
        ),
      ),
    ),
  );
}

// @spec UI-LINE-002
function projects(view: View) {
  return h(
    'section',
    { 'data-panel': 'projects' },
    h('h2', {}, 'Projects'),
    h(
      'table',
      {},
      h('tr', {}, ['Project', 'Progress', 'Due week', 'Schedule', 'Risk', 'Tech debt'].map((c) => h('th', {}, c))),
      view.projects.map((p) =>
        h(
          'tr',
          { 'data-project': p.id },
          h('td', { 'data-field': 'name' }, p.name),
          h('td', { 'data-field': 'progress' }, `${Math.round(p.progress)} / ${p.scope}`),
          h('td', { 'data-field': 'deadline' }, p.deadlineWeek),
          h('td', { 'data-field': 'schedule' }, p.schedule),
          h('td', { 'data-field': 'risk' }, bandWord('risk', p.risk)),
          h('td', { 'data-field': 'tech-debt' }, bandWord('risk', p.techDebt)),
        ),
      ),
    ),
  );
}

const describeDecision = (d: Decision | undefined, sim: SimState) =>
  !d ? 'undecided' : d.kind === 'delegate' ? `delegate to ${sim.people[d.to]?.name ?? d.to}` : d.kind;

// @spec UI-LINE-003
function inbox(ctx: ScreenContext, level: LineState, plan: LinePlan, view: View) {
  const sim = ctx.run.sim;
  const decide = (demandId: string, decision: Decision) => ctx.send({ kind: 'plan', command: { kind: 'decide', demandId, decision } }, `demand:${demandId}`);
  const clear = (demandId: string) => ctx.send({ kind: 'plan', command: { kind: 'clear', demandId } }, `demand:${demandId}`);
  return h(
    'section',
    { 'data-panel': 'inbox' },
    h('h2', {}, 'Inbox'),
    view.inbox.length === 0 ? h('p', {}, 'Nothing waiting.') : null,
    view.inbox.map((d) => {
      const requester = d.subject.kind === 'person' ? d.subject.id : undefined;
      const delegates = view.people.filter((p) => p.id !== requester);
      // The chosen delegate is kept as a draft, so a redraw before the player clicks Delegate does not reset it.
      const draftKey = `delegate:${d.id}`;
      const chosen = delegates.find((p) => p.id === ctx.drafts.get(draftKey)?.to)?.id ?? delegates[0]?.id;
      const picker = h(
        'select',
        { 'data-input': 'delegate-to', 'aria-label': 'Delegate to', value: chosen, onChange: (e: Event) => ctx.drafts.set(draftKey, { to: (e.target as HTMLSelectElement).value }) },
        delegates.map((p) => h('option', { value: p.id }, p.name)),
      );
      const controls: Child =
        d.type === 'workIntake'
          ? [
              h('button', { 'data-action': 'accept', onClick: () => decide(d.id, { kind: 'accept' }) }, `Accept (${d.hours}h)`),
              h('button', { 'data-action': 'decline', onClick: () => decide(d.id, { kind: 'decline' }) }, 'Decline'),
            ]
          : [
              h('button', { 'data-action': 'handle', onClick: () => decide(d.id, { kind: 'handle' }) }, `Handle it (${d.hours}h)`),
              delegates.length ? [picker, h('button', { 'data-action': 'delegate', onClick: () => decide(d.id, { kind: 'delegate', to: (picker as HTMLSelectElement).value }) }, 'Delegate')] : null,
            ];
      return h(
        'article',
        { 'data-demand': d.id, class: 'demand' },
        h('h3', {}, h('span', { 'data-field': 'type' }, d.type), ': ', h('span', { 'data-field': 'subject' }, nameOf(sim, level, d.subject))),
        h(
          'p',
          {},
          h('span', { 'data-field': 'hours' }, d.hours),
          'h, difficulty ',
          h('span', { 'data-field': 'difficulty' }, bandWord('skill', d.difficulty)),
          ', decide by week ',
          h('span', { 'data-field': 'last-week' }, d.lastWeek),
          '. Decision: ',
          h('span', { 'data-field': 'decision' }, describeDecision(plan.decisions[d.id], sim)),
        ),
        h('div', { class: 'controls' }, controls, h('button', { 'data-action': 'clear', onClick: () => clear(d.id) }, 'Clear')),
        ctx.errorFor(`demand:${d.id}`),
      );
    }),
  );
}

/** Targets an action can take right now, as select options. */
function targetsFor(action: ActionId, level: LineState, view: View): { value: string; label: string }[] {
  switch (ACTIONS[action].target) {
    case 'person':
      return view.people.map((p) => ({ value: p.id, label: p.name }));
    case 'team':
      return [{ value: level.teamId, label: 'your team' }];
    case 'project':
      return view.projects.map((p) => ({ value: p.id, label: p.name }));
    case 'vacancy':
      return view.vacancies.map((v) => ({ value: v.id, label: `vacancy ${v.id} (${v.interviews} interviews)` }));
    case 'player':
      return [{ value: 'player', label: 'you' }];
  }
}

// @spec UI-LINE-004
function calendar(ctx: ScreenContext, level: LineState, view: View) {
  const sim = ctx.run.sim;
  const week = sim.week;
  const draft = ctx.drafts.get('add-entry') ?? {};
  const action = (draft.action as ActionId | undefined) ?? 'line-manager.one-on-one';
  const targets = targetsFor(action, level, view);
  const cadences: Cadence[] = ACTIONS[action].oneOff ? ['once'] : ['weekly', 'biweekly', 'once'];
  const target = targets.some((t) => t.value === draft.target) ? draft.target! : targets[0]?.value ?? '';
  const cadence = cadences.includes(draft.cadence as Cadence) ? (draft.cadence as Cadence) : cadences[0]!;
  const start = draft.start === String(week + 1) ? week + 1 : week;
  const update = (field: string) => (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    ctx.drafts.set('add-entry', field === 'action' ? { action: value } : { action, target, cadence, start: String(start), [field]: value });
    ctx.redraw();
  };
  const add = () => {
    const kind = ACTIONS[action].target;
    const t: Target = kind === 'player' ? { kind: 'player' } : { kind, id: target };
    const entry: NewEntry = { action, target: t, cadence, ...(cadence === 'biweekly' && { startWeek: start }) };
    // The draft is cleared only once the add applies, so a refused add leaves the form as the player filled it in.
    ctx.send({ kind: 'plan', command: { kind: 'calendar', add: [entry] } }, 'add-entry', () => ctx.drafts.delete('add-entry'));
  };
  const options = (items: { value: string; label: string }[]) => items.map((i) => h('option', { value: i.value }, i.label));
  return h(
    'section',
    { 'data-panel': 'calendar' },
    h('h2', {}, 'Your calendar'),
    h(
      'ul',
      {},
      level.calendar.map((e) =>
        h(
          'li',
          { 'data-entry': e.id },
          h('span', { 'data-field': 'action' }, ACTION_LABELS[e.action]),
          ' with ',
          h('span', { 'data-field': 'target' }, nameOf(sim, level, e.target as { kind: string; id?: string })),
          ', ',
          h('span', { 'data-field': 'cadence' }, CADENCE_LABELS[e.cadence]),
          ` (${ACTIONS[e.action].hours}h) `,
          h('button', { 'data-action': 'remove', onClick: () => ctx.send({ kind: 'plan', command: { kind: 'calendar', remove: [e.id] } }, `entry:${e.id}`) }, 'Remove'),
          ctx.errorFor(`entry:${e.id}`),
        ),
      ),
    ),
    h(
      'div',
      { 'data-form': 'add-entry', class: 'add-entry' },
      h('select', { 'data-input': 'action', 'aria-label': 'Action', value: action, onChange: update('action') }, options((Object.keys(ACTIONS) as ActionId[]).map((a) => ({ value: a, label: `${ACTION_LABELS[a]} (${ACTIONS[a].hours}h)` })))),
      h('select', { 'data-input': 'target', 'aria-label': 'With', value: target, onChange: update('target') }, options(targets)),
      h('select', { 'data-input': 'cadence', 'aria-label': 'How often', value: cadence, onChange: update('cadence') }, options(cadences.map((c) => ({ value: c, label: CADENCE_LABELS[c] })))),
      cadence === 'biweekly'
        ? h('select', { 'data-input': 'start', 'aria-label': 'Starting', value: String(start), onChange: update('start') }, options([{ value: String(week), label: 'this week' }, { value: String(week + 1), label: 'next week' }]))
        : null,
      h('button', { 'data-action': 'add', disabled: targets.length === 0, onClick: add }, 'Add'),
      ctx.errorFor('add-entry'),
    ),
  );
}
