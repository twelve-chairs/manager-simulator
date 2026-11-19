# Line Manager Level — Specs

Design: [line-manager-design.md](line-manager-design.md)

## Starting organization

- [x] **LINE-ORG-001**: When a run starts, the line manager level shall generate from the seed one team led by the player with five active engineers of varied skill, motivation, stress and wants, and two active projects on that team, one on schedule and one at risk.
- [x] **LINE-ORG-002**: The line manager level shall take the names of generated people and projects from its fixed list of fictional names, and shall not give two people in a run the same name.
- [x] **LINE-ORG-003**: When runs are started from the same seed, the line manager level shall generate identical simulation and level states.

## Level parameters

- [x] **LINE-WEEK-001**: The line manager level shall declare the level id `line-manager`, a time step of 1 week, a limit of 2 situations per week, and a review every 13 weeks.

## Visibility

- [x] **LINE-VIS-001**: When the player's view is requested, the line manager level shall show each active engineer on the player's team with their name, role, tenure and performance level.
- [x] **LINE-VIS-002**: The line manager level shall show a person's motivation, stress and skill only as bands, never as numbers.
- [x] **LINE-VIS-003**: The line manager level shall show a person's want as unknown until a 1:1 with them has run, and from then on as their want.
- [x] **LINE-VIS-004**: The line manager level shall not show a person's trust.
- [x] **LINE-VIS-005**: The line manager level shall show each of the team's active projects with its progress, deadline and whether it is on schedule, behind or overdue, and its risk and tech debt only as bands.
- [x] **LINE-VIS-006**: The line manager level shall show the player's reputation and stress only as bands.
- [x] **LINE-VIS-007**: The line manager level shall show the calendar, the open vacancies with their interview counts, and each inbox demand with its type, subject, hours and last week.
- [x] **LINE-VIS-008**: The line manager level shall show a demand's difficulty only as a band on the same scale as skill.
- [x] **LINE-VIS-010**: When the player's view is requested with the week's plan, the line manager level shall show the hours of the calendar entries that run this week with valid targets plus the hours of the demands the plan handles or accepts, and the overtime those hours imply.
- [x] **LINE-VIS-009**: The line manager level shall map every banded value to the same scale of bands over 0–100.

## Calendar

- [x] **LINE-CAL-001**: When a run starts, the line manager level shall create a calendar holding the team's ceremonies every week and a 1:1 with each engineer every other week, with alternate engineers in id order starting in the first and the second week.
- [x] **LINE-CAL-002**: The line manager level shall keep recurring calendar entries from week to week until the player removes them, and remove a one-off entry after the week it runs.
- [x] **LINE-CAL-003**: The line manager level shall run an every-other-week entry in its start week and in every second week after, taking the week it was added as its start week unless the player gives the following week.
- [x] **LINE-CAL-004**: If an added calendar entry names an action not in the catalogue, a target of a kind the action does not take, or a recurring cadence for a one-off action, then the line manager level shall reject the edit with an error naming the entry and leave the level state unchanged.
- [x] **LINE-CAL-009**: When the player schedules any action for this week only, the line manager level shall accept it.
- [x] **LINE-CAL-005**: When a week is committed, the line manager level shall not run an entry whose target is no longer valid (a person no longer active on the team, a project no longer active, a vacancy no longer open), shall charge no hours for it, shall remove it from the calendar, and shall report it with the reason.
- [x] **LINE-CAL-006**: When a week is committed, the line manager level shall charge the hours of every calendar entry that runs that week and of every demand the player handles or accepts.
- [x] **LINE-CAL-007**: If the hours charged for a week exceed the weekly budget plus the overtime cap, then the line manager level shall reject the commit with an error and leave both states unchanged.
- [x] **LINE-CAL-008**: When the hours charged for a week exceed the weekly budget, the line manager level shall raise the player's stress by the overtime amount for each hour over the budget.

## Actions

