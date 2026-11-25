import type { Personality } from '../../personalities';

/** Reactions to a choice that involves an engineer, one per personality. `{name}` is the engineer, `{thing}` the work. */
type ByPersonality = Record<Personality, string>;

const GIVE: ByPersonality = {
  ambitious: '{name} takes the {thing} before you finish asking. "I was hoping you’d say that."',
  quiet: '{name} nods, writes it down, and has a draft in your inbox by the afternoon.',
  eager: '{name} lights up. "On it! Can I pair with someone if I get stuck?"',
  steady: '{name} asks two sharp questions about scope, then gets on with it.',
  blunt: '{name} shrugs. "Fine. But that’s the third thing this week."',
  anxious: '{name} says yes, then comes back twice to check they understood it right.',
};

const STRETCH: ByPersonality = {
  ambitious: '{name} grins. "Finally, something hard." It’s rough around the edges, but they learned a lot.',
  quiet: '{name} goes quiet for a day, then turns in something not quite there. They clearly learned from it.',
  eager: '{name} dives in over their head. Some of it needs rework, but they won’t make those mistakes again.',
  steady: '{name} works through it slowly and says plainly where it fell short. Next time it’ll be better.',
  blunt: '"This is above my pay grade," says {name}, and does it anyway. Not perfect. They know it.',
  anxious: '{name} loses sleep over the {thing}. It’s shakier than you hoped, though they grew from it.',
};

const ASK_INTERVIEW: ByPersonality = {
  ambitious: '{name} runs the interview like they’re already the hiring manager. Their notes are excellent.',
  quiet: '{name} says little in the interview but writes the most useful feedback of the panel.',
  eager: '{name} spends half the interview selling the team. The candidate leaves smiling.',
  steady: '{name} asks the same careful questions they always do. Fair, thorough, a little long.',
  blunt: '{name} asks the candidate the question nobody else would. It turns out to be the right one.',
  anxious: '{name} over-prepares for the interview and is glad, after, that you asked them.',
};

const BACK_UP: ByPersonality = {
  ambitious: 'You join the call. {name} drives; you mostly keep quiet. They seem to like that.',
  quiet: 'You join the call and {name} relaxes. You talk it through together until it’s fixed.',
  eager: '{name} narrates every step to you in the call. You learn as much as they do.',
  steady: '{name} has it in hand by the time you join, but says thanks for being there.',
  blunt: '"I didn’t need a babysitter," says {name}. They do sound relieved, though.',
  anxious: '{name} is visibly calmer the moment you join. You get through it together.',
};

const TAKE_OVER: ByPersonality = {
  ambitious: 'You take the page. In the morning {name} asks what you did, a little put out it wasn’t them.',
  quiet: 'You take the page and let {name} sleep. They don’t mention it, but they look rested.',
  eager: 'You take the page. {name} is disappointed to have missed the excitement.',
  steady: 'You take the page. {name} reads your notes first thing and files the follow-ups.',
  blunt: 'You take the page. "You know I could have handled that," says {name} over coffee.',
  anxious: 'You take the page. {name} says thank you three times before lunch.',
};

const LEAVE: ByPersonality = {
  ambitious: '{name} handles the page alone and writes it up before anyone asks.',
  quiet: '{name} fixes it at 3 a.m. and says nothing about it until the stand-up.',
  eager: '{name} handles it and posts a long, cheerful write-up in the team channel.',
  steady: '{name} handles it calmly, by the runbook, and goes back to sleep.',
  blunt: '{name} fixes it and mutters about the alert threshold all morning.',
  anxious: '{name} gets through the page alone, but looks worn out the next day.',
};

const LEAVE_SHORT: ByPersonality = {
  ambitious: '{name} tries to fix it alone and makes it worse before it gets better. Customers noticed.',
  quiet: '{name} struggles alone for hours rather than wake anyone. The outage drags on.',
  eager: '{name} tries three fixes in a row. The third one works, eventually. It was a long night for customers.',
  steady: '{name} follows the runbook, but the runbook was wrong. The outage runs long.',
  blunt: '{name} gets it back up, late, and says in the morning that they should never have been alone on it.',
  anxious: '{name} panics a little, then recovers. By then the outage is in the status page history.',
};

const BY_PERSONALITY = { give: GIVE, stretch: STRETCH, ask: ASK_INTERVIEW, backUp: BACK_UP, takeOver: TAKE_OVER, leave: LEAVE, leaveShort: LEAVE_SHORT };

/** Reactions to choices with no engineer in them. */
const PLAIN = {
  self: 'You clear the time and do the {thing} yourself. It’s done properly, and it comes out of your own energy.',
  pushBack: 'You push back on the {thing}. It’ll still be there next week.',
  rollBack: 'The change behind the outage on {thing} comes out, and everything is back up within the hour. The work it carried will have to be done again.',
  payDown: 'The team takes the time to fix the code the design builds on. {thing} slips a few days, and the next change there will be easier.',
  smaller: 'You offer the customer part of what they asked for, sooner. They take it, a little grudgingly.',
  take: 'You take on the new work. The team gets a new project on top of what’s already stretching it, and you get a fuller week.',
  decline: 'You decline the new work. The person asking is disappointed, but understands.',
  interview: 'You interview the candidate yourself. An hour well spent, and an hour gone.',
  skip: 'You skip this week’s interview. The role stays open a little longer.',
  replan: 'You spend the morning re-planning {thing} with the team. It’s tiring, and the plan is better for it.',
  cutScope: 'You agree with the stakeholder to cut scope on {thing}. They’re not thrilled, but the team breathes out.',
  moveDeadline: 'You ask for more time on {thing}. You get it, and your manager notices you asked.',
  pushOn: 'You leave {thing} as it is and hope the plan holds.',
};

export type ReactionKey = keyof typeof BY_PERSONALITY | keyof typeof PLAIN;

const fill = (text: string, name: string, thing: string) => text.replaceAll('{name}', name).replaceAll('{thing}', thing);

/** The reaction for a choice, chosen by the personality of the engineer involved where there is one. */
// @spec LINE-WORK-004
export function reaction(key: ReactionKey, thing: string, engineer?: { name: string; personality?: string }): string {
  if (key in BY_PERSONALITY) {
    const set = BY_PERSONALITY[key as keyof typeof BY_PERSONALITY];
    const p = (engineer?.personality ?? 'steady') as Personality;
    return fill(Object.hasOwn(set, p) ? set[p] : set.steady, engineer?.name ?? 'They', thing);
  }
  return fill(PLAIN[key as keyof typeof PLAIN], engineer?.name ?? '', thing);
}
