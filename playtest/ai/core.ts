/**
 * The AI playtester's pure parts (docs/intent/playtest, The AI Playtester): what it is shown, what it may reply, the
 * prompts, the interview and the report. Nothing here touches the browser or the network, so it is tested with
 * made-up screens and a fake client.
 */
import { z } from 'zod';

/** A screen that asks the player for a decision, as text, with what can be chosen on it. */
export interface Screen {
  /** `moment`, `before-monday` (the scene before a level's first turn) or `handover`. */
  kind: 'moment' | 'before-monday' | 'handover';
  /** The level on screen, as the player reads it: week, month or quarter. */
  turn: string;
  title: string;
  /** Everything a player reads on the screen: the header, the panels and the scene. */
  text: string;
  choices: { id: string; label: string }[];
  /** The habits panel: each habit's id, its options' values and labels, and its current value. */
  habits: { id: string; label: string; options: { value: string; label: string }[]; value: string }[];
  /** Headcount planning: the heads given and the targets a head can go to. */
  placement?: { heads: number; targets: { id: string; label: string }[] };
  /** Strategy bets: each offer and the groups that could carry it. */
  funding?: { offers: { id: string; label: string }[]; groups: { id: string; label: string }[] };
  /** Calibration: each move of one head the scene offers, by its id (team:from:to). */
  calibration?: { moves: { id: string; label: string }[] };
  /** Whether the moment can be let wait. */
  canWait: boolean;
}

export const PERSONAS = {
  'new-manager': 'You were promoted to manage your first team six months ago. You care about doing right by people and are still learning what the job is.',
  'promoted-engineer': 'You were a strong engineer for ten years and have just become a manager for the first time. You are practical, a little impatient with process, and learning to work through other people.',
  sceptic: 'You are a sceptical player who likes to test a game\'s edges: you try the choices a sensible manager would avoid, to see whether the game notices and responds believably.',
} as const;
export type Persona = keyof typeof PERSONAS;

