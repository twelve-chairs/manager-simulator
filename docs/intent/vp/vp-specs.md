# VP Level — Specs

Design: [vp-design.md](vp-design.md)

The bands a value is shown in are the line manager level's five bands of a 0–100 value; a band shown *better* is the healthier one. A quarter is thirteen weeks, and quarters, years and reviews count from the start of this level; a year is four quarters and a half is two. A *division* is an aggregate team in the simulation core led by a director, a person with the role `manager`. The *CEO* and the *peers* are people outside the function with the roles `executive` and `peer`. *Energy* is the player's stress seen the other way up, as at the earlier levels. Regretted attrition is heads lost whose rating was *meets* or better; heads cut are not attrition. A value or rate the specs call *tuned* is set in the level's tuning, by the balance harness and playtesting.

## Handover

- [x] **VP-HAND-001**: When a director review promotes the player, the VP level shall offer a handover choice of who leads the player's organization: each active senior manager leading one of the player's groups, shown with their management skill, trust in the player and want, or an outside hire.
- [x] **VP-HAND-002**: When the player chooses one of their senior managers, the VP level shall make them the division's director, keeping their management skill, trust and want, and form the division around the group they led.
- [x] **VP-HAND-003**: When the player chooses an outside hire, the VP level shall add a director with management skill in the *capable* band, trust of 50 and a want drawn from the level's generator, and raise the division's stress by a tuned amount after the fold.
- [x] **VP-HAND-004**: When the handover is applied, the VP level shall fold every group in the player's director organization into one division led by the new director, as the director level's handover folds teams into a group: the division is the group the chosen senior manager led, or with an outside hire the first group, whose own senior manager becomes one of its heads; each other group's heads move into it at their ratings, its senior manager becomes one of its heads, its active projects are reassigned to it, and it is closed.
- [x] **VP-HAND-005**: When the handover is applied, the VP level shall add two divisions to the function, each with a generated director, headcount, health and two projects sized for a division; keep the director level's executive and peers in the state but out of the player's view; and add the CEO and two peers.
- [x] **VP-HAND-006**: When the handover is applied, the VP level shall keep the player's energy, reputation and rating history, and leave every folded person in the state as an aggregated person with their history.
- [x] **VP-HAND-007**: If a handover choice names neither a senior manager leading one of the player's groups nor an outside hire, then the VP level shall reject it with an error and leave the state unchanged.

## The function

- [x] **VP-ORG-001**: The VP level shall give each generated director a name, personality, want, management skill, motivation, stress and trust drawn from the level's generator, and a leniency from 0 to 2 rating steps.
- [x] **VP-ORG-002**: The VP level shall give the CEO and each peer a name, personality, want, motivation, stress and trust in the player drawn from the level's generator.
- [x] **VP-ORG-003**: The VP level shall give each division at most one director, and treat a division whose director has left as leaderless until a new one is set.

## Visibility

- [x] **VP-VIS-001**: When the player's view is requested, the VP level shall show each director with their name, personality, division, performance level, memory, motivation, stress and management skill as bands, and their want once revealed by a moment they took part in.
- [x] **VP-VIS-002**: When the player's view is requested, the VP level shall show each division under its director with its current headcount and projects (progress against scope, deadline and schedule status), and its motivation, stress and attrition risk as bands as the last engagement survey measured them, with the survey's quarter.
- [x] **VP-VIS-003**: When the player's view is requested, the VP level shall show the CEO and each peer with their name, personality, role, trust in the player as a band, memory, and their want once revealed by a moment they took part in.
- [x] **VP-VIS-004**: When the player's view is requested, the VP level shall show the year's plan: the headcount given for the year and how much of it has arrived, and the company priority with the division or divisions carrying it, its project's progress, deadline and schedule status, and its stake.
- [x] **VP-VIS-005**: When the player's view is requested, the VP level shall also give the habits, the quarter's moments with their kind, title, text and choices, the player's energy and reputation as bands with whether they are at the edge, the goals with their progress, and the career summary.
- [x] **VP-VIS-006**: The VP level shall never show a director's leniency as a value, and shall show no group, team or person inside a division except as named in situations and the recap.
- [x] **VP-VIS-007**: When the player's view is requested, the VP level shall mark each director who is restless.

## Habits

