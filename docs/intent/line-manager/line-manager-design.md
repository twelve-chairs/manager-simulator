---
parent: high-level-design
prefix: LINE
---

# Line Manager Level

## Context and Design Philosophy

The line manager level is the first career level: the player leads one team of engineers, week by week. Following the HLD's *A week is a run of moments*, a week here is a handful of short scenes, not a planning screen. The level decides who is on the team and what they are like, which standing habits the player can set and what they do each week, what hands-on work arrives and which of it becomes a moment, what the player can see, what each week's recap says about the level's part of the week, and what the quarter's goals and reviews measure. It does not order the week (the turn loop does), write story situations (content does), or decide ratings and promotion (the performance review does).

The level's core tension is the one the HLD names: hands-on work competes with managing people for the player's energy. The player meets it in two ways. **Habits** decide how routine work and routine care happen, week after week, without a decision each time. **Moments** are the work and the people that need a decision this week.

Four principles shape it:

- **Habits over chores.** Anything that would be the same decision every week is a habit: set once, changed when the player wants, and visible in its effects in each recap. A habit has real costs as well as benefits, so there is no single right setting for every team.
- **Work keeps arriving.** Approvals, design reviews, customer requests, on-call pages and new work keep arriving from the state of the team's projects, as they do in the real job; busier and riskier projects bring more. Routine work is absorbed by habits; the rest becomes moments. This keeps the pressure systemic: it is not only as strong as the content written about it.
- **Energy is your stress.** The player has no hours to budget. Doing work yourself, demanding habits and hard conversations raise the player's stress; a well-run team lowers it. Shown to the player as energy, it is the simulation's own player stress, and burnout is what happens when it stays at the edge.
- **People are characters.** Each engineer has a personality as well as numbers, and moments and their reactions are written for it: the same choice lands differently on a quiet engineer and an ambitious one.

## The Organization

A run starts from an organization the level generates from the run's seed: one team led by the player, of five engineers with varied skill, motivation, stress, wants and **personalities**, and two projects, one on track and one already at risk. Names come from a fixed list of fictional names in the level's data.

A **personality** is one trait from the personality catalogue, the shared list the situation engine also validates content against (for example *ambitious*, *quiet*, *eager*, *steady*, *blunt*, *anxious*), drawn so that a starting team has at least three different ones. It is stored on the simulation's person, where story situations can read it as a condition, but no simulation rule uses it: it changes no number, and content conditions on it to choose which reaction a choice gets.

## Visibility

The player sees what a manager of this team would see, which is less than the simulation holds:

| Value | What the player sees |
|---|---|
| Name, role, tenure, personality | Exactly |
| Motivation and stress | A coarse band, in words (*struggling* to *energized*, *calm* to *overwhelmed*) |
| Skill | A coarse band |
| Want | Unknown until the player has held a 1:1 with that person; known from then on |
| Trust | Not shown |
| Performance level | Exactly |
| What they remember | Their most recent notable history entries, as short lines in their own terms; a habit's routine notes, such as each 1:1, are left out, since they come every week and would crowd out what happened between you; a note repeated back to back shows once with its count, as in the recap |
| Project progress, deadline, schedule status | Exactly |
| Project risk and tech debt | A coarse band |
| The player's energy and reputation | A coarse band |
| Habits, open vacancies, the quarter's goals and their progress | Exactly |

Every banded value uses the same scale of bands over 0–100 (the cut-offs are tuning values), so a work moment's difficulty and an engineer's skill compare directly.

## Habits

A habit is a standing choice with weekly effects. The level starts every run with each habit at its default. The player can change any habit at any point in a week: the change applies to that week's end-of-week habit effects and to the moments of the weeks after, while a moment already on screen stays as it was. When a habit names an engineer who leaves the team, it falls back (*routine approvals* to you signing, *growth focus* to nobody) as soon as the next week begins or the current one ends, and the recap says so. An engineer who signs routine approvals never signs their own expenses: those come to you. A night page that reaches the week's end without a moment (it arrived while you were taking pages yourself, or there was nobody to put on call) is one you took. The simulation keeps whole points, so a habit's small per-item costs are added up for the week before they apply. Each week's recap reports what each habit did.

