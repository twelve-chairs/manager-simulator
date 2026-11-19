# Simulation Core — Specs

Design: [simulation-core-design.md](simulation-core-design.md)

## State and determinism

- [x] **SIM-STATE-001**: The simulation core shall represent its state as plain data that survives serialization to JSON and back without change.
- [x] **SIM-STATE-002**: The simulation core shall return a new state from every operation and leave the input state unchanged.
- [x] **SIM-STATE-003**: When the same operations are applied with the same inputs to two states created from the same seed and starting organization, the simulation core shall produce identical states and identical change logs.
- [x] **SIM-STATE-004**: The simulation core shall draw all randomness from a seeded generator whose state is stored in the simulation state.
- [x] **SIM-STATE-005**: When the simulation core iterates over people, teams or projects, it shall process them in ascending id order.
- [x] **SIM-STATE-006**: When an effect or rule would set a 0–100 bounded value below 0 or above 100, the simulation core shall clamp it to 0 or 100 respectively.
- [x] **SIM-STATE-007**: The simulation core shall model only the player's own organization, treating every team in the state as under the player.

## Game time

- [x] **SIM-TIME-001**: When a simulation is created, the simulation core shall set the game week to 0.
- [x] **SIM-TIME-002**: When the simulation is advanced by a step of N weeks, the simulation core shall increase the game week by N.
- [x] **SIM-TIME-003**: The simulation core shall measure every duration it tracks (tenure, time a want has gone unserved, time motivation has been low, time stress has been high) in game weeks.

## Effects

- [x] **SIM-EFFECT-001**: If any effect in a submitted batch does not carry a cause identifying a player action, a situation choice, or a simulation rule, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-002**: When a batch of effects is submitted, the simulation core shall validate each effect against the state as left by the effects before it in the batch, and commit the batch only if every effect is valid.
- [x] **SIM-EFFECT-003**: If any effect in a submitted batch targets a person, team or project that does not exist, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-004**: If any effect in a submitted batch targets a departed person, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-005**: If any effect in a submitted batch targets an aggregated person, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-006**: If any effect in a submitted batch carries a history note and targets anything other than a person, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-007**: When a valid batch of effects is submitted, the simulation core shall apply the effects in the order given, clamping each value effect as it is applied.
- [x] **SIM-EFFECT-008**: When a value effect tagged as serving a person's want raises that person's motivation, the simulation core shall apply a larger increase than the same effect without the tag.
- [x] **SIM-EFFECT-009**: When a value effect tagged as working against a person's want lowers that person's motivation, the simulation core shall apply a larger decrease than the same effect without the tag.
- [x] **SIM-EFFECT-010**: When a value effect caused by a player action or a situation choice raises a person's motivation, the simulation core shall apply a smaller increase the lower that person's trust is.
- [x] **SIM-EFFECT-011**: When a hire effect naming a detailed team is applied, the simulation core shall add an active person to that team with the current game week as their join week.
- [x] **SIM-EFFECT-018**: When a hire effect naming an aggregate team is applied, the simulation core shall increase that team's headcount by one.
- [x] **SIM-EFFECT-012**: When a remove effect is applied, the simulation core shall mark the person departed with the current game week and the given reason (`quit`, `fired` or `transferred`), and keep them in the state.
- [x] **SIM-EFFECT-013**: When a move effect naming a detailed team is applied, the simulation core shall make the person a member of that team.
- [x] **SIM-EFFECT-020**: When a move effect naming an aggregate team is applied, the simulation core shall mark the person `aggregated` and increase that team's headcount by one.
- [x] **SIM-EFFECT-021**: When a move effect is applied to a person who leads a team, the simulation core shall make their former team leaderless.
- [x] **SIM-EFFECT-022**: If a set-leader effect names a team that already has a leader, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-023**: If a set-leader effect names a person who already leads a team, then the simulation core shall reject the whole batch with an error naming that effect and leave the state unchanged.
- [x] **SIM-EFFECT-014**: When a set-leader effect is applied, the simulation core shall make the named person or the player the leader of the named team.
- [x] **SIM-EFFECT-015**: When a start-project effect is applied, the simulation core shall add an active project with zero progress and the current game week as its start week to the named team.
- [x] **SIM-EFFECT-016**: When a reassign-project effect is applied, the simulation core shall change the project's team to the named team.
- [x] **SIM-EFFECT-017**: When a cancel-project effect is applied, the simulation core shall set the project's status to `cancelled`.
- [x] **SIM-EFFECT-019**: When an effect tagged as serving a person's want is applied to that person, the simulation core shall record the current game week as the week that person's want was last served, whatever field the effect changes.
- [x] **SIM-EFFECT-024**: When an effect carrying want tags targets anything other than a person, the simulation core shall apply the effect and ignore its want tags.