- [x] **VP-HABIT-001**: When the level begins, the VP level shall set your first team to your function and how you lead your directors to set direction and step back.
- [x] **VP-HABIT-002**: When the player changes a habit, the VP level shall apply the new setting from that quarter's end-of-quarter effects and to the moments of later quarters.
- [x] **VP-HABIT-003**: If a habit change names an unknown habit or option, then the VP level shall reject it with an error and leave the level state unchanged.
- [x] **VP-HABIT-004**: When a quarter ends with the function first, the VP level shall raise each director's trust by a tuned amount and lower each peer's trust by a tuned amount; with the leadership team first, it shall raise the CEO's and each peer's trust by tuned amounts and lower each director's trust by a smaller tuned amount.
- [x] **VP-HABIT-005**: When a quarter ends with direction set and the player stepping back, the VP level shall raise the management skill of each director whose skill is at least *developing* by a tuned amount; with plans reviewed closely, it shall speed the company priority's project by a tuned amount, move each division whose director's management skill is below *capable* a further tuned share toward the motivation and stress a *capable* director sustains, lower each director's trust by a tuned amount, and cost the player a tuned amount of energy.

## Divisions under their directors

- [x] **VP-DRIFT-001**: When a quarter ends, the VP level shall move each division's motivation and stress a tuned share of the way toward the levels its director's management skill sustains, and set its attrition risk from them.
- [x] **VP-DRIFT-002**: When a quarter ends, the VP level shall move each director's motivation by whether their want was served that quarter (growth and autonomy with directors given room; recognition with the function first, or with that quarter's all-hands telling the truth or celebrating; stability with their division below the *strained* band) and their stress toward their division's stress, as tuned.
- [x] **VP-DRIFT-003**: When the level begins, and when a quarter ends that is the last before a review, the VP level shall take the engagement survey: record each division's motivation, stress and attrition risk bands and the quarter.
- [x] **VP-DRIFT-004**: When a review period ends, the VP level shall calibrate each division's ratings without a scene: move its heads to the ratings its delivery corresponds to, then raise them by its director's leniency, using re-rate effects, and lower the division's motivation by a tuned amount for each rating step its ratings sit above what it delivered.
- [x] **VP-DRIFT-005**: When a quarter ends, the VP level shall add the heads due that quarter from the year's headcount to the division with the highest stress, as unrated heads, and raise its stress by a tuned onboarding amount.

## Moments

- [x] **VP-MOMENT-001**: When a quarter begins, the VP level shall produce its moments for the quarter, up to a tuned cap, in this order: final evaluations of directors held for one; setting a new director for a division that has none; annual planning in the first quarter of each year; the company priority in the first quarter of each half; cuts when the company asks for them; a leadership dispute; directors at odds; and the all-hands, always last.
- [x] **VP-MOMENT-002**: The VP level shall give each moment a week of the quarter, a day and a time, in order through the quarter, with annual planning in the first week and the all-hands in the last.
- [x] **VP-MOMENT-003**: When the player picks a choice for one of the quarter's open level moments, the VP level shall apply it at once and close the moment; if the moment is not open or does not offer the choice, it shall return an error and leave the state unchanged.
- [x] **VP-MOMENT-004**: When a quarter's end applies, the VP level shall close each level moment left unanswered as letting it wait, and apply what waiting means for its kind: annual planning left unanswered asks for what the plan needs, a company priority left unanswered is spread across the divisions, cuts left unanswered are made across every division, and the all-hands left unanswered is kept short.
- [x] **VP-MOMENT-006**: When a quarter begins and a director leading one of the function's divisions is restless, the VP level shall produce a stay conversation about them in the quarter's first week, after final evaluations and divisions needing a director and before annual planning, whose text says what they want from the job, record that want as known, and offer to give them it, in a label naming that want, or to wish them well.
- [x] **VP-MOMENT-007**: When the player gives a restless director what they want in a stay conversation, the VP level shall raise their motivation by the stay motivation, tagged as serving their want, and their trust by the stay trust, and raise the player's stress by the stay energy; wishing them well, or letting the conversation wait, shall change nothing; and once the director has left, neither answer shall change anything.
- [x] **VP-MOMENT-005**: The situation content tagged for the VP level shall contain no effect that lowers an aggregate team's headcount.

## Annual planning

