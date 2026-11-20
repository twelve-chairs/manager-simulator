/** How to play: the game's controls, not management lessons (see the HLD's non-goals). */
export const HELP_TOPICS = [
  { id: 'how-to-play', title: 'How to play', text: 'Each week is a handful of moments, Monday to Friday. Pick what you do in each one, or let it wait. Your habits handle the routine, and a recap ends the week.' },
  { id: 'moments', title: 'Moments', text: "Choices take effect at once. Doing something yourself costs energy; giving it to someone costs them, and goes well if it's within their skill. What you let wait may come back, or cause trouble." },
  { id: 'habits', title: 'Habits', text: 'Habits are how you run the team every week: who takes night pages, how often you hold 1:1s, who signs routine approvals, how much ceremony there is, and whose growth you focus on. Change them any time.' },
  { id: 'people', title: 'Your people', text: 'Everyone has a personality and remembers what happened between you. 1:1s build trust and reveal what each person wants; people whose wants go unserved lose motivation, and unhappy people leave.' },
  { id: 'energy', title: 'Energy', text: 'Your energy falls with the work you take on and recovers in quiet weeks. Four weeks running on fumes and you burn out.' },
  { id: 'reviews', title: 'Reviews', text: "Every 13 weeks your manager reviews delivery, retention, team health and the quarter's goals. Two strong reviews in a row from week 52 earn a promotion; three weak ones in a row and you're out." },
] as const;

/** One line of help under each line manager panel's heading. */
export const PANEL_HELP = {
  team: 'Words are your read on each person. Wants appear after a 1:1.',
  projects: 'Projects move on their own. Risk and tech debt make setbacks more likely.',
  habits: "Changes apply from this week's end, and to moments from next week.",
} as const;

/** The How to play section starts open while the onboarding situations run. */
export const HELP_OPEN_THROUGH_WEEK = 2;