| Habit | Options (default first) | Each week |
|---|---|---|
| **Night pages** | A rotation through the team; you take them yourself; seniors only | Decides who handles on-call escalations. You: no moment, and the player's stress rises for each. A rotation or seniors: the escalation becomes a moment for the person on call, and their skill against its difficulty decides how it goes; seniors only spares juniors but loads the most skilled. |
| **1:1 cadence** | Fortnightly; weekly; only when needed | Holds a 1:1 with each engineer at that cadence: trust and a little motivation, and the person's want becomes known. Weekly costs the player more stress; only when needed costs nothing and holds none, which also shows in the review's 1:1 share. |
| **Routine approvals** | You sign them; a named engineer signs them | Release, access and expense approvals. You: a small stress cost per approval. A named engineer: it costs them a little stress and serves a want for autonomy; those they are not skilled enough for wait and can expire. |
| **Ceremonies** | Full; light | Full: project risk holds, a small stability-serving motivation for the team, a little stress for the player. Light: no player cost, and project risk creeps up. |
| **Growth focus** | Nobody; a named engineer | Coaching for that engineer each week: skill rises, serving a want for growth; costs the player some stress. |

Every habit's effects enter the simulation as one batch per week, each with the habit's id as its cause, so history and the recap can name the habit.

## Work

Each week, hands-on **work items** arrive for the team's active projects and people: approvals, design reviews, customer requests, on-call escalations, expense requests, and work intake when the team has fewer than two active projects. How many arrive, and of which kinds, depends on the projects' risk and tech debt and on how many there are; the level draws them from its own seeded generator. Each item has a difficulty, a subject (a project or a person), and a last week before it expires.

- **Routine items** (release, access and expense approvals) are handled by the *routine approvals* habit and never become moments.
- **On-call escalations** are handled by the *night pages* habit: by the player directly, or as a moment for the engineer on call, where the player can back them up, take over, or leave it to them.
- **Everything else** (design reviews, customer requests, work intake) becomes a **work moment**.

A **work moment** presents the item in a sentence and offers, at most:

- **Do it yourself**: resolves it, at a stress cost for the player that grows with its size;
- **Give it to** each of up to two engineers the level suggests (the least stressed whose skill band reaches the item's difficulty, and the least stressed who would be stretched by it): their stress rises and wants for growth or autonomy are served; if the item's difficulty is above their skill, it is a stretch: it resolves with a reduced consequence and their skill rises;
- **Push back or let it wait**: nothing now; the item stays and expires at its last week with its consequence (a slipped project, a lost bit of reputation, a frustrated requester). Work intake offers **take it on** and **decline** instead.

After the player declines work intake, or lets it expire, the next offer waits a few weeks (a tuning value), so saying no is not met with the same scene every week. A team that ends several weeks in a row with no active project (a tuning value) is not left idle: the player's manager assigns it a new project, and that week's recap says so. A team that ends more than half a review period's weeks with no active project is scored on it at the review: the on-schedule share counts as none rather than being left out, and the on-schedule goal counts as missed. Otherwise a player who declines all new work would face no measure at all for having nothing to deliver.

Each choice gets a short reaction from the level's templates, written for the person involved and their personality where there is one.

## Hiring

When the team's active engineers fall below its target headcount (its starting size), the level opens a **vacancy**. While a vacancy is open, each week brings an **interview moment**: interview the candidate yourself (stress for the player), ask an engineer to (stress for them, a little recognition), or skip this week. After a set number of interviews, the level hires a generated engineer with a name from the list and a personality.

## Project Check-ins

When a week begins, each of the team's active projects that is behind schedule, overdue, or at high risk brings a **check-in moment**, at most once in a few weeks per project (a tuning value), so a struggling project asks for the player's attention rather than quietly wearing them down. A check-in offers:

- **Re-plan it with the team**: the player's stress rises, and the project's risk falls;
- **Cut scope**: the project's scope shrinks by a share of what is left, and the player's reputation falls a little;
- **Move the deadline**: the deadline moves out by a few weeks, and the player's reputation falls more than for cutting scope;
- **Push on**: nothing changes now.

The check-in's scene names the one reason it came up, the first that holds of: overdue, behind schedule, or high risk, so the player can match the lever to the trouble.

These are the levers a line manager has over a project in trouble: more planning, less work, more time, or none. Each has a cost, and which is right depends on why the project is struggling: risk is what brings setbacks, while scope and the deadline are what decide whether it is behind.

## A Week's Moments

The level contributes five kinds of moment to a week: final evaluations, work moments, interview moments, check-in moments, and on-call moments when the night pages habit puts an engineer on call. The situation engine contributes story moments from content. The level caps its own moments per week (a tuning value) so that a week stays a handful of scenes; items closest to expiring become moments first, and items beyond the cap wait for a later week and keep counting down to expiry. An item pushed back or left unanswered comes back as a moment in later weeks until it is resolved or expires, so pushing back defers a decision rather than dropping it. A level moment left unanswered at the end of the week counts as letting it wait: a work item stays and keeps counting down, an interview is skipped, and an on-call escalation nobody answered expires with its consequence. When the cap bites, final evaluations come first, then on-call moments, then check-ins, then interviews, then work. Each moment has a day and a time (on-call at night, check-ins on Monday morning, interviews mid-week, work through the week), which the turn loop uses to order the week. A check-in left unanswered changes nothing. An on-call moment's scene says a change from the project has taken production down, never that the project itself is down: a project still in progress has nothing running to go down.

## The Quarter's Goals

At the start of each review period, the player's own manager sets **goals** for it, drawn from a fixed set by the state of the team: ship an at-risk project by its deadline (the deadline as it stood when the goal was set, so moving it at a check-in does not meet the goal; offered only when the deadline falls within the period, so it can be judged at the review; otherwise get it back on schedule), keep everyone (no quits), grow someone (a named engineer's skill rises by a set amount), bring team stress down to a level. Each period has two or three. A goal about an engineer who leaves the team is dropped from that review's scoring, and the recap says so: the departure already counts against retention. With no active projects, the on-schedule goal reads "No projects running" rather than a count of none. Their progress is visible all period, with any week number in it, such as a deadline, shown counting from 1 (see the HLD's *Players count weeks from 1*), and they are scored at the review as extra measures alongside the scorecard.