- [x] **VP-BUDGET-001**: When annual planning is produced, the VP level shall offer to ask for what the plan needs, ask for more than it needs, or give part of the function's share to a named peer's priority, and show the planned headcount for the year.
- [x] **VP-BUDGET-002**: When the player asks for what the plan needs, the VP level shall set the year's headcount to the planned number, raised by a tuned amount with the CEO's trust in the player and the player's reputation, and with the function first raised by a further tuned amount.
- [x] **VP-BUDGET-003**: When the player asks for more than the plan needs, the VP level shall set the year's headcount above the planned number by a tuned amount if the CEO's trust in the player is at least a tuned level and to the planned number otherwise, lower each peer's trust by a tuned amount, and record the ask; when the year's last quarter ends with a company priority of that year failed, it shall lower the CEO's trust and the player's reputation by tuned amounts and add a note to the CEO's memory.
- [x] **VP-BUDGET-004**: When the player gives part of the function's share to a peer's priority, the VP level shall set the year's headcount below the planned number by a tuned amount and raise that peer's and the CEO's trust by tuned amounts.
- [x] **VP-BUDGET-005**: When the year's headcount is set, the VP level shall spread it over the year's four quarters, as evenly as whole heads allow, earliest quarters first.

## The company priority

- [x] **VP-PRIO-001**: When the company priority is produced, the VP level shall name a priority drawn from the level's generator, with a scope, a deadline within the half and a stake, and offer to put one named division on it, spread it across the divisions, or push back.
- [x] **VP-PRIO-002**: When the player puts one division on it, the VP level shall start its project on that division and raise the division's stress by a tuned amount; when the player spreads it, it shall start the project on the division with the lowest stress and slow it by a tuned share; and record the priority with its stake.
- [x] **VP-PRIO-003**: When the player pushes back while a division's stress is in the *strained* band or worse, the VP level shall start no project and leave the CEO's trust as it is; when no division is strained, it shall start no project and lower the CEO's trust by a tuned amount.
- [x] **VP-PRIO-004**: When a quarter ends with the priority's project completed by its deadline, the VP level shall land it: raise the player's reputation and the CEO's trust by its stake; when a quarter ends with it overdue, or its division leaderless at two quarter ends in a row, it shall fail it: lower them by its stake and cancel its project.

## Leadership disputes

- [x] **VP-LT-001**: When no dispute has been produced this quarter, the VP level shall be able to produce a leadership dispute naming a peer, offering to settle it on what the company needs, side with the function, or broker a trade.
- [x] **VP-LT-002**: When the player settles it on what the company needs, the VP level shall raise the CEO's trust by a tuned amount and lower the named peer's trust by a smaller tuned amount; when the player sides with the function, it shall raise each director's trust by a tuned amount and lower each peer's trust by a tuned amount; when the player brokers a trade, it shall raise the named peer's trust by a tuned amount if their trust is at least a tuned level, or with the leadership team first, and lower it otherwise, at a tuned energy cost.

## Cuts

- [x] **VP-CUT-001**: When a quarter begins in the second year of the level or later, and no cut has been asked for yet, the VP level shall ask for cuts with a tuned chance drawn from the level's generator, naming a tuned share of the function's heads.
- [x] **VP-CUT-002**: When the player cuts once, the VP level shall cancel the active projects of the division with the most heads whose work is not the company priority, starting with the one furthest from done, until the division's heads to lose are covered, lose that many of its heads, and lower every division's motivation by a tuned amount.
- [x] **VP-CUT-003**: When the player cuts across every division, the VP level shall lose each division's share of the heads, lower every division's motivation by a tuned amount larger than a single cut's, and slow every active project by a tuned share for a quarter.
- [x] **VP-CUT-004**: When the player cuts in waves, the VP level shall lose a third of the heads across the divisions now and record two more waves, each made at the end of the next two quarters, each lowering every division's motivation and raising its attrition risk by tuned amounts.
- [x] **VP-CUT-005**: The VP level shall record heads lost to cuts apart from attrition, and not count them as regretted attrition or as heads who left in the recap.

## Directors at odds

- [x] **VP-ODDS-001**: When two directors' divisions both have an active project, the VP level shall be able to produce directors at odds, offering to have them settle it together, decide it yourself, or leave it; settling together shall raise both directors' management skill by a tuned amount when both are at least *developing*, deciding shall lower the losing director's trust by a tuned amount, and leaving it shall slow both divisions' projects by a tuned share.

## The all-hands

- [x] **VP-HANDS-001**: When the all-hands is produced, the VP level shall offer to tell the function what is hard and the plan, celebrate the wins, or keep it short, and show what the quarter held: the company priority's progress, cuts made or due, and the divisions as last surveyed.
- [x] **VP-HANDS-002**: When the player tells the function what is hard, the VP level shall raise every division's motivation by a tuned amount if the quarter held hard news (a cut, a failed priority, or a division whose stress is *strained* or worse) and record the function as told.
- [x] **VP-HANDS-003**: When the player celebrates the wins, the VP level shall raise every division's motivation by a tuned amount and record the function as not told; when hard news lands in a later quarter of the same year while the function is recorded as not told, it shall lower every division's motivation by a tuned amount larger than the celebration raised it, and record the function as told.
- [x] **VP-HANDS-004**: When the player keeps it short, the VP level shall change no one's motivation and leave what the function was last told as it is.

