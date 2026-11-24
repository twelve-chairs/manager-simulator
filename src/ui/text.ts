import type { ProgressCause, ProjectMove } from '../levels/line-manager';
/**
 * Emphasis: `*text*`, or `_text_` standing as its own word, with no space just inside the markers. Underscores inside
 * a word (deploy_job_runner) and doubled markers (**strong**) are not emphasis. Fixed pattern; never built from content.
 */
const EMPHASIS = /(?<!\*)\*(?![\s*])([^*\n]+?)(?<!\s)\*(?!\*)|(?<!\w)_(?![\s_])([^_\n]+?)(?<!\s)_(?!\w)/g;

/**
 * Situation text with Markdown emphasis shown as `em` elements. Text is set as text, so nothing else in the string
 * has any meaning; an unmatched marker shows as written.
 */
// @spec UI-TEXT-002
export function emphasis(text: string): Node[] {
  const nodes: Node[] = [];
  let last = 0;
  for (const match of text.matchAll(EMPHASIS)) {
    nodes.push(document.createTextNode(text.slice(last, match.index)));
    const em = document.createElement('em');
    em.textContent = match[1] ?? match[2]!;
    nodes.push(em);
    last = match.index + match[0].length;
  }
  nodes.push(document.createTextNode(text.slice(last)));
  return nodes.filter((n) => n.nodeType !== Node.TEXT_NODE || n.textContent !== '');
}

/** How a project shipped against its deadline: "on time", "1 week late", "3 weeks late". */
export const lateness = (weeks: number): string => (weeks <= 0 ? 'on time' : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} late`);

/** A line for someone who quit: what led to it, clause by clause, and the last thing between you. */
// @spec UI-QUIT-001
/** A team that lost engineers in the month just played, and how many of them the player would have kept. */
export function headsLostLine(x: { name: string; count: number; regretted: number }): string {
  const lost = `${x.name} lost ${x.count} engineer${x.count === 1 ? '' : 's'}`;
  if (x.regretted === 0) return `${lost}.`;
  if (x.count === 1) return `${lost}, one you'd have kept.`;
  return `${lost}, ${x.regretted === 1 ? '1 of them one' : `${x.regretted} of them ones`} you'd have kept.`;
}

export function quitLine(q: { name: string; lowMotivationWeeks: number; highStressWeeks: number; lowTrust: boolean; lastMemory?: string }): string {
  const weeks = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`;
  const spells = [
    ...(q.lowMotivationWeeks > 0 ? [`${weeks(q.lowMotivationWeeks)} of low motivation`] : []),
    ...(q.highStressWeeks > 0 ? [q.lowMotivationWeeks > 0 ? `${q.highStressWeeks} of high stress` : `${weeks(q.highStressWeeks)} of high stress`] : []),
  ];
  const clauses = [...(spells.length ? [`after ${spells.join(' and ')}`] : []), ...(q.lowTrust ? ['trusting you little'] : [])];
  const why = clauses.length ? `${q.name} quit, ${clauses.join(', ')}.` : `${q.name} quit, for reasons of their own.`;
  return q.lastMemory ? `${why} The last thing between you: ${q.lastMemory}.` : why;
}

const MOVE_CAUSES: Record<ProgressCause, string> = {
  payDown: 'fixing the debt first',
  rollBack: 'rolling the change back',
  approvals: 'approvals that slipped',
  situations: 'this week’s situations',
  setback: 'a setback',
  work: 'the team’s work',
};

/** A line for how a project moved in a week: where it went from and to, and each cause's amount, costs first. */
// @spec UI-LINE-011
export function moveLine(m: ProjectMove): string {
  const causes = [...m.causes].sort((a, b) => Number(a.amount > 0) - Number(b.amount > 0));
  const parts = causes.map((c) => `${MOVE_CAUSES[c.cause]} ${c.amount < 0 ? 'cost' : 'added'} ${Math.abs(Math.round(c.amount))}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : (parts[0] ?? '');
  return `${m.name} went from ${Math.round(m.start)} to ${Math.round(m.end)} of ${m.scope}: ${list}.`;
}