## Change log and history

- [x] **SIM-LOG-001**: When an operation changes the state, the simulation core shall return a change log entry for each change, carrying its cause, its target, and the value before and after.
- [x] **SIM-LOG-002**: When an advance applies a rule, the simulation core shall record each resulting change in the change log with that rule's id as the cause.
- [x] **SIM-LOG-003**: The simulation core shall not store change logs in the simulation state.
- [x] **SIM-LOG-004**: When a value effect with a history note is applied to a person, the simulation core shall append an entry to that person's history carrying the game week, the cause and the note.

## Teams

- [x] **SIM-TEAM-001**: When a team is converted to aggregate form, the simulation core shall replace its member list with a headcount, skill, motivation, stress and attrition risk computed from its active members.
- [x] **SIM-TEAM-004**: When a team is converted to aggregate form, the simulation core shall mark its active members `aggregated` and leave its leader active.
- [x] **SIM-TEAM-002**: The simulation core shall not convert an aggregate team back into individual people.
- [x] **SIM-TEAM-003**: When a person who leads a team departs, the simulation core shall make that team leaderless.
- [x] **SIM-TEAM-005**: When an effect or rule changes the skill, motivation or stress of a detailed team, the simulation core shall apply the change to each of the team's active members.

## Advancing time

- [x] **SIM-ADV-001**: When the simulation is advanced, the simulation core shall apply its rules in this order: project work, setbacks, stress, want drift, departure, player standing, game time.
- [x] **SIM-ADV-002**: When the simulation is advanced, the simulation core shall increase each active project's progress by an amount that rises with its team's headcount, skill and motivation and falls with its team's stress and the project's tech debt.
- [x] **SIM-ADV-003**: When an active project's progress reaches its scope during an advance, the simulation core shall set the project's status to `completed`.
- [x] **SIM-ADV-004**: When the simulation is advanced, the simulation core shall subject each active project to a setback with a probability that rises with its risk and tech debt.
- [x] **SIM-ADV-005**: When a project suffers a setback, the simulation core shall reduce its progress and raise its team's stress.
- [x] **SIM-ADV-006**: While a team has an overdue or behind-schedule project, the simulation core shall raise that team's stress on each advance.
- [x] **SIM-ADV-007**: While a team is leaderless, the simulation core shall raise that team's stress on each advance.
- [x] **SIM-ADV-008**: While a team has no overdue or behind-schedule projects and has a leader, the simulation core shall lower that team's stress on each advance.
- [x] **SIM-ADV-009**: While more weeks than the drift threshold have passed since a person's want was last served, the simulation core shall lower that person's motivation on each advance.
- [x] **SIM-ADV-010**: While no more weeks than the drift threshold have passed since a person's want was last served, the simulation core shall raise that person's motivation slowly on each advance.
- [x] **SIM-ADV-011**: When the simulation is advanced, the simulation core shall give each active person a chance to quit that rises with how long their motivation has been low, how long their stress has been high, and how low their trust is.
- [x] **SIM-ADV-012**: When the simulation is advanced, the simulation core shall reduce each aggregate team's headcount with a probability that rises with its attrition risk.
- [x] **SIM-ADV-013**: When the simulation is advanced, the simulation core shall move the player's reputation up when the projects they are responsible for are on track and down when they are overdue or behind.
- [x] **SIM-ADV-014**: When the simulation is advanced, the simulation core shall raise the player's stress with the number of teams under them that are leaderless or have overdue or behind-schedule projects, and lower it when there are none.
- [x] **SIM-ADV-015**: When the simulation is advanced by a step of N weeks, the simulation core shall scale each rule's magnitude with N.

## Queries

- [x] **SIM-QUERY-004**: The simulation core shall report an active project as overdue when the current game week is past its deadline week.
- [x] **SIM-QUERY-005**: The simulation core shall report an active, non-overdue project as behind schedule when its progress divided by its scope is less than the weeks elapsed since its start week divided by the weeks from its start week to its deadline week.

- [x] **SIM-QUERY-001**: The simulation core shall provide read-only queries for people matching a condition, a person's history, team summaries, overdue projects, behind-schedule projects, leaderless teams, and the player's standing.
- [x] **SIM-QUERY-002**: When a team summary is queried for a detailed team, the simulation core shall compute it from the team's active members.
- [x] **SIM-QUERY-003**: The simulation core shall report the player's reputation and stress without deciding burnout, dismissal or promotion.
