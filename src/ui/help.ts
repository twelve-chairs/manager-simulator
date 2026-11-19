/** How to play: the game's controls, not management lessons (see the HLD's non-goals). */
export const HELP_TOPICS = [
  { id: 'how-to-play', title: 'How to play', text: 'Each turn is one week: plan it, deal with what comes up, then press End week.' },
  { id: 'hours', title: 'Hours', text: 'You have 40 hours a week. Calendar entries and inbox items you handle yourself cost hours; going over means overtime, which raises your stress.' },
  { id: 'inbox', title: 'Inbox', text: 'Hands-on work arrives here. Handle it yourself (costs hours), delegate it to an engineer (costs them stress; it goes well if the difficulty is within their skill), or leave it. Left too long, it causes trouble.' },
  { id: 'situations', title: 'Situations', text: 'Moments that need a decision. Choices take effect at once.' },
  { id: 'people', title: 'Your people', text: '1:1s build trust and reveal what each person wants. Coaching, training, recognition, delegation and ceremonies each serve a different want. People whose wants go unserved lose motivation, and unhappy people leave.' },
  { id: 'reviews', title: 'Reviews', text: "Every 13 weeks your manager reviews delivery, retention and team health. Two strong reviews in a row from week 52 earn a promotion; three weak ones in a row and you're out. Four weeks at the edge of your stress and you burn out." },
] as const;

/** One line of help under each line manager panel's heading. */
export const PANEL_HELP = {
  team: 'Words are your read on each person. Wants appear after a 1:1.',
  projects: 'Projects move on their own. Risk and tech debt make setbacks more likely.',
  inbox: "Difficulty uses the same words as skill. Delegate to someone at least that skilled, or it's a stretch with some fallout.",
  calendar: 'Recurring entries repeat until you remove them.',
} as const;

/** The How to play section starts open while the onboarding situations run. */
export const HELP_OPEN_THROUGH_WEEK = 2;
