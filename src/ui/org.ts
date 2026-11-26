import { headcountWords, moverInto } from './chips';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import type { Chip, ScreenContext } from './app';

/**
 * Pieces the renderers of the levels that run an organization of aggregate units share: the director's groups and the
 * VP's divisions, each led by a person, and the people above and beside the player.
 */

export const SCHEDULE_WORDS = { onSchedule: 'on schedule', behind: 'behind', overdue: 'overdue' } as const;
export type ScheduleWord = keyof typeof SCHEDULE_WORDS;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type HabitDefs = Record<string, { label: string; options: Record<string, string>; what: string }>;

/** The habit controls, sending a habit change at once, each with a line on what it does when asked. */
export function habitControls(ctx: ScreenContext, defs: HabitDefs, values: Record<string, string>, withHelp: boolean): Child {
  return Object.keys(defs).map((id) =>
    h(
      'div',
      { class: 'habit' },
      h('label', {}, h('span', { class: 'habit-name' }, defs[id]!.label), ' ',
        h(
          'select',
          { 'data-habit': id, value: values[id], onChange: (e: Event) => ctx.send({ kind: 'plan', command: { kind: 'habit', habit: id, value: (e.target as HTMLSelectElement).value } }, `habit:${id}`, { keepFocus: true }) },
          Object.entries(defs[id]!.options).map(([value, text]) => h('option', { value }, text)),
        ),
        ctx.errorFor(`habit:${id}`)),
      withHelp ? h('p', { class: 'help' }, defs[id]!.what) : null,
    ),
  );
}

/** The habits panel, folded, its open state kept in the drafts. */
export function habitsPanel(ctx: ScreenContext, help: string, controls: Child): Child {
  return h(
    'details',
    { 'data-panel': 'habits', class: 'habits', open: ctx.drafts.get('habits')?.open === 'true', onToggle: (e: Event) => ctx.drafts.set('habits', { open: String((e.target as HTMLDetailsElement).open) }) },
    h('summary', {}, 'Your habits'),
    h('p', { 'data-part': 'help', class: 'help' }, help),
    controls,
  );
}

export type ProjectLine = { id: string; name: string; progress: number; scope: number; deadlineWeek: number; schedule: ScheduleWord };

export const projectLine = (p: ProjectLine) =>
  h('p', { 'data-project': p.id, class: 'project' },
    h('span', { 'data-field': 'name' }, p.name), ': ',
    h('span', { 'data-field': 'progress' }, `${p.progress} / ${p.scope}`), ' done, due week ', h('span', { 'data-field': 'deadline' }, p.deadlineWeek + 1),
    ' · ', h('span', { 'data-field': 'schedule' }, SCHEDULE_WORDS[p.schedule]));

export interface UnitCard {
  id: string;
  name: string;
  leaderId: string | null;
  headcount: number;
  motivation: number;
  stress: number;
  attritionRisk: number;
  projects: ProjectLine[];
}

/** A unit as its card shows it: name, headcount, mood in words with where it comes from, and its projects. */
export function unitCard(u: UnitCard, kind: 'group' | 'division', leaderless: string, source: string): Child {
  return h(
    'div',
    { [`data-${kind}`]: u.id, ...(u.leaderId ? {} : { 'data-leaderless': true }), class: 'team-card' },
    h('strong', { 'data-field': `${kind}-name` }, u.name),
    u.leaderId ? null : h('p', { class: 'leaderless' }, leaderless),
    h('p', { class: 'facts' },
      h('span', { 'data-field': 'headcount' }, plural(u.headcount, 'person', 'people')),
      ' · seem ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', u.motivation)),
      ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', u.stress)),
      ' · risk of losing people ', h('span', { 'data-field': 'attrition' }, bandWord('risk', u.attritionRisk))),
    h('p', { class: 'source' }, h('small', { 'data-field': 'source' }, source)),
    u.projects.map(projectLine),
  );
}

export interface LeaderCard {
  id: string;
  name: string;
  personality: string | null;
  performance: string;
  motivation: number;
  stress: number;
  skill: number;
  want: string;
  memory: string[];
}

/** A unit's leader as a person, with their unit under them. */
export function leaderCard(m: LeaderCard, attribute: string, role: string, unit: Child): Child {
  return h(
    'article',
    { [attribute]: m.id, class: 'person' },
    h('div', { class: 'who' }, h('strong', { 'data-field': 'name' }, m.name), h('span', { class: 'role' }, `${role} · `, h('span', { 'data-field': 'personality' }, m.personality ?? ''))),
    h('p', { class: 'mood' }, 'Seems ', h('strong', { 'data-field': 'motivation' }, bandWord('motivation', m.motivation)), ' and ', h('strong', { 'data-field': 'stress' }, bandWord('stress', m.stress)), '.'),
    h('p', { class: 'facts' }, 'Leads: ', h('span', { 'data-field': 'skill' }, bandWord('skill', m.skill)), ' · wants ', h('span', { 'data-field': 'want' }, m.want), ' · ', h('span', { 'data-field': 'performance' }, m.performance)),
    m.memory.length ? h('ul', { 'data-part': 'memory', class: 'memory' }, m.memory.map((note) => h('li', {}, note))) : null,
    unit,
  );
}

export interface OutsiderCard {
  id: string;
  name: string;
  personality: string | null;
  role: 'executive' | 'peer';
  trust: number;
  want: string;
  memory: string[];
}

