import { draftObject } from './drafts';
import { restlessSign } from './org';
import { headcountWords, moverInto } from './chips';
import { headsLostLastMonth, quitLastMonth, shippedLastMonth, type CalibrationEntry, type SeniorRecap, type SeniorState, type SeniorView } from '../levels/senior-manager';
import type { Run } from '../loop';
import { RATINGS, type Rating } from '../sim';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { headsChangeLine, headsLostLine, lateness, quitLine, shareWord } from './text';

/** Whose account of a team the card shows: the player's own look, its manager's report, or what the player hears. */
function sourceOf(t: SeniorView['teams'][number], managers: ReadonlyMap<string, { name: string }>): string {
  if (t.truth) return 'as you saw it';
  return t.managerId ? `as ${managers.get(t.managerId)?.name ?? 'their manager'} tells it` : 'as you hear it';
}
import type { Chip, LevelRenderer, MomentDetails, ScreenContext } from './app';

/** The senior manager's How to play topics. */
// @spec UI-HELP-001
export const SENIOR_HELP_TOPICS = [
  { id: 'how-to-play', title: 'How to play', text: 'Each month is a handful of moments. Your managers run the teams; you run your managers. Pick what you do, or let it wait. A recap ends the month.' },
  { id: 'managers', title: 'Managers', text: 'Your managers act for you. Coach them and they grow; step in and you fix it yourself, at a cost, and they learn nothing.' },
  { id: 'told', title: "What you're told", text: "Each team is shown as its manager tells it. A manager who struggles or doesn't trust you makes it sound better than it is. Close oversight and skip-levels show you the truth." },
  { id: 'calibration', title: 'Calibration', text: 'Before each review your managers propose their teams’ ratings. Compare them with what each team delivered, and move heads up or down. The group shares a curve with fewer top ratings than a strong group earns: decide whose people give one up, or argue for an exception with your reputation.' },
  { id: 'energy', title: 'Energy', text: 'Your energy falls with what you take on yourself and recovers in quieter months. Four months in a row at the edge and you burn out.' },
  { id: 'reviews', title: 'Reviews', text: 'Every six months your own manager reviews you: delivery, retention, your teams’ health, how your managers grew, calibration and the period’s goals. From your third review on, two of your reviews in a row rated exceeds or better get you promoted to director. After three years without one, the run ends.' },
] as const;

const PANEL_HELP = {
  managers: 'Each team is shown as its manager tells it, unless you saw for yourself.',
  habits: 'Changes apply from this month’s end, and to moments from next month.',
};