## The Recap

At the end of each week the level reports its part of the week, for the turn loop to show alongside the situations' aftermath:

- what each habit did ("Carmen signed four approvals", "You took two night pages");
- how each work moment went, and what expired;
- who changed, in words, with the causes the simulation recorded ("Dario seems flat: no 1:1 in three weeks");
- the goals' progress.

## Scorecard, Reviews and the End of the Level

- **Cadence**: a review every 13 weeks, at weeks 13, 26, 39 and so on; "since the last review" means the 13 weeks before the review.
- **Scorecard and assessment**: delivery (projects completed on time, and the share of active projects neither overdue nor behind), retention (quits rated meets or above), and team health (average motivation and stress, and the share who had a 1:1 in the four weeks before the review). Each has a target, tolerance and direction for the review, and the on-schedule share is left out when there are no active projects. The period's **goals** are added as measures: each scores *above target* if achieved and *below* if missed.
- **Promotion**: possible from the fourth review on, when the performance review rates the player highly enough.
- **The last review**: the level lasts three years at most. Its twelfth review, at week 156, is its last: a player not promoted there has stayed a line manager, and the run ends.
- **A team at breaking point**: when the team's average stress is in the overwhelmed band at a review, the level sets a ceiling of *meets* on the rating, with the reason "Your manager won't call it a strong quarter with the team this stretched". Stress already counts as one measure among many; without the ceiling, a player who loads every piece of work onto the team can be rated well for years while the team is overwhelmed. The ceiling starts at *overwhelmed* rather than *strained*: a well-run team under real deadlines spends some quarters strained, and capping those would punish sound practice along with neglect. A team overwhelmed for most of the quarter, more than half its weeks by the team's average stress at each week's end, lowers the ceiling to *partial*, with the reason "Your team spent most of the quarter overwhelmed." The *meets* ceiling alone only blocks promotion: a player who overloads the team quarter after quarter would otherwise stay at *meets* for good, while three *partial* quarters in a row put them on the path to being managed out.
- **Evaluations**: the people a line manager rates are rated each quarter. One evaluation a quarter is a moment, the *Evaluation due* situation, for an engineer whose rating on what they delivered would be anything but *meets*, so the choice between an honest rating and keeping the peace matters. At the end of each review period's last week, the level rates every other engineer who has been on the team since the period began and has no rating in it, on what they delivered (their corresponding rating), and the recap names them. The starting organization's ratings, recorded in week 0, are the previous cycle's and do not count as a rating in the first period. Letting someone go stays the player's decision: when the rating on what they delivered would be an engineer's third low rating in a row, which ends their improvement plan and removes them, the level does not give it. It holds a **final evaluation** moment for them on the next Monday afternoon instead, offering to rate them on what they delivered and let them go, or to give them one more quarter, which records no rating for that quarter. Left unanswered, the moment counts as one more quarter. A rating's note always names the rating ("Rated exceeds on what they delivered"), whether the level gives it or the player does in a situation. The same holds wherever the player rates someone: a choice in the level's situations that would give an engineer on an improvement plan their third low rating says so in its label ("…, and let them go"), so no rating ends someone's job without the player knowing it will. An engineer who joined during the period is rated from the next one.
- **Burnout**: if the player's stress stays at or above the burnout threshold for four consecutive weeks, the run ends. The view shows whether the player is at that threshold now, **at the edge**, and how many weeks in a row they have ended there, so the danger is visible before it ends the run.
- **Managed out**: the performance review ends the run when the player fails an improvement plan.

