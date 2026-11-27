# Director Level — Specs

Design: [director-design.md](director-design.md)

The bands a value is shown in are the line manager level's five bands of a 0–100 value; a band shown *better* is the healthier one. A quarter is thirteen weeks, and quarters and reviews count from the start of this level. A *group* is an aggregate team in the simulation core led by a senior manager, a person with the role `manager`. The *executive* and the *peers* are people outside the organization with the roles `executive` and `peer`. *Energy* is the player's stress seen the other way up, as at the earlier levels. Regretted attrition is heads lost whose rating was *meets* or better. A value or rate the specs call *tuned* is set in the level's tuning, by the balance harness and playtesting.

## Handover

- [x] **DIR-HAND-001**: When a senior manager review promotes the player, the director level shall offer a handover choice of who leads the player's group: each active manager leading one of the player's teams, shown with their management skill, trust in the player and want, or an outside hire.
- [x] **DIR-HAND-002**: When the player chooses one of their managers, the director level shall make them the group's senior manager, keeping their management skill, trust and want, and form the group around the team they led.
- [x] **DIR-HAND-003**: When the player chooses an outside hire, the director level shall add a senior manager with management skill in the *capable* band, trust of 50 and a want drawn from the level's generator, and raise the group's stress by a tuned amount after the fold.
- [x] **DIR-HAND-004**: When the handover is applied, the director level shall fold every team in the player's senior manager group into one group led by the new senior manager: the group is the team the chosen manager led, or with an outside hire the group's first team, whose own manager becomes one of its heads; each other team's heads move into it at their ratings, its manager becomes one of its heads, its active projects are reassigned to it, and it is closed.
- [x] **DIR-HAND-005**: When the handover is applied, the director level shall add two groups to the organization, each with a generated senior manager, headcount, health and two projects sized for a group, and add the executive and two peers outside the organization.
- [x] **DIR-HAND-006**: When the handover is applied, the director level shall keep the player's energy, reputation and rating history, and leave every folded person in the state as an aggregated person with their history.
- [x] **DIR-HAND-007**: If a handover choice names neither a manager leading one of the player's teams nor an outside hire, then the director level shall reject it with an error and leave the state unchanged.

## Organization

- [x] **DIR-ORG-001**: The director level shall give each generated senior manager a name, personality, want, management skill, motivation, stress and trust drawn from the level's generator, and a leniency from 0 to 2 rating steps.
- [x] **DIR-ORG-002**: The director level shall give the executive and each peer a name, personality, want, motivation, stress and trust in the player drawn from the level's generator.
- [x] **DIR-ORG-003**: The director level shall give each group at most one senior manager, and treat a group whose senior manager has left as leaderless until a new one is set.

## Visibility

- [x] **DIR-VIS-001**: When the player's view is requested, the director level shall show each senior manager with their name, personality, group, performance level, memory, motivation, stress and management skill as bands, and their want once a staff meeting has been held.
- [x] **DIR-VIS-002**: When the player's view is requested, the director level shall show each group under its senior manager with its current headcount and projects (progress against scope, deadline and schedule status), and its motivation, stress and attrition risk as bands as the last engagement survey measured them, with the survey's quarter, or as they are now in a quarter the listening tour visited it.
- [x] **DIR-VIS-003**: When the player's view is requested, the director level shall show the executive and each peer with their name, personality, role, trust in the player as a band, memory, and their want once known.
- [x] **DIR-VIS-004**: When the player's view is requested, the director level shall show each funded bet with the group carrying it, its project's progress against scope, deadline and schedule status, and what it stakes on landing and on failing.
- [x] **DIR-VIS-005**: When the player's view is requested, the director level shall also give the habits, the quarter's moments with their kind, title, text and choices, the player's energy and reputation as bands with whether they are at the edge, the goals with their progress, and the career summary.
- [x] **DIR-VIS-006**: The director level shall never show a senior manager's leniency as a value, and shall show no team or line manager inside a group except as named in situations and the recap.
- [x] **DIR-VIS-007**: When the player's view is requested, the director level shall mark each senior manager who is restless.

## Habits