export const AI_TUNING = {
  /** The interview's model, and the decisions' unless a run asks for Sonnet. */
  model: 'claude-opus-5-5',
  /** The models a run's decisions can be played with (AI_MODEL). */
  models: { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' },
  /** Retries, with the SDK's backoff, of a request that fails on the network or a server error. */
  requestRetries: 6,
  /** The notebook's longest length, in words; a longer reply is cut to it. */
  notebookWords: 300,
  /** Decisions before a run stops, by how far it goes. */
  maxDecisions: { promotion: 240, director: 720, end: 900 },
  /** Turns played at a new level before the interview that follows a promotion. */
  turnsAfterPromotion: 3,
} as const;

/** What the playtester replies to a decision. Every field is always present, so the schema is strict. */
export const ReplySchema = z.object({
  thinkAloud: z.string().describe('What you are thinking, in one to four sentences, as a player thinking aloud.'),
  feeling: z.enum(['clear', 'unsure', 'confused', 'surprised']).describe('How clear this screen and its choices were to you.'),
  action: z.object({
    kind: z.enum(['choose', 'wait', 'place', 'fund', 'calibrate']),
    choiceId: z.string().describe('For choose: the id of the choice. Otherwise an empty string.'),
    place: z.array(z.object({ target: z.string(), count: z.number().int() })).describe('For place: where each head goes. Otherwise empty.'),
    fund: z.array(z.object({ offerId: z.string(), groupId: z.string() })).describe('For fund: each bet funded and the group to carry it. Otherwise empty.'),
    calibrate: z.array(z.object({ move: z.string(), count: z.number().int() })).describe('For calibrate: each move and how many heads to move that way, then settle. Empty settles as proposed. Otherwise empty.'),
  }),
  habits: z.array(z.object({ habit: z.string(), value: z.string() })).describe('Habit changes to make before acting, if any. Usually empty.'),
  notebook: z.string().describe('Your notebook, rewritten: what you have learned about the game, what you suspect, what you would do differently. Under 300 words.'),
});
export type Reply = z.infer<typeof ReplySchema>;

/** The interview's reply: an answer under each heading asked. */
export const InterviewSchema = z.object({
  answers: z.array(z.object({ heading: z.string(), answer: z.string() })),
});
export type Interview = z.infer<typeof InterviewSchema>;

/** An action the harness can take on the page, once checked. */
export type Action =
  | { kind: 'choose'; choiceId: string }
  | { kind: 'wait' }
  | { kind: 'place'; place: Record<string, number> }
  | { kind: 'fund'; fund: Record<string, string> }
  | { kind: 'calibrate'; calibrate: Record<string, number> };

/** Checks a reply against what the screen offers, returning the action and habit changes to make, or why not. */
// @spec PLAY-AI-003
export function checkReply(screen: Screen, reply: Reply): { ok: true; action: Action; habits: { habit: string; value: string }[] } | { ok: false; reason: string } {
  for (const h of reply.habits) {
    const habit = screen.habits.find((x) => x.id === h.habit);
    if (!habit) return { ok: false, reason: `There is no habit "${h.habit}" on this screen. The habits are: ${screen.habits.map((x) => x.id).join(', ') || 'none'}.` };
    if (!habit.options.some((o) => o.value === h.value)) return { ok: false, reason: `"${h.value}" is not an option for ${habit.label}. Its options are: ${habit.options.map((o) => o.value).join(', ')}.` };
  }
  const a = reply.action;
  switch (a.kind) {
    case 'choose':
      if (!screen.choices.some((c) => c.id === a.choiceId)) return { ok: false, reason: `There is no choice "${a.choiceId}". The choices are: ${screen.choices.map((c) => c.id).join(', ')}.` };
      return { ok: true, action: { kind: 'choose', choiceId: a.choiceId }, habits: reply.habits };
    case 'wait':
      if (!screen.canWait) return { ok: false, reason: 'This screen cannot be let wait: pick one of its choices.' };
      return { ok: true, action: { kind: 'wait' }, habits: reply.habits };
    case 'place': {
      if (!screen.placement) return { ok: false, reason: 'There are no heads to place on this screen.' };
      const place: Record<string, number> = {};
      let total = 0;
      for (const p of a.place) {
        if (!screen.placement.targets.some((t) => t.id === p.target)) return { ok: false, reason: `"${p.target}" is not somewhere a head can go. The targets are: ${screen.placement.targets.map((t) => t.id).join(', ')}.` };
        if (p.count < 0) return { ok: false, reason: 'A count cannot be negative.' };
        place[p.target] = (place[p.target] ?? 0) + p.count;
        total += p.count;
      }
      if (total > screen.placement.heads) return { ok: false, reason: `Only ${screen.placement.heads} heads were given, not ${total}.` };
      return { ok: true, action: { kind: 'place', place }, habits: reply.habits };
    }
    case 'fund': {
      if (!screen.funding) return { ok: false, reason: 'There are no bets to fund on this screen.' };
      const fund: Record<string, string> = {};
      for (const f of a.fund) {
        if (!screen.funding.offers.some((o) => o.id === f.offerId)) return { ok: false, reason: `"${f.offerId}" is not a bet on offer.` };
        if (!screen.funding.groups.some((g) => g.id === f.groupId)) return { ok: false, reason: `"${f.groupId}" is not one of your groups.` };
        fund[f.offerId] = f.groupId;
      }
      if (Object.keys(fund).length > 2) return { ok: false, reason: 'At most two bets can be funded.' };
      return { ok: true, action: { kind: 'fund', fund }, habits: reply.habits };
    }
    case 'calibrate': {
      if (!screen.calibration) return { ok: false, reason: 'There is no calibration on this screen.' };
      const calibrate: Record<string, number> = {};
      for (const m of a.calibrate) {
        if (!screen.calibration.moves.some((x) => x.id === m.move)) return { ok: false, reason: `"${m.move}" is not a move on offer. The moves are: ${screen.calibration.moves.map((x) => x.id).join(', ')}.` };
        if (m.count < 1) return { ok: false, reason: 'Move at least one head, or leave the move out.' };
        calibrate[m.move] = (calibrate[m.move] ?? 0) + m.count;
      }
      return { ok: true, action: { kind: 'calibrate', calibrate }, habits: reply.habits };
    }
  }
}

/** The notebook, kept to its longest length in words. */
// @spec PLAY-AI-004
export const keepNotebook = (notebook: string) => notebook.trim().split(/\s+/).slice(0, AI_TUNING.notebookWords).join(' ');

/** The fixed system prompt: the persona and how the game is played. The same for every request in a run, so it caches. */
export function systemPrompt(persona: Persona): string {
  return [
    'You are playtesting a management game for the first time. It is fiction, simplified for play: you manage engineers, then managers, then a whole organization, and each promotion is meant to feel like a new job.',
    `Who you are: ${PERSONAS[persona]}`,
    'You know only what the screen shows you and what you wrote in your notebook. Play as yourself: choose what you would really choose, and do not try to game the rules.',
    'Each time, think aloud briefly, say how clear the screen was, take one action the screen offers, and rewrite your notebook.',
    'Actions: "choose" one of the listed choices by its id; "wait" to let the moment pass when the screen allows it; "place" to place the quarter\'s heads (targets and counts); "fund" to fund at most two bets, naming each bet\'s carrying group; "calibrate" to move heads between ratings in a calibration (each move once per head), then settle it. You may also change habits before acting, using the habit and option ids shown.',
  ].join('\n\n');
}

/** Adds a recap or review to what the player has read since their last decision, keeping the order read. */
// @spec PLAY-AI-002
export function addReading(read: string, reading: string): string {
  return read ? `${read}\n\n---\n\n${reading}` : reading;
}

/** A screen's title and text with the heading once: a screen whose text opens with its own heading keeps just the text. */
export const withHeading = (s: { title: string; text: string }): string => (s.text.startsWith(s.title) ? s.text : `${s.title}\n${s.text}`);

/** The user message for one decision: the notebook, what was last read, and the screen. */
// @spec PLAY-AI-002
export function decisionMessage(screen: Screen, notebook: string, lastRead: string): string {
  const lines = [
    `Your notebook:\n${notebook || '(empty: you have just started)'}`,
    ...(lastRead ? [`What you read since your last decision (reactions, recaps and reviews, in order):\n${lastRead}`] : []),
    `The screen now (${screen.turn}):\n${withHeading(screen)}`,
    `Choices (ids in backticks):\n${screen.choices.map((c) => `- \`${c.id}\`: ${c.label}`).join('\n') || '(none)'}`,
    screen.canWait ? 'You may also let this wait.' : 'This cannot be let wait.',
  ];
  if (screen.habits.length) lines.push(`Habits:\n${screen.habits.map((h) => `- \`${h.id}\` (${h.label}), now \`${h.value}\`; options: ${h.options.map((o) => `\`${o.value}\` (${o.label})`).join(', ')}`).join('\n')}`);
  if (screen.placement) lines.push(`Heads to place: ${screen.placement.heads}. Targets:\n${screen.placement.targets.map((t) => `- \`${t.id}\`: ${t.label}`).join('\n')}`);
  if (screen.calibration) lines.push(`Calibration moves (each moves one head; give a count to move several):\n${screen.calibration.moves.map((m) => `- \`${m.id}\`: ${m.label}`).join('\n')}`);
  if (screen.funding) lines.push(`Bets on offer:\n${screen.funding.offers.map((o) => `- \`${o.id}\`: ${o.label}`).join('\n')}\nGroups that could carry one:\n${screen.funding.groups.map((g) => `- \`${g.id}\`: ${g.label}`).join('\n')}`);
  return lines.join('\n\n');
}

/** The human script's questions, by heading: each `### heading` with its "Ask afterwards" bullets. */
export function scriptQuestions(human: string): { heading: string; questions: string[] }[] {
  const out: { heading: string; questions: string[] }[] = [];
  for (const section of human.split(/^### /m).slice(1)) {
    const heading = section.split('\n')[0]!.trim();
    const ask = section.split('**Ask afterwards**')[1]?.split(/\n\n|^#/m)[0] ?? '';
    const questions = ask.split('\n').map((l) => l.replace(/^- /, '').trim()).filter((l) => l && !/^If they weren.t promoted/.test(l));
    if (questions.length) out.push({ heading, questions });
  }
  return out;
}

/** A promotion the run reached: its screen, and the turns played at the new level since. */
export interface Promotion {
  title: string;
  text: string;
  turns: string[];
  interviewed: boolean;
}

/**
 * Records a turn at the level a run was promoted to, and says whether the interview that follows the promotion is
 * due: once the tuned number of turns has been played there, before the next turn's first decision.
 */
// @spec PLAY-AI-006
export function interviewDue(promotion: Promotion | undefined, turn: string): boolean {
  if (!promotion || promotion.interviewed || !turn || promotion.turns.includes(turn)) return false;
  if (promotion.turns.length >= AI_TUNING.turnsAfterPromotion) return true;
  promotion.turns.push(turn);
  return false;
}

/** The interview's message: the questions for the metrics reached, from the notebook, the think-aloud and the promotion screens. */
// @spec PLAY-AI-006
export function interviewMessage(questions: { heading: string; questions: string[] }[], promotions: Pick<Promotion, 'title' | 'text'>[], notebook: string, thinkAloud: string[]): string {
  const asked = questions.filter((q) => promotions.length > 0 || q.heading !== 'Promotion changes the job');
  return [
    'The facilitator asks you some questions about your session. Answer each heading in your own words, as the player you are, from your notebook and what you thought as you played. Be specific and honest, including about what bored or confused you.',
    ...(promotions.length > 0 ? [`You were promoted during the session. What the game showed you then:\n${promotions.map(withHeading).join('\n\n---\n\n')}`] : []),
    `Your notebook:\n${notebook}`,
    `What you thought as you played, in order:\n${thinkAloud.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    `Questions:\n${asked.map((q) => `### ${q.heading}\n${q.questions.map((x) => `- ${x}`).join('\n')}`).join('\n\n')}`,
  ].join('\n\n');
}

/** One decision as the transcript keeps it. */
export interface Step {
  n: number;
  turn: string;
  title: string;
  screen: string;
  /** The reactions, recaps and reviews read since the last decision, as the playtester was sent them. */
  read?: string;
  reply: Reply | null;
  action: Action;
  /** The better choice, where the game's better-choice table knows the screen. */
  better?: string;
  note?: string;
}

export interface RunInfo {
  version: string;
  persona: Persona;
  seed: number;
  model: string;
  reached: string;
  requests: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/** The report: the run, the interviews, then the notable moments. */
// @spec PLAY-AI-007
export function renderReport(info: RunInfo, interviews: { when: string; interview: Interview }[], steps: Step[]): string {
  const t = info.tokens;
  const notable = steps.filter((s) => (s.reply && s.reply.feeling !== 'clear') || (s.better && s.action.kind === 'choose' && s.action.choiceId !== s.better) || s.note);
  const lines = [
    `# AI playtest: ${info.persona}, seed ${info.seed}`,
    '',
    `- **Version:** ${info.version}`,
    `- **Model:** ${info.model}`,
    `- **How far it got:** ${info.reached}`,
    `- **Decisions:** ${steps.length}; requests: ${info.requests}`,
    `- **Tokens:** ${t.input} in, ${t.output} out, ${t.cacheRead} read from the cache, ${t.cacheWrite} written to it`,
    '',
    '> The player was a language model, not a person. It reads every word and never tires, and it knows a good deal about management, so it is likely to overrate how clear the game is and underrate how tedious. Set its answers beside human sessions, not in place of them.',
  ];
  for (const { when, interview } of interviews) {
    lines.push('', `## Interview: ${when}`);
    for (const a of interview.answers) lines.push('', `### ${a.heading}`, '', a.answer);
  }
  lines.push('', '## Notable moments', '');
  if (!notable.length) lines.push('None: every screen read as clear, and no better choice was passed over.');
  for (const s of notable) {
    const why = [
      ...(s.reply && s.reply.feeling !== 'clear' ? [s.reply.feeling] : []),
      ...(s.better && s.action.kind === 'choose' && s.action.choiceId !== s.better ? [`chose ${s.action.choiceId}, not ${s.better}`] : []),
      ...(s.note ? [s.note] : []),
    ];
    lines.push(`- **${s.n}. ${s.turn}, ${s.title}** (${why.join('; ')}): ${s.reply?.thinkAloud ?? '(no reply)'}`);
  }
  return lines.join('\n') + '\n';
}

/** Whether Anthropic credentials are in the environment: an API key, a token, or a signed-in profile. */
// @spec PLAY-AI-001
export function hasCredentials(env: Record<string, string | undefined>, profileExists: boolean): boolean {
  return Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE || profileExists);
}

export const NO_CREDENTIALS =
  'The AI playtester needs Anthropic credentials and found none. Sign in with `ant auth login`, or export ANTHROPIC_API_KEY, then run `npm run playtest:ai` again. Nothing was sent.';

/** The run's options, from the environment, checked. */
// @spec PLAY-AI-008
export function runOptions(env: Record<string, string | undefined>): { persona: Persona; seed: number; until: 'promotion' | 'director' | 'end'; maxDecisions: number; decisionModel: string } {
  const persona = (env.AI_PERSONA ?? 'new-manager') as Persona;
  if (!Object.hasOwn(PERSONAS, persona)) throw new Error(`AI_PERSONA must be one of ${Object.keys(PERSONAS).join(', ')}`);
  const until = (env.AI_UNTIL ?? 'promotion') as 'promotion' | 'director' | 'end';
  if (!['promotion', 'director', 'end'].includes(until)) throw new Error('AI_UNTIL must be promotion, director or end');
  const seed = env.AI_SEED ? Number(env.AI_SEED) : 101;
  if (!Number.isInteger(seed) || seed < 0) throw new Error('AI_SEED must be a whole number');
  const maxDecisions = env.AI_MAX_DECISIONS ? Number(env.AI_MAX_DECISIONS) : AI_TUNING.maxDecisions[until];
  if (!Number.isInteger(maxDecisions) || maxDecisions < 1) throw new Error('AI_MAX_DECISIONS must be a whole number of at least 1');
  const model = env.AI_MODEL ?? 'opus';
  if (!Object.hasOwn(AI_TUNING.models, model)) throw new Error(`AI_MODEL must be one of ${Object.keys(AI_TUNING.models).join(', ')}`);
  return { persona, seed, until, maxDecisions, decisionModel: AI_TUNING.models[model as keyof typeof AI_TUNING.models] };
}

/** What the playtester asks Claude with: one request, a structured reply, or null when refused or unparseable. */
export interface AiClient {
  ask<T>(system: string, user: string, schema: z.ZodType<T>, effort: 'medium' | 'high', model: string): Promise<T | null>;
}

/**
 * One decision: asks, checks the reply against the screen, sends an invalid reply back once with the reason, and
 * lets the moment wait (or takes its first choice, where it cannot wait) if the second reply is invalid too.
 */
// @spec PLAY-AI-003, PLAY-AI-004, PLAY-AI-009
export async function decide(client: AiClient, system: string, screen: Screen, notebook: string, lastRead: string, model: string = AI_TUNING.model): Promise<{ reply: Reply | null; action: Action; habits: { habit: string; value: string }[]; notebook: string; note?: string }> {
  let message = decisionMessage(screen, notebook, lastRead);
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await client.ask(system, message, ReplySchema, 'medium', model);
    if (!reply) {
      message = `${decisionMessage(screen, notebook, lastRead)}\n\nYour last reply could not be read. Reply again in the required form.`;
      continue;
    }
    const checked = checkReply(screen, reply);
    if (checked.ok) return { reply, action: checked.action, habits: checked.habits, notebook: keepNotebook(reply.notebook) };
    message = `${decisionMessage(screen, notebook, lastRead)}\n\nYour last reply could not be acted on: ${checked.reason} Reply again.`;
  }
  const fallback: Action = screen.canWait ? { kind: 'wait' } : { kind: 'choose', choiceId: screen.choices[0]!.id };
  return { reply: null, action: fallback, habits: [], notebook, note: 'no valid reply after two tries' };
}