/** Someone above or beside the player: their role in words, how much they trust the player, their want and memory. */
export function outsiderCard(u: OutsiderCard, roles: { executive: string; peer: string }): Child {
  return h(
    'article',
    { 'data-outsider': u.id, class: 'person' },
    h('div', { class: 'who' }, h('strong', { 'data-field': 'name' }, u.name), h('span', { class: 'role' }, h('span', { 'data-field': 'role' }, roles[u.role]), ' · ', h('span', { 'data-field': 'personality' }, u.personality ?? ''))),
    h('p', { class: 'facts' }, 'Trusts you: ', h('span', { 'data-field': 'trust' }, bandWord('trust', u.trust)), ' · wants ', h('span', { 'data-field': 'want' }, u.want)),
    u.memory.length ? h('ul', { 'data-part': 'memory', class: 'memory' }, u.memory.map((note) => h('li', {}, note))) : null,
  );
}

/** A recap part: its heading and list when it has items, an empty part otherwise. */
export const recapPart = (name: string, title: string, items: Child[]) => (items.length ? h('div', { 'data-part': name }, h('h3', {}, title), h('ul', {}, items)) : h('div', { 'data-part': name }));

/** A recap line for a leader: their changes, then their notes. */
export const leaderLine = (m: { name: string; changes: string[]; notes: string[] }) => [h('strong', {}, m.changes.length ? `${m.name}: ${m.changes.join(' and ')}.` : `${m.name}.`), m.notes.length ? ` ${m.notes.join('. ')}.` : ''];

/** Chips for each leader whose motivation, stress or management skill moved a band. */
export function leaderChips(a: LeaderCard[], b: LeaderCard[], prefix: string, rose: (personId: string) => boolean, out: Chip[]) {
  const move = moverInto(out);
  const leads = new Map(b.map((m) => [m.id, m]));
  for (const m of a) {
    const n = leads.get(m.id);
    if (!n) continue;
    move(`${prefix}:${m.id}:motivation`, m.name, m.motivation, n.motivation, true, 'more motivated', 'less motivated');
    move(`${prefix}:${m.id}:stress`, m.name, m.stress, n.stress, false, 'more stressed', 'less stressed');
    if (m.stress === n.stress && rose(m.id)) out.push({ key: `${prefix}:${m.id}:heavier`, text: `${m.name}: a heavier week`, tone: 'bad' });
    move(`${prefix}:${m.id}:skill`, m.name, m.skill, n.skill, true, 'a better leader', 'a weaker leader');
  }
}

/** Chips for each unit whose headcount changed. */
export function headcountChips(a: { id: string; name: string; headcount: number }[], b: { id: string; headcount: number }[], prefix: string, out: Chip[]) {
  const units = new Map(b.map((g) => [g.id, g]));
  for (const g of a) {
    const n = units.get(g.id);
    const d = n ? n.headcount - g.headcount : 0;
    if (d !== 0) out.push({ key: `${prefix}:${g.id}:headcount`, text: `${g.name}: ${headcountWords(d)}`, tone: d > 0 ? 'good' : 'bad' });
  }
}

/** Chips for each person above or beside the player whose trust moved a band. */
export function trustChips(a: { id: string; name: string; trust: number }[], b: { id: string; trust: number }[], out: Chip[]) {
  const move = moverInto(out);
  const above = new Map(b.map((u) => [u.id, u]));
  for (const u of a) {
    const n = above.get(u.id);
    if (n) move(`outsider:${u.id}:trust`, u.name, u.trust, n.trust, true, 'trusts you more', 'trusts you less');
  }
}

/** Chips for the player's energy and reputation. */
export function playerChips(a: { energy: number; reputation: number }, b: { energy: number; reputation: number }, out: Chip[]) {
  const move = moverInto(out);
  move('player:energy', 'You', a.energy, b.energy, true, 'more energy', 'less energy');
  move('player:reputation', 'Your reputation', a.reputation, b.reputation, true, 'up', 'down');
}

/** The level's part of the career summary: quarters at the level, and the leaders who joined and were let go. */
export function careerLines(c: { quarters: number; joined: string[]; letGo: string[] }, level: string, leaders: { label: string; field: string }): Child {
  const names = (xs: string[]) => (xs.length ? xs.join(', ') : 'nobody');
  return [
    h('li', {}, `Quarters as a ${level}: `, h('span', { 'data-field': 'quarters' }, c.quarters)),
    h('li', {}, `${leaders.label} who joined: `, h('span', { 'data-field': `${leaders.field}-joined` }, names(c.joined))),
    h('li', {}, `${leaders.label} you let go: `, h('span', { 'data-field': `${leaders.field}-let-go` }, names(c.letGo))),
  ];
}

/** A review measure's value in words for the measures the quarterly levels share; undefined for any other. */
export function sharedMeasureValue(id: string, value: number, confidence: string[]): string | undefined {
  if (id.startsWith('goal:')) return value >= 1 ? 'met' : 'missed';
  const band = Math.max(0, Math.min(4, Math.floor(value / 20)));
  if (confidence.includes(id)) return bandWord('trust', band);
  switch (id) {
    case 'projectsOnTime':
    case 'regrettedAttrition':
      return value === 0 ? 'none' : String(value);
    case 'motivation':
    case 'stress':
    case 'reputation':
      return bandWord(id, band);
    default:
      return undefined;
  }
}