const HABITS = {
  oneOnOnes: { label: '1:1s with your managers', options: { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' }, what: '1:1s build trust and reveal what each manager wants. More of them cost more of your energy.' },
  backfill: { label: 'When someone leaves', options: { fast: 'Backfill fast', holdTheBar: 'Hold the bar' }, what: 'Fast fills a gap in a month with a weaker hire; holding the bar takes two months and keeps the team strong.' },
  newWork: { label: 'New work for an idle team', options: { ask: 'Decide each time', assign: 'Give it to a team with room' }, what: 'Giving it to a team with room saves you the decision; you still decide when the idle team is strained.' },
  skipLevel: { label: 'Skip-level listening', options: { none: 'None', monthly: 'Monthly' }, what: 'Each month you listen to one team directly: you see how it really is, and hear what its manager hasn’t said.' },
} as const;
const OVERSIGHT = { handsOff: 'Hands-off', coaching: 'Coaching', close: 'Close' } as const;
const SCHEDULE_WORDS = { onSchedule: 'on schedule', behind: 'behind', overdue: 'overdue' } as const;

const viewOf = (ctx: ScreenContext) => ctx.view as SeniorView;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The habit controls, sending a habit change at once. */
// @spec UI-SENIOR-004
function habitControls(ctx: ScreenContext, withHelp: boolean): Child {
  const v = viewOf(ctx);
  const control = (key: string, label: string, value: string, options: Record<string, string>, command: Record<string, string>, what?: string) =>
    h(
      'div',
      { class: 'habit' },
      h('label', {}, h('span', { class: 'habit-name' }, label), ' ',
        h(
          'select',
          { 'data-habit': key, value, onChange: (e: Event) => ctx.send({ kind: 'plan', command: { kind: 'habit', ...command, value: (e.target as HTMLSelectElement).value } }, `habit:${key}`, { keepFocus: true }) },
          Object.entries(options).map(([id, text]) => h('option', { value: id }, text)),
        ),
        ctx.errorFor(`habit:${key}`)),
      withHelp && what ? h('p', { class: 'help' }, what) : null,
    );
  return [
    ...v.managers.map((m) => control(`oversight:${m.id}`, `Oversight of ${m.name}`, v.habits.oversight[m.id] ?? 'coaching', OVERSIGHT, { habit: 'oversight', managerId: m.id },
      'Hands-off is cheap and lets a strong manager grow; close shows you the truth and catches problems, at a cost to your energy and their trust.')),
    ...(['oneOnOnes', 'backfill', 'skipLevel', 'newWork'] as const).map((id) => control(id, HABITS[id].label, v.habits[id], HABITS[id].options, { habit: id }, HABITS[id].what)),
  ];
}

/** The managers, each with their team as they tell it or as the player saw it, and the habits. */
// @spec UI-SENIOR-002, UI-SENIOR-003, UI-SENIOR-004
function panels(ctx: ScreenContext): Child {
  const v = viewOf(ctx);
  const managers = new Map(v.managers.map((m) => [m.id, m]));
  const team = (t: SeniorView['teams'][number]) =>
    h(
      'div',
      { 'data-team': t.id, ...(t.managerId ? {} : { 'data-leaderless': true }), class: 'team-card' },
      h('strong', { 'data-field': 'team-name' }, t.name),
      t.managerId ? null : h('p', { class: 'leaderless' }, 'No manager yet'),
      h('p', { class: 'facts' },
        h('span', { 'data-field': 'headcount' }, plural(t.headcount, 'person', 'people')),
        ' · seem ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', t.motivation)),
        ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', t.stress)),
        ' · risk of losing people ', h('span', { 'data-field': 'attrition' }, bandWord('risk', t.attritionRisk))),
      h('p', { class: 'source' }, h('small', { 'data-field': 'source' }, sourceOf(t, managers))),
      t.projects.map((p) =>
        h('p', { 'data-project': p.id, class: 'project' },
          h('span', { 'data-field': 'name' }, p.name), ': ',
          h('span', { 'data-field': 'progress' }, `${p.progress} / ${p.scope}`), ' done, due week ', h('span', { 'data-field': 'deadline' }, p.deadlineWeek + 1),
          ' · ', h('span', { 'data-field': 'schedule' }, SCHEDULE_WORDS[p.schedule])),
      ),
    );
  return [
    h(
      'section',
      { 'data-panel': 'managers', class: 'team' },
      h('h2', {}, 'Your managers'),
      h('p', { 'data-part': 'help', class: 'help' }, PANEL_HELP.managers),
      v.teams.map((t) => {
        const m = t.managerId ? managers.get(t.managerId) : undefined;
        if (!m) return team(t);
        return h(
          'article',
          { 'data-manager': m.id, class: 'person' },
          h('div', { class: 'who' }, h('strong', { 'data-field': 'name' }, m.name), h('span', { class: 'role' }, 'manager · ', h('span', { 'data-field': 'personality' }, m.personality ?? ''))),
          h('p', { class: 'mood' }, 'Seems ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', m.motivation)), ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', m.stress)), '.'),
          restlessSign(m.restless),
          h('p', { class: 'facts' }, 'Manages: ', h('span', { 'data-field': 'skill' }, bandWord('skill', m.skill)), ' · wants ', h('span', { 'data-field': 'want' }, m.want), ' · ', h('span', { 'data-field': 'performance' }, m.performance)),
          m.memory.length ? h('ul', { 'data-part': 'memory', class: 'memory' }, m.memory.map((note) => h('li', {}, note))) : null,
          team(t),
        );
      }),
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

/**
 * The moves, one rating at a time, that take a team's proposal to what it delivered: heads above where they belong come
 * down first, from the top, then heads below come up.
 */
function movesToDelivered(proposed: Record<Rating, number>, delivered: Record<Rating, number>): { from: Rating; to: Rating; count: number }[] {
  const now = { ...proposed };
  const moves: { from: Rating; to: Rating; count: number }[] = [];
  for (let i = RATINGS.length - 1; i > 0; i--) {
    const extra = now[RATINGS[i]!] - delivered[RATINGS[i]!];
    if (extra > 0) {
      moves.push({ from: RATINGS[i]!, to: RATINGS[i - 1]!, count: extra });
      now[RATINGS[i]!] -= extra;
      now[RATINGS[i - 1]!] += extra;
    }
  }
  for (let i = 0; i < RATINGS.length - 1; i++) {
    const extra = now[RATINGS[i]!] - delivered[RATINGS[i]!];
    if (extra > 0) {
      moves.push({ from: RATINGS[i]!, to: RATINGS[i + 1]!, count: extra });
      now[RATINGS[i]!] -= extra;
      now[RATINGS[i + 1]!] += extra;
    }
  }
  return moves;
}

/** Calibration: each team's proposal, with the player's moves so far, beside what it delivered, and the group's curve. */
// @spec UI-SENIOR-005, UI-SENIOR-011
function calibration(ctx: ScreenContext, moment: SeniorView['moments'][number]): Child {
  const v = viewOf(ctx);
  // Settled over the curve: what is left is the room's question, asked by the moment's own choices.
  if (moment.overCurve) {
    return h('p', { 'data-part': 'over-curve' }, `Your teams hold ${moment.overCurve.held} top ratings (exceeds and outstanding) between them, and the curve allows ${moment.overCurve.room}. Argue for an exception, or let the room trim to the curve.`);
  }
  const key = `calibration:${moment.id}`;
  const moves = draftObject<{ from: Rating; to: Rating; count: number }[]>(ctx.drafts.get(key)?.moves);
  const save = () => {
    ctx.drafts.set(key, { moves: JSON.stringify(moves) });
    ctx.refresh();
  };
  const names = new Map(v.teams.map((t) => [t.id, t.name]));
  const teamOf = new Map(v.teams.map((t) => [t.id, t]));
  const shownOf = (entry: CalibrationEntry) => {
    const shown = { ...entry.proposed };
    for (const m of moves[entry.teamId] ?? []) {
      shown[m.from] -= m.count;
      shown[m.to] += m.count;
    }
    return shown;
  };
  const held = moment.calibration!.reduce((n, entry) => {
    const shown = shownOf(entry);
    return n + shown.exceeds + shown.outstanding;
  }, 0);
  const deliveredTop = moment.calibration!.reduce((n, entry) => n + entry.delivered.exceeds + entry.delivered.outstanding, 0);
  const setAllDelivered = () => {
    for (const entry of moment.calibration!) moves[entry.teamId] = movesToDelivered(entry.proposed, entry.delivered);
    save();
  };
  return [
    moment.curve !== undefined
      ? h(
          'p',
          { 'data-part': 'curve', class: held > moment.curve ? 'over' : undefined },
          'Top ratings (exceeds and outstanding): ',
          h('strong', { 'data-curve-held': '' }, String(held)),
          ' as the moves stand, of ',
          h('strong', { 'data-curve-room': '' }, String(moment.curve)),
          ' the curve allows. Set to what they delivered, your teams would hold ',
          h('strong', { 'data-curve-delivered': '' }, String(deliveredTop)),
          '.',
        )
      : null,
    h('p', { 'data-part': 'cut-cost', class: 'help' }, 'A head rated below what it delivered costs its team motivation, more on a small team, and its manager trust. A team already likely to lose people can least afford it.'),
    h('button', { 'data-action': 'set-all-delivered', onClick: setAllDelivered }, 'Set every team to what it delivered'),
    moment.calibration!.map((entry) => {
      const shown = shownOf(entry);
      const move = (from: Rating, to: Rating) => () => {
        const teamMoves = moves[entry.teamId] ?? [];
        teamMoves.push({ from, to, count: 1 });
        moves[entry.teamId] = teamMoves;
        save();
      };
      return h(
        'div',
        { 'data-calibration': entry.teamId, class: 'calibration' },
        h('h3', {}, names.get(entry.teamId) ?? entry.teamId),
        // Who can bear a cut: the team's size and its risk of losing people, as its panel shows it.
        teamOf.get(entry.teamId)
          ? h('p', { 'data-field': 'bears' }, `${teamOf.get(entry.teamId)!.headcount} people · risk of losing people ${bandWord('risk', teamOf.get(entry.teamId)!.attritionRisk)}`)
          : null,
        // One move undoes the manager's inflation, at the same cost as moving each head.
        h('button', { 'data-set-delivered': entry.teamId, onClick: () => { moves[entry.teamId] = movesToDelivered(entry.proposed, entry.delivered); save(); } }, 'Set to what it delivered'),
        h(
          'table',
          {},
          h('tr', {}, h('th', {}, 'Rating'), h('th', {}, 'Proposed'), h('th', {}, 'Delivered'), h('th', {}, 'Move a head')),
          RATINGS.map((r, i) =>
            h(
              'tr',
              {},
              h('td', {}, r),
              h('td', { 'data-proposed': r }, shown[r]),
              h('td', { 'data-delivered': r }, entry.delivered[r]),
              h('td', {},
                shown[r] > 0 && i > 0 ? h('button', { 'data-move': `${entry.teamId}:${r}:${RATINGS[i - 1]}`, onClick: move(r, RATINGS[i - 1]!) }, `Down to ${RATINGS[i - 1]}`) : null,
                shown[r] > 0 && i < RATINGS.length - 1 ? h('button', { 'data-move': `${entry.teamId}:${r}:${RATINGS[i + 1]}`, onClick: move(r, RATINGS[i + 1]!) }, `Up to ${RATINGS[i + 1]}`) : null),
            ),
          ),
        ),
      );
    }),
    h('button', { 'data-action': 'settle', class: 'primary', onClick: () => ctx.send({ kind: 'answer', momentId: moment.id, choiceId: `settle:${JSON.stringify(moves)}` }, `moment:${moment.id}`) }, 'Settle calibration'),
  ];
}

/** A senior manager moment for the scene: the manager's skill beside choices that depend on them, and calibration's own scene. */
// @spec UI-SENIOR-005, UI-SENIOR-006
function moment(ctx: ScreenContext, momentId: string): MomentDetails | undefined {
  const v = viewOf(ctx);
  const m = v.moments.find((x) => x.id === momentId);
  if (!m) return undefined;
  if (m.kind === 'calibration') return { title: m.title, text: m.text, detail: calibration(ctx, m), choices: m.choices };
  const manager = m.managerIds.length === 1 ? v.managers.find((x) => x.id === m.managerIds[0]) : undefined;
  return { title: m.title, text: m.text, choices: m.choices.map((c) => ({ ...c, note: manager ? `manages: ${bandWord('skill', manager.skill)}` : undefined })) };
}

function managerChips(a: SeniorView, b: SeniorView, rose: (personId: string) => boolean, out: Chip[]) {
  const move = moverInto(out);
  const managers = new Map(b.managers.map((m) => [m.id, m]));
  for (const m of a.managers) {
    const n = managers.get(m.id);
    if (!n) continue;
    move(`manager:${m.id}:motivation`, m.name, m.motivation, n.motivation, true, 'more motivated', 'less motivated');
    move(`manager:${m.id}:stress`, m.name, m.stress, n.stress, false, 'more stressed', 'less stressed');
    if (m.stress === n.stress && rose(m.id)) out.push({ key: `manager:${m.id}:heavier`, text: `${m.name}: a heavier week`, tone: 'bad' });
    move(`manager:${m.id}:skill`, m.name, m.skill, n.skill, true, 'a better manager', 'a weaker manager');
  }
}

function teamChips(a: SeniorView, b: SeniorView, out: Chip[]) {
  const move = moverInto(out);
  const teams = new Map(b.teams.map((t) => [t.id, t]));
  for (const t of a.teams) {
    const n = teams.get(t.id);
    if (!n) continue;
    move(`team:${t.id}:motivation`, t.name, t.motivation, n.motivation, true, 'more motivated', 'less motivated');
    move(`team:${t.id}:stress`, t.name, t.stress, n.stress, false, 'more stressed', 'less stressed');
    const d = n.headcount - t.headcount;
    if (d !== 0) out.push({ key: `team:${t.id}:headcount`, text: `${t.name}: ${headcountWords(d)}`, tone: d > 0 ? 'good' : 'bad' });
  }
}

/** A chip per band that moved for a manager, a team as shown, or the player, and per change in a team's headcount. */
// @spec UI-SENIOR-007
function chips(before: unknown, after: unknown, rose: (personId: string) => boolean = () => false): Chip[] {
  const a = before as SeniorView;
  const b = after as SeniorView;
  const out: Chip[] = [];
  managerChips(a, b, rose, out);
  teamChips(a, b, out);
  const move = moverInto(out);
  move('player:energy', 'You', a.player.energy, b.player.energy, true, 'more energy', 'less energy');
  move('player:reputation', 'Your reputation', a.player.reputation, b.player.reputation, true, 'up', 'down');
  return out;
}

/** The senior manager's part of the recap: what changed, or a quiet month, and the routine folded away. */
// @spec UI-SENIOR-008, UI-QUIT-001
function recap(run: Run, value: unknown): { changes: Child; routine: Child } {
  const r = value as SeniorRecap;
  const part = (name: string, title: string, items: Child[]) => (items.length ? h('div', { 'data-part': name }, h('h3', {}, title), h('ul', {}, items)) : h('div', { 'data-part': name }));
  const c = r.changes;
  const shipped = shippedLastMonth(run.level as SeniorState, run.sim);
  const quits = quitLastMonth(run.level as SeniorState, run.sim);
  const lost = headsLostLastMonth(run.level as SeniorState, run.sim);
  const followUps = c.followUps ?? [];
  const recovered = c.recovered ?? [];
  const quiet = !(c.managers.length || c.teams.length || c.heads.length || c.slipped.length || recovered.length || !!c.energy || c.assigned.length || followUps.length || shipped.length || quits.length || lost.length);
  return {
    changes: [
      quiet ? h('p', { 'data-part': 'recap-quiet', class: 'quiet' }, 'A quiet month.') : null,
      part('recap-shipped', 'Shipped', shipped.map((p) => h('li', {}, `${p.name} shipped ${lateness(p.weeksLate)} (${p.team}).`))),
      part('recap-left', 'Who left', [...quits.map((q) => h('li', { 'data-manager': q.personId }, quitLine(q))), ...lost.map((x) => h('li', { 'data-team': x.teamId }, headsLostLine(x)))]),
      part('recap-managers', 'Your managers', c.managers.map((m) => h('li', { 'data-manager': m.id }, h('strong', {}, m.changes.length ? `${m.name}: ${m.changes.join(' and ')}.` : `${m.name}.`), m.notes.length ? ` ${m.notes.join('. ')}.` : ''))),
      part('recap-teams', 'Your teams', c.teams.map((t) => h('li', { 'data-team': t.id }, `${t.name}: ${t.changes.join(' and ')}.`))),
      part('recap-followups', 'What came of it', followUps.map((line) => h('li', {}, line))),
      part('recap-energy', 'Your energy', c.energy ? [h('li', {}, c.energy)] : []),
      part('recap-heads', 'People', c.heads.map((x) => h('li', {}, headsChangeLine(x)))),
      part('recap-slipped', 'What slipped', c.slipped.map((line) => h('li', {}, `${line}.`))),
      part('recap-recovered', 'Back on schedule', recovered.map((p) => h('li', {}, `${p.name} is back on schedule (${p.team}).`))),
      part('recap-assigned', 'New work', c.assigned.map((x) => h('li', { 'data-team': x.teamId }, `Your manager gave ${x.project} to ${x.name}.`))),
    ],
    routine: [part('recap-habits', 'Your habits', r.routine.habits.map((line) => h('li', {}, line))), part('recap-goals', 'Goals', r.routine.goals.map((g) => h('li', {}, `${g.text}: ${g.progress}`)))],
  };
}

/** The senior manager's review measures by name. */
// @spec UI-SENIOR-009
const MEASURE_NAMES: Record<string, string> = {
  completedOnTime: 'Projects shipped on time',
  onScheduleShare: 'Projects on schedule',
  regrettedAttrition: "People you'd have kept who left",
  motivation: 'Team motivation',
  stress: 'Team stress',
  managerGrowth: 'How much your managers grew',
  healthHeld: 'Teams that held up',
  calibrationQuality: 'Calibration quality',
  reputation: 'Your reputation',
};

/** What moves each of the level's review measures, said beside one that held the rating back. */
// @spec UI-REVIEW-003
/** What keeps a stay conversation's promise at this level: the habit or state that serves the want it promised. */
// @spec UI-PROMISE-004
const PROMISE_KEEPS: Record<string, string> = {
  "stay:growth": "you coach them in oversight",
  "stay:autonomy": "you leave them hands-off in oversight",
  "stay:recognition": "your 1:1s with your managers are at least fortnightly",
  "stay:stability": "their team stays below strained",
};

const MEASURE_LEVERS: Record<string, string> = {
  completedOnTime: "teams deliver what they can carry: give new work to a team with room, and answer a manager who escalates a slipping project",
  onScheduleShare: "teams deliver what they can carry: give new work to a team with room, and answer a manager who escalates a slipping project",
  regrettedAttrition: "teams lose people as their stress and motivation slide; a stay conversation keeps a restless manager",
  motivation: "each team drifts toward what its manager sustains, so a stronger manager keeps a more motivated team",
  stress: "each team drifts toward what its manager sustains, and stepping in on an escalation eases it at once",
  managerGrowth: "coaching them, in oversight, through escalations and by getting two of them to agree a plan, raises their skill; stepping in doesn't",
  healthHeld: "a team holds up when its manager can sustain it: grow the weaker managers, and keep extra work off a strained team",
  calibrationQuality: "settle each team's ratings on what it delivered; a lenient manager's proposal sits above it",
  reputation: "projects on track raise it each week, and projects in trouble lower it",
};

function measureValue(_view: unknown, id: string, value: number): string | undefined {
  const share = (all: string) => shareWord(value, all);
  if (id.startsWith('goal:')) return value >= 1 ? 'met' : 'missed';
  switch (id) {
    case 'completedOnTime':
    case 'regrettedAttrition':
      return value === 0 ? 'none' : String(value);
    case 'onScheduleShare':
    case 'healthHeld':
      return share('all');
    case 'calibrationQuality':
      if (value >= 0.95) return 'fair';
      return value >= 0.7 ? 'mostly fair' : 'lenient';
    case 'managerGrowth':
      return value > 0 ? 'they grew' : 'no growth';
    case 'motivation':
    case 'stress':
    case 'reputation':
      return bandWord(id, Math.max(0, Math.min(4, Math.floor(value / 20))));
    default:
      return undefined;
  }
}

/** The senior manager's part of the career summary: months at the level, and the managers who joined and were let go. */
// @spec UI-SENIOR-010
function career(view: unknown): Child {
  const c = (view as SeniorView).career;
  const names = (xs: string[]) => (xs.length ? xs.join(', ') : 'nobody');
  return [
    h('li', {}, 'Months as a senior manager: ', h('span', { 'data-field': 'months' }, c.months)),
    h('li', {}, 'Managers who joined: ', h('span', { 'data-field': 'managers-joined' }, names(c.joined))),
    h('li', {}, 'Managers you let go: ', h('span', { 'data-field': 'managers-let-go' }, names(c.letGo))),
  ];
}

export const seniorManagerRenderer: LevelRenderer = {
  turn: 'month',
  help: SENIOR_HELP_TOPICS,
  firstTurn: { where: 'Before the month', heading: 'How you run your managers', intro: 'Your teams now run through their managers. Decide how closely you work with each, and how you staff and listen, before the month begins.' },
  stayed: {
    outcome: 'This was your last review as a senior manager. Three years in, the promotion never came.',
    ending: 'You stayed a senior manager. Three years went by without the promotion.',
  },
  panels,
  habits: (ctx) => habitControls(ctx, true),
  moment,
  chips,
  recap,
  status: (view) => {
    const v = view as SeniorView;
    return { energy: v.player.energy, reputation: v.player.reputation, goals: v.goals, edge: { at: v.player.edge.at, weeks: v.player.edge.months, limit: v.player.edge.limit } };
  },
  measureName: (view, id) => MEASURE_NAMES[id] ?? (view as SeniorView).goals.find((g) => `goal:${g.id}` === id)?.text,
  measureValue,
  measureLever: (id) => MEASURE_LEVERS[id],
  promiseKeeps: (kindId) => PROMISE_KEEPS[kindId],
  career,
};