- [x] **DIR-HABIT-001**: When the level begins, the director level shall set where your time goes to balanced, the staff meeting to weekly and the listening tour to none.
- [x] **DIR-HABIT-002**: When the player changes a habit, the director level shall apply the new setting from that quarter's end-of-quarter effects and to the moments of later quarters.
- [x] **DIR-HABIT-003**: If a habit change names an unknown habit or option, then the director level shall reject it with an error and leave the level state unchanged.
- [x] **DIR-HABIT-004**: When a quarter ends with time going upward, the director level shall raise the executive's and each peer's trust by a tuned amount and lower each group's motivation by a tuned amount; with time going to the organization, it shall raise each group's motivation and each senior manager's trust by a tuned amount and lower the executive's and each peer's trust by a tuned amount.
- [x] **DIR-HABIT-005**: When a quarter ends, the director level shall hold staff meetings at the habit's cadence, raising each senior manager's trust and revealing their want, at a tuned energy cost that is higher weekly than fortnightly.
- [x] **DIR-HABIT-006**: When a quarter ends under a quarterly listening tour, the director level shall visit the next group in rotation, show its current health for the next quarter, surface one of its problems its senior manager has not raised as a moment the next quarter, and cost the player a tuned amount of energy.

## Groups under their senior managers

- [x] **DIR-DRIFT-001**: When a quarter ends, the director level shall move each group's motivation and stress a tuned share of the way toward the levels its senior manager's management skill sustains, and set its attrition risk from them.
- [x] **DIR-DRIFT-002**: When a quarter ends, the director level shall move each senior manager's motivation by whether their want was served that quarter and their stress toward their group's stress, as tuned.
- [x] **DIR-DRIFT-003**: When the level begins, and when a quarter ends that is the last before a review, the director level shall take the engagement survey: record each group's motivation, stress and attrition risk bands and the quarter.
- [x] **DIR-DRIFT-004**: When a review period ends, the director level shall calibrate each group's ratings without a scene: move its heads to the ratings its delivery corresponds to, then raise them by its senior manager's leniency, using re-rate effects, and lower the group's motivation by a tuned amount for each rating step its ratings sit above what it delivered.

## Moments

- [x] **DIR-MOMENT-001**: When a quarter begins, the director level shall produce its moments for the quarter, up to a tuned cap, in this order: final evaluations of senior managers held for one; setting a new senior manager for a group that has none; headcount planning; strategy bets in the first quarter of each review period; problems surfaced by the listening tour; groups in trouble; a peer's ask; org design; and the quarterly review, always last.
- [x] **DIR-MOMENT-002**: The director level shall give each moment a week of the quarter, a day and a time, in order through the quarter, with headcount planning in the first week and the quarterly review in the last.
- [x] **DIR-MOMENT-003**: When a group's stress or attrition risk is in the *high* band or worse, or one of its projects is behind, the director level shall be able to produce a group in trouble from its senior manager, offering to coach them through it, take the decision yourself, or replace them; coaching shall fix it by a tuned amount and raise their management skill if it is at least *developing*, taking the decision shall fix it by a larger tuned amount at a tuned cost in energy and their trust, and replacing them shall remove them and leave the group leaderless.
- [x] **DIR-MOMENT-004**: When a group's headcount is above a tuned size, or below a tuned size while another group exists, the director level shall be able to produce an org design moment: split the large group, promoting one of its heads or hiring a senior manager for the new group; merge the small group into the smallest other group; or leave it. Splitting and merging shall move heads with the simulation core's head moves, reassign projects, and close the emptied group.
- [x] **DIR-MOMENT-005**: When the player picks a choice for one of the quarter's open level moments, the director level shall apply it at once and close the moment; if the moment is not open or does not offer the choice, it shall return an error and leave the state unchanged.
- [x] **DIR-MOMENT-006**: When a quarter's end applies, the director level shall close each level moment left unanswered as letting it wait, and apply what waiting means for its kind: headcount left unplaced is held back, no bet is funded, and the quarterly review is given straight.
- [x] **DIR-MOMENT-008**: When a quarter begins and a senior manager leading one of the organization's groups is restless, the director level shall produce a stay conversation about them in the quarter's first week, after final evaluations and groups needing a senior manager and before headcount planning, whose text says what they want from the job, record that want as known, and offer to give them it, in a label naming that want, or to wish them well.
- [x] **DIR-MOMENT-009**: When the player gives a restless senior manager what they want in a stay conversation, the director level shall raise their motivation by the stay motivation, tagged as serving their want, and their trust by the stay trust, and raise the player's stress by the stay energy; wishing them well, or letting the conversation wait, shall change nothing; and once the senior manager has left, neither answer shall change anything.
- [x] **DIR-MOMENT-007**: The situation content tagged for the director level shall contain no effect that lowers an aggregate team's headcount.