- [x] **LINE-ACT-001**: When a week is committed, the line manager level shall submit the effects of every calendar entry that runs as one batch to the simulation core, each effect carrying the entry's action id as its cause.
- [x] **LINE-ACT-002**: When a 1:1 runs, the line manager level shall raise the person's trust and motivation and record the person's current want as the want the player has learned, with the week.
- [x] **LINE-ACT-003**: When coaching runs, the line manager level shall raise the person's skill, tagged as serving a want for growth.
- [x] **LINE-ACT-004**: When recognition runs, the line manager level shall raise the person's motivation, tagged as serving a want for recognition.
- [x] **LINE-ACT-005**: When training runs, the line manager level shall raise the person's skill and stress, tagged as serving a want for growth.
- [x] **LINE-ACT-006**: When a week is committed without ceremonies running, the line manager level shall raise the risk of each of the team's active projects, with a level rule as the cause.
- [x] **LINE-ACT-007**: When project planning runs, the line manager level shall lower the project's risk.
- [x] **LINE-ACT-008**: When scope negotiation runs, the line manager level shall reduce the project's scope and lower the player's reputation.
- [x] **LINE-ACT-009**: When a team event runs, the line manager level shall raise the motivation and lower the stress of each active engineer on the team.
- [x] **LINE-ACT-010**: When recovery time runs, the line manager level shall lower the player's stress.
- [x] **LINE-ACT-011**: When an interview runs, the line manager level shall add one interview to the vacancy it targets.
- [x] **LINE-ACT-012**: When a 1:1, coaching, recognition or training runs, or a demand is delegated, the line manager level shall add an entry to the person's history with that action's id as its cause.
- [x] **LINE-ACT-014**: The line manager level shall use only action ids listed in the player action catalogue, including those for delegating and for accepting or declining work intake.
- [x] **LINE-ACT-013**: When ceremonies run, the line manager level shall raise the motivation of each active engineer on the team, tagged as serving a want for stability.

## Inbox

- [x] **LINE-INBOX-001**: When demands arrive, the line manager level shall add demands whose number and types depend on the team's active projects, their risk and tech debt, and its engineers, drawing all randomness from the level's own seeded generator and leaving the simulation's generator state unchanged.
- [x] **LINE-INBOX-002**: When demands arrive while the team has fewer than two active projects and no work intake demand is in the inbox, the line manager level shall add a work intake demand.
- [x] **LINE-INBOX-003**: The line manager level shall give each demand a unique id, a type, a subject, an hour cost, a difficulty, and a last week equal to its arrival week plus its type's expiry weeks: 0 for an on-call escalation, 1 for an approval, and 2 for every other type.
- [x] **LINE-INBOX-004**: When a week is committed with a demand handled, the line manager level shall charge its hours and remove it from the inbox without its consequence.
- [x] **LINE-INBOX-005**: When a week is committed with a demand delegated to an engineer, the line manager level shall charge the player no hours, raise the delegate's stress tagged as serving wants for growth and autonomy, and remove the demand from the inbox.
- [x] **LINE-INBOX-006**: When a delegated demand's difficulty is above the delegate's skill, the line manager level shall apply the reduced version of the demand's consequence and raise the delegate's skill.
- [x] **LINE-INBOX-007**: When several demands are delegated to one engineer in a week, the line manager level shall raise that engineer's stress once for each.
- [x] **LINE-INBOX-008**: If a decision delegates a demand to someone who is not a person in the simulation, to the person who made the request, or delegates a work intake demand, then the line manager level shall reject the commit with an error and leave both states unchanged.
- [x] **LINE-INBOX-014**: When a week is committed with a demand delegated to a person who is no longer an active engineer on the team, the line manager level shall leave the demand in the inbox undecided and report it with the reason.
- [x] **LINE-INBOX-015**: When a week is committed with a demand left undecided under LINE-INBOX-014 whose last week is the current week, the line manager level shall move its last week to the following week instead of expiring it.
- [x] **LINE-INBOX-009**: When a week is committed, the line manager level shall remove each demand left undecided whose last week is the current week, other than one covered by LINE-INBOX-015, and apply its consequence with a level rule as the cause.
- [x] **LINE-INBOX-010**: When a demand's subject is no longer valid (a project no longer active, a requester no longer active on the team), the line manager level shall remove it from the inbox without its consequence.
- [x] **LINE-INBOX-016**: When a week is committed with a decision for a demand whose subject is no longer valid, the line manager level shall charge no hours for it, apply none of its effects, and report the decision as void with the reason.
- [x] **LINE-INBOX-011**: When a week is committed with a work intake demand accepted, the line manager level shall charge its hours and start a new project on the team through the simulation core, named from the level's list.
- [x] **LINE-INBOX-012**: When a week is committed with a work intake demand declined, the line manager level shall lower the player's reputation by less than the work intake's expiry consequence, and remove it from the inbox.
- [x] **LINE-INBOX-013**: If a decision names a demand not in the inbox, or a decision the demand's type does not allow, then the line manager level shall reject the commit with an error and leave both states unchanged.