## Directors' plans

- [x] **VP-PLAN-001**: When a review period ends, the VP level shall rate each director on their division's delivery and health under them in that period.
- [x] **VP-PLAN-002**: When a director has been rated below *meets* at two period ends in a row, the VP level shall put them on an improvement plan, and when a third low rating would be due, hold it for a final evaluation moment, offering to let them go or give them one more period.
- [x] **VP-PLAN-003**: When a director is let go, the VP level shall remove them and leave their division leaderless; and when a quarter begins with a division that has no director and none on the way, it shall offer a moment to set one: promote from the division, lowering its skill, or hire from outside, leaving it leaderless one more quarter.

## Goals

- [x] **VP-GOAL-001**: When a review period begins, the VP level shall set two or three goals for it from the function's state, drawn from: land the half's company priority, keep regretted attrition to at most a tuned number, keep a named peer's trust at *trusting* or better, and bring a named division out of the *strained* band at the next survey.
- [x] **VP-GOAL-002**: When the player's view is requested, the VP level shall show each goal with its progress.
- [x] **VP-GOAL-003**: When the level is assessed for a review, the VP level shall add each of the period's goals as a measure, scored as achieved or missed.

## Recap

- [x] **VP-RECAP-001**: When a quarter ends, the VP level shall return a recap of what changed (each director whose band changed or who gained a memory note other than from a habit, a new survey's results, heads who left or joined, heads cut, the company priority's progress, landing or failure, and changes in the CEO's and peers' trust) and of the routine (what each habit did, and each goal's progress).
- [x] **VP-RECAP-003**: When asked after an advance which of the function's divisions lost heads in the quarter just played, the VP level shall report each division whose headcount fell while the simulation advanced, with its name, how many heads it lost, and how many of them were rated meets or better.
- [x] **VP-RECAP-002**: When asked after an advance which directors quit in the quarter just played, the VP level shall report each director of its divisions who quit that quarter, with the weeks their motivation had been below the low line and their stress above the high line, whether their trust band was guarded or below, and the note of their most recent remembered history entry, if any.

## Reviews and the end of the level

- [x] **VP-END-001**: The VP level shall advance the simulation thirteen weeks per turn.
- [x] **VP-END-002**: The VP level shall be reviewed every two quarters, at quarters 2, 4, 6, 8, 10 and 12 of the level.
- [x] **VP-END-003**: When the scorecard is requested, the VP level shall report business outcomes (company priorities landed against the priorities whose results came in during the period, and none when no result came in, and projects completed by their deadline), the function's health (regretted attrition, its target agreeing with the regretted-attrition goal's limit, and the divisions' average motivation and stress as last surveyed), and the leadership team's confidence (the CEO's trust in the player and the peers' average trust in the player), each against a tuned target.
- [x] **VP-END-004**: When the level is assessed for a review, the VP level shall report whether promotion is possible, which it is from the third review (quarter 6) on, how many reviews remain until it is, and how many reviews it has left after this one, its last being at quarter 12.
- [x] **VP-END-005**: When the level is assessed for a review, the VP level shall report that it is the level's last review at the sixth review (quarter 12), and not before.
- [x] **VP-END-006**: When the simulation has advanced, if the player's stress has been at or above the line manager level's burnout threshold at the end of two consecutive quarters, then the VP level shall report that the player has burned out.
- [x] **VP-END-007**: The VP level shall be the highest level the run's levels list, so that a promotion at it ends the run as completed.

## Turn loop contract

- [x] **VP-CONTRACT-001**: The VP level shall provide the turn loop's career level contract with a time step of thirteen weeks, its moments' days counted from the quarter's first Monday (week of the quarter × 5 + day), handover choices from the director state, and a take over operation that takes the director state, the simulation and the handover choice and returns the simulation and the VP state, or an error.

## Level state

- [x] **VP-STATE-001**: The VP level shall keep its state (habits, the directors' leniency, the quarter's moments, the year's headcount given and arrived, the company priority, cuts asked for and waves due, what the function was last told and the hard news since, the last survey, plans, goals and the burnout and review counters) serializable as plain data, derived only from the run's seed and commands.