## Headcount

- [x] **DIR-HEAD-001**: When headcount planning is produced, the director level shall give the player a number of new heads that rises with the executive's trust in the player and the player's reputation, as tuned.
- [x] **DIR-HEAD-002**: When the player places headcount, the director level shall add each head placed in a group to it as an unrated head and raise its stress by a tuned onboarding amount, add each head placed behind a funded bet to its group and speed its project by a tuned amount, and count the rest as held back.
- [x] **DIR-HEAD-003**: When headcount is held back, the director level shall lower the executive's trust by a tuned amount per head held back.
- [x] **DIR-HEAD-004**: If a placement places more heads than were given, names a group not in the organization or a bet not funded, or gives a negative count, then the director level shall reject it with an error and leave the state unchanged.

## Strategy bets

- [x] **DIR-BET-001**: When strategy bets are produced, the director level shall offer two or three bets drawn from the level's generator, each with a scope, a deadline, a stake on landing and a stake on failing, and the peer its work touches.
- [x] **DIR-BET-002**: When the player funds bets, the director level shall start a project for each, up to two, on the group the player names, and record the bet with its stakes; funding none shall be a valid choice.
- [x] **DIR-BET-003**: When a quarter ends with a funded bet's project completed by its deadline, the director level shall land the bet: raise the player's reputation and the executive's trust by its landing stake; when a quarter ends with it overdue by a tuned number of weeks, or its group merged away or leaderless at two quarter ends in a row, it shall fail the bet: lower them by its failing stake and cancel its project.
- [x] **DIR-BET-004**: When a quarter ends, the director level shall slow a funded bet's project when its group's stress is in the *strained* band or worse, and speed it when the peer its work touches trusts the player at least a tuned amount, as tuned.
- [x] **DIR-BET-005**: If a funding names more than two bets, a bet not offered, or a group not in the organization, then the director level shall reject it with an error and leave the state unchanged.

## The quarterly review

- [x] **DIR-QBR-001**: When the quarterly review is presented, the director level shall offer to tell it straight, lead with the wins, or promise more next quarter, and show what the quarter held: projects and bets on schedule and in trouble, and the groups as last seen.
- [x] **DIR-QBR-002**: When the player tells it straight, the director level shall raise the executive's trust by a tuned amount and lower the player's reputation by a tuned amount for each project or bet in trouble.
- [x] **DIR-QBR-003**: When the player leads with the wins, the director level shall raise the player's reputation by a tuned amount and record each project or bet in trouble as left out; when the next quarter ends with a left-out project or bet still in trouble or failed, it shall lower the executive's trust and the player's reputation by tuned amounts larger than telling it straight would have cost, and clear it.
- [x] **DIR-QBR-004**: When the player promises more, the director level shall raise the player's reputation by a tuned amount and multiply the stakes of every funded bet by a tuned factor.

## Peers

- [x] **DIR-PEER-001**: When a peer's trust allows an ask, and no peer has asked in the quarter before, the director level shall be able to produce a peer's ask, offering to agree, negotiate a trade, or refuse; agreeing shall raise one group's stress and the peer's trust by tuned amounts, negotiating shall raise the peer's trust by a tuned amount if their trust is at least a tuned level and lower it otherwise, and refusing shall lower it by a tuned amount.
- [x] **DIR-PEER-002**: When a quarter ends with a peer's trust in the player below a tuned level, the director level shall lower the executive's trust by a tuned amount and add a note to the peer's and the executive's memories, at most once a review period per peer.