## Turn Loop Contract

The level provides the turn loop's career level contract through an adapter over its own operations:

- *begin week* has work arrive, sets a new review period's goals, and makes the week's moments, each with a day and a time;
- *moments* lists the week's level moments and which are still open: a moment is open only while it can still be answered, so one whose work, vacancy, project or engineer on call has gone is reported closed;
- *plan* takes a **habit change**, which applies at once to the level; commands arrive from saves, so their shape is checked rather than trusted;
- *choose* applies a **moment choice** at once to the level and the simulation, and returns its reaction;
- *end week* closes the moments left unanswered, applies the habits' weekly effects and expires what is due, and returns the level's **recap**, whose people are the engineers whose motivation or stress band changed that week or who gained a memory note that week from something other than a habit (a moment choice or a situation); a habit's notes, such as a 1:1, come every week and would put the whole team in every recap. The end-of-period evaluation's notes are left out too, since the recap lists those evaluations on their own. Each person's notes are listed once each, with how many times a note recurred that week ("Took on a design review, twice");
- *assess* includes the period's goals.

## Level State

The level keeps its own serializable state beside the simulation's and the situation engine's: its generator state, the habits, the open work items, the week's level moments and which are resolved, the wants the player has learned, open vacancies and their interview counts, the period's goals and their starting values, the week each project completed, the week of each project's last check-in, and the counters its rules need. Every operation returns a new state and leaves its input unchanged.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Core loop | Habits for routine work and care, moments for what needs a decision; see [decisions/moments-loop.md](../../decisions/moments-loop.md) | A weekly calendar and inbox planned by hand | The planner played as a test; habits remove repeated decisions, and moments carry the reactions that make play engaging. |
| Where work moments come from | A work generator in the level, driven by project state; routine items absorbed by habits, the rest presented as templated work moments | Every work moment written as content | Keeps work pressure systemic, so busier and riskier projects really are harder and the balance checks mean something, and keeps delegation a lesson every week, not only in weeks content covers it. Story situations still add written drama on top. |
| Time and energy | Energy is the player's stress; no hours | A weekly energy budget that moments spend | One number the simulation already has, with burnout already attached; a budget would bring back the planning the moments loop removes. |
| Goals | Two or three per review period, scored as extra measures beside the scorecard | Goals replace the scorecard | Gives each quarter something to aim at while keeping the stable measures the balance checks rely on. |
| Personality | One trait per person that content conditions on; no effect on numbers | Traits that change how effects land | Keeps the simulation's balance independent of personality while letting the writing make people distinct. |
| Levers over a struggling project | A check-in moment for a project behind, overdue or at high risk, with re-plan, cut scope, move the deadline or push on | Project actions in a habit; no lever, leaving projects to the simulation | Without a lever, a project that falls behind keeps the player's stress rising with nothing to do about it, and burnout becomes luck. A moment raises it when it matters, keeps the choice visible, and gives the player proactive play over delivery. A habit would make the decision once for every project. |
| Delegation choices in a work moment | Up to two suggested engineers, one within reach and one stretched | Every engineer as a choice | Keeps a moment to a few choices, and puts the real decision (a safe pair of hands or someone who would grow) in front of the player. |
| Visible values | Bands in words and what people remember; numbers secondary | Exact numbers | The HLD's *Show it through people over through numbers*; a manager reads people, not dashboards. |

## Open Questions & Future Decisions

### Deferred
1. Contractors, interns, entry-level program engineers and remote workers as distinct kinds of hire.
2. Leave: engineers away from the team for some weeks.
3. Whether personality should also change how effects land.
4. Tuning: habit effects, arrival rates, the cap on level moments, goal thresholds and effect sizes are set by the balance harness and play-testing, not by this design.

## References

- [High-level design](../../high-level-design.md)
- [Decision: the week as a run of moments](../../decisions/moments-loop.md)
- [Simulation core](../simulation-core/simulation-core-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Performance review](../performance-review/performance-review-design.md)