## Hiring

- [x] **LINE-HIRE-001**: The line manager level shall set the team's target headcount to its number of engineers when the run starts.
- [x] **LINE-HIRE-002**: When the simulation has advanced, and when a week begins to commit, if the team's active engineers plus its open vacancies are below its target headcount, the line manager level shall open vacancies until they reach it.
- [x] **LINE-HIRE-003**: When a vacancy reaches the required number of interviews, the line manager level shall hire a generated engineer onto the team through the simulation core and close the vacancy.

## Reviews and the end of the level

- [x] **LINE-END-001**: When the scorecard is requested, the line manager level shall report the number of the team's projects completed by their deadline in the 13 weeks before the scorecard's week, and, when the team has active projects, the share of them neither overdue nor behind schedule, or no share when it has none.
- [x] **LINE-END-002**: When the scorecard is requested, the line manager level shall report the number of engineers who quit the team in the 13 weeks before the scorecard's week, and how many of them were rated meets or above.
- [x] **LINE-END-003**: When the scorecard is requested, the line manager level shall report the team's average motivation and average stress, and the share of its active engineers who have had a 1:1 in the four weeks before the scorecard's week.
- [x] **LINE-END-004**: When the level is assessed for a review, the line manager level shall report whether promotion is possible, which it is from week 52 (the fourth review) on.
- [x] **LINE-END-007**: When the level is assessed for a review, the line manager level shall report as measures the projects completed on time and the on-schedule share (higher is better), the quits rated meets or above (lower is better), the average motivation (higher is better), the average stress (lower is better) and the 1:1 share (higher is better), each with the target and tolerance its tuning sets, leaving out the on-schedule share when the team has no active projects.
- [x] **LINE-END-006**: When the simulation has advanced, the line manager level shall record the week in which each of the team's projects became completed.
- [x] **LINE-END-005**: When the simulation has advanced, if the player's stress has been at or above the burnout threshold for four consecutive weeks, then the line manager level shall report that the player has burned out.

## Turn loop contract

- [x] **LINE-CONTRACT-001**: The line manager level shall provide the turn loop's career level contract, beginning a week by having demands arrive, applying calendar edits to the level state at once, holding demand decisions in the week's plan, and committing the week with the decisions in the plan.
- [x] **LINE-CONTRACT-002**: When a planning command decides a demand, the line manager level shall reject the decision with an error and leave the plan unchanged if the demand is not in the inbox, the decision does not suit its type, or a delegate is not a person or is the requester.
- [x] **LINE-CONTRACT-003**: When a planning command clears a demand's decision, the line manager level shall remove it from the plan, leaving the demand undecided.

## Level state

- [x] **LINE-STATE-001**: The line manager level shall represent its state as plain data that survives serialization to JSON and back without change.
- [x] **LINE-STATE-002**: The line manager level shall return a new level state from every operation and leave its input states unchanged.
- [x] **LINE-STATE-003**: When the same operations are applied with the same inputs to states from the same seed, the line manager level shall produce identical results.