## Senior managers' plans

- [x] **DIR-PLAN-001**: When a review period ends, the director level shall rate each senior manager on their group's delivery and health under them in that period.
- [x] **DIR-PLAN-002**: When a senior manager has been rated below *meets* at two period ends in a row, the director level shall put them on an improvement plan, and when a third low rating would be due, hold it for a final evaluation moment, offering to let them go or give them one more period.
- [x] **DIR-PLAN-003**: When a senior manager is let go or replaced, the director level shall remove them and leave their group leaderless; and when a quarter begins with a group that has no senior manager and none on the way, it shall offer a moment to set one: promote from the group, lowering its skill, or hire from outside, leaving it leaderless one more quarter.

## Goals

- [x] **DIR-GOAL-001**: When a review period begins, the director level shall set two or three goals for it from the organization's state, drawn from: land a named funded bet, keep regretted attrition to at most a tuned number, bring a named group out of the *strained* band at the next survey, and keep a named peer's trust at *trusting* or better.
- [x] **DIR-GOAL-002**: When the player's view is requested, the director level shall show each goal with its progress.
- [x] **DIR-GOAL-003**: When the level is assessed for a review, the director level shall add each of the period's goals as a measure, scored as achieved or missed.

## Recap

- [x] **DIR-RECAP-001**: When a quarter ends, the director level shall return a recap of what changed (each senior manager whose band changed or who gained a memory note other than from a habit, a new survey's results, heads who left or joined, bets that landed, failed or slipped, and changes in the executive's and peers' trust) and of the routine (what each habit did, and each goal's progress).
- [x] **DIR-RECAP-002**: When a quarter ends, the director level shall report, apart from heads who left or joined, each group split or merged that quarter: where the heads went and how many, and shall not count those heads as having left or joined.
- [x] **DIR-RECAP-003**: When asked after an advance which senior managers quit in the quarter just played, the director level shall report each senior manager of its groups who quit that quarter, with the weeks their motivation had been below the low line and their stress above the high line, whether their trust band was guarded or below, and the note of their most recent remembered history entry, if any.

## Reviews and the end of the level

- [x] **DIR-END-001**: The director level shall advance the simulation thirteen weeks per turn.
- [x] **DIR-END-002**: The director level shall be reviewed every two quarters, at quarters 2, 4, 6, 8, 10 and 12 of the level.
- [x] **DIR-END-003**: When the scorecard is requested, the director level shall report strategic outcomes (bets landed against the bets whose results came in during the period, and none when no result came in, and projects completed by their deadline), retention and health (regretted attrition, its target agreeing with the regretted-attrition goal's limit, so that a period the goal calls missed is below target, and the groups' average motivation and stress as last surveyed), and the executive's confidence (the executive's trust in the player), each against a tuned target.
- [x] **DIR-END-004**: When the level is assessed for a review, the director level shall report whether promotion is possible, which it is from the third review (quarter 6) on, how many reviews remain until it is, and how many reviews it has left after this one, its last being at quarter 12.
- [x] **DIR-END-005**: When the level is assessed for a review, the director level shall report that it is the level's last review at the sixth review (quarter 12), and not before.
- [x] **DIR-END-006**: When the simulation has advanced, if the player's stress has been at or above the line manager level's burnout threshold at the end of two consecutive quarters, then the director level shall report that the player has burned out.

## Turn loop contract

- [x] **DIR-CONTRACT-001**: The director level shall provide the turn loop's career level contract with a time step of thirteen weeks, its moments' days counted from the quarter's first Monday (week of the quarter × 5 + day), handover choices from the senior manager state, and a take over operation that takes the senior manager state, the simulation and the handover choice and returns the simulation and the director state, or an error.

## Level state

- [x] **DIR-STATE-001**: The director level shall keep its state (habits, the senior managers' leniency, the quarter's moments, funded bets, headcount given and placed, what quarterly reviews left out, the last survey, the listening tour's rotation, plans, goals and the burnout and review counters) serializable as plain data, derived only from the run's seed and commands.
