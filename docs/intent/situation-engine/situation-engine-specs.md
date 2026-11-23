# Situation Engine — Specs

Design: [situation-engine-design.md](situation-engine-design.md)

## Content and validation

- [x] **SIT-CONTENT-001**: When the content compiler runs, it shall read every situation file under `content/situations/`, take its YAML front matter as the situation's structure and its Markdown body as the situation's text, and write one JSON content bundle.
- [x] **SIT-CONTENT-002**: If any situation file is invalid, then the content compiler shall fail with an error naming the file and the invalid field, and write no bundle.
- [x] **SIT-CONTENT-003**: When a content bundle is loaded, the situation engine shall validate every situation in it with the same validator the compiler uses, return the valid situations, and return an error naming each invalid situation and the reason.
- [x] **SIT-CONTENT-004**: The situation engine shall treat a situation as invalid if a required field is missing, a field has the wrong type, or it has a field the format does not define.
- [x] **SIT-CONTENT-005**: The situation engine shall treat a situation as invalid if its id duplicates another situation's id in the same bundle.
- [x] **SIT-CONTENT-006**: The situation engine shall treat a situation as invalid if a condition uses an unknown form, operator, subject or property, or a property the subject's kind does not have.
- [x] **SIT-CONTENT-007**: The situation engine shall treat a situation as invalid if its `when` refers to a role, or a role's `where` refers to a role bound after it.
- [x] **SIT-CONTENT-008**: The situation engine shall treat a situation as invalid if a placeholder in its text names an unknown role or property.
- [x] **SIT-CONTENT-009**: The situation engine shall treat a situation as invalid if an effect is malformed, is a hire or start-project effect, or names a role whose kind does not fit the effect's field.
- [x] **SIT-CONTENT-010**: The situation engine shall treat a situation as invalid if it has no choices, a choice has no outcomes, a choice's last outcome has a `when`, or any earlier outcome lacks one.
- [x] **SIT-CONTENT-011**: When a content bundle is not valid JSON or not a list of situations, the situation engine shall return no situations and an error, without throwing.
- [x] **SIT-CONTENT-013**: The situation engine shall treat a situation as invalid if its `weight` is not above 0, its `cooldownWeeks` is negative, a comparison's literal does not match the property's type, `in` is given something other than a list, `ratings.<level>` names an unknown level, or a `history` condition names anything but a person role.
- [x] **SIT-CONTENT-014**: The situation engine shall treat a situation as invalid if an effect rates the player.
- [x] **SIT-CONTENT-016**: The situation engine shall treat a situation as invalid if it compares an id-valued property (`id`, `team`, `ledTeam`, `leader`) with a literal rather than a path.
- [x] **SIT-CONTENT-017**: The situation engine shall treat a situation as invalid if a role that is not a team role has a `form`, or a team role's `form` is not `detailed` or `aggregate`.
- [x] **SIT-CONTENT-018**: The situation engine shall treat a situation as invalid if a `reRate` effect, or a `value` effect changing `headcount` or `attritionRisk`, names a team role whose `form` is not `aggregate`.
- [x] **SIT-CONTENT-019**: The situation engine shall treat a situation as invalid if two of its choices share an id, or two outcomes of one choice share an id.
- [x] **SIT-CONTENT-020**: The situation engine shall treat a situation as invalid if a `history` condition gives an `action` together with a `situation` or `choice`.
- [x] **SIT-CONTENT-021**: The situation engine shall treat a situation as invalid if a `history` condition's `action` is not in the player action catalogue.
- [x] **SIT-CONTENT-022**: The situation engine shall treat a situation as invalid if a role is named `player`, `week`, `review` or `it`.
- [x] **SIT-CONTENT-023**: The situation engine shall treat a situation as invalid if a condition in it nests more than 32 levels deep, counting each `all`, `any`, `not` and `count` as a level, and shall report it as invalid without throwing however deep the nesting.
- [x] **SIT-CONTENT-024**: The situation engine shall treat a situation as invalid if its `day` is not one of `monday` to `friday`, or its `time` is not `morning`, `afternoon` or `night`.
- [x] **SIT-CONTENT-025**: The situation engine shall treat a situation as invalid if a condition compares `personality` with a literal, or gives `in` a list item, that is not in the personality catalogue.
- [x] **SIT-CONTENT-026**: The situation engine shall treat a situation as invalid if its `waitDebrief` is present and is not a non-empty string, or contains a placeholder.
- [x] **SIT-CONTENT-027**: The situation engine shall treat a situation as invalid if an effect's `historyNote` contains a placeholder.
- [x] **SIT-CONTENT-015**: The content compiler shall parse YAML with its safe schema, rejecting custom types and aliases.
- [x] **SIT-CONTENT-012**: The situation engine shall never execute content: no part of a situation is evaluated as code or used to build a regular expression.

## Conditions

- [x] **SIT-COND-001**: When evaluating `all`, `any` or `not`, the situation engine shall hold the condition when every, at least one, or not the inner condition holds, respectively; an empty `all` holds and an empty `any` does not.
- [x] **SIT-COND-002**: When evaluating a comparison, the situation engine shall resolve the path against the bound roles, the player or the game week, and compare it to the operand with `below`, `atMost`, `above`, `atLeast`, `is`, `isNot` or `in`.
- [x] **SIT-COND-003**: When a comparison's operand is a path, the situation engine shall compare against that path's value.
- [x] **SIT-COND-004**: When comparing ratings with `below`, `atMost`, `above` or `atLeast`, the situation engine shall order them `unrated`, `below`, `partial`, `meets`, `exceeds`, `outstanding`.
- [x] **SIT-COND-005**: When a path has no value, the situation engine shall treat every comparison with it as not holding, except `isNot`, which holds.
- [x] **SIT-COND-006**: The situation engine shall provide the person, team, project and player properties listed in the design, derived from the simulation core's state and queries.
- [x] **SIT-COND-007**: When evaluating a `count` condition, the situation engine shall count the active people, existing teams or active projects for which `where` holds with the candidate bound as `it`, and compare the count to the operand.
- [x] **SIT-COND-011**: When evaluating a `count` nested inside another `count`, the situation engine shall bind `it` to the inner candidate, keeping the situation's roles visible.
- [x] **SIT-COND-008**: When evaluating a `history` condition, the situation engine shall count the person's history entries matching the given situation, choice and any of the ratings listed in `rating`, within the last `withinWeeks` weeks (all of history when it is absent), and compare the count to the operand.
- [x] **SIT-COND-013**: When a `history` condition gives an `action`, the situation engine shall count only the person's history entries caused by that player action.
- [x] **SIT-COND-009**: When evaluating a `presented` condition, the situation engine shall count the times that situation was presented within the last `withinWeeks` weeks (ever, when it is absent), and compare the count to the operand, including the current presentation when evaluated inside a presented situation's choices or outcomes.
- [x] **SIT-COND-012**: The situation engine shall give a person, team or project its id as its `id` property, a team led by a person that person's id as its `leader`, and a team led by the player or by no one no `leader` value.
- [x] **SIT-COND-014**: When selection or resolution is given the weeks until the next review, the situation engine shall give `review.weeksAway` that number, and no value when it is not given.
- [x] **SIT-COND-015**: The situation engine shall give a person their personality as their `personality` property, and no value when they have none.
- [x] **SIT-COND-016**: The situation engine shall accept `engineer`, `manager`, `executive` and `peer` as values of a person's `role`, and treat a situation comparing `role` with any other literal as invalid.
- [x] **SIT-COND-010**: The situation engine shall evaluate conditions without changing the simulation or engine state.

## Selecting situations

- [x] **SIT-SEL-012**: When situations are selected while presentations from an earlier selection are still open, the situation engine shall close each as ignored and record a debrief record with the game week, situation id and bindings, the status `ignored`, and no choice, aftermath or debrief text.
- [x] **SIT-SEL-001**: When situations are selected for a career level, the situation engine shall consider only situations tagged with that level.
- [x] **SIT-SEL-002**: When situations are selected, the situation engine shall skip a situation marked `once` that has been presented, and a situation presented fewer than `cooldownWeeks` weeks ago.
- [x] **SIT-SEL-003**: When situations are selected, the situation engine shall skip a situation whose `when` does not hold.
- [x] **SIT-SEL-004**: When binding a situation's roles, the situation engine shall bind them in order, each to an active person, existing team or active project of the role's kind for which its `where` holds, trying candidates in an order shuffled by the engine's generator, and never binding the same entity to two roles of one situation.
- [x] **SIT-SEL-014**: When binding a team role that has a `form`, the situation engine shall consider only teams of that form.
- [x] **SIT-SEL-005**: When a role has no candidate that lets every later role bind, the situation engine shall backtrack to the previous role's next candidate, and skip the situation when no complete binding exists.
- [x] **SIT-SEL-013**: When binding leaves a situation with no choice whose `availableIf` holds, the situation engine shall skip it.
- [x] **SIT-SEL-006**: When selecting from eligible situations, the situation engine shall draw `urgent` situations before any `normal` one, drawing within each group at random with probability proportional to `weight`, until the limit is reached.
- [x] **SIT-SEL-007**: The situation engine shall select at most the limit given for the turn, and none when the limit is 0 or less.
- [x] **SIT-SEL-008**: The situation engine shall not bind the same person into two situations selected in the same turn, re-binding a later situation without the people already bound, or skipping it when it cannot be re-bound.
- [x] **SIT-SEL-009**: When a situation is selected, the situation engine shall record it as presented in the current game week and as open until it is resolved or ignored.
- [x] **SIT-SEL-010**: When a situation is selected, the situation engine shall return a presentation id unique within the run, its situation id, its bindings, its day and time, its rendered text and the labels of the choices whose `availableIf` holds.
- [x] **SIT-SEL-015**: When a situation is selected, the situation engine shall place it on its `day` and at its `time` where the situation sets them, and draw from its generator any it does not set: a day from Monday to Friday, and a time of morning or afternoon.
- [x] **SIT-SEL-011**: The situation engine shall draw all its randomness from a seeded generator held in the engine state, and leave the simulation's generator state unchanged.

## Resolving a choice

- [x] **SIT-RES-008**: If a resolution names a presentation that is not open, then the situation engine shall return an error and leave both states unchanged.
- [x] **SIT-RES-009**: When a presentation is resolved or expires, the situation engine shall close it.
- [x] **SIT-RES-001**: When a choice is resolved, if any bound person or project is no longer active, any bound team no longer exists, or a team bound to a role with a `form` no longer has that form, then the situation engine shall expire the situation, apply no effects, and record a debrief record with the game week, situation id and bindings, the status `expired`, and no choice, aftermath or debrief text.
- [x] **SIT-RES-010**: When a choice is resolved, the situation engine shall look up the presented situation by id in the situations it is given, and return an error leaving both states unchanged when it is not among them.
- [x] **SIT-RES-002**: If the chosen choice does not exist or its `availableIf` does not hold against the current state, then the situation engine shall return an error and leave both states unchanged.
- [x] **SIT-RES-003**: When a choice is resolved, the situation engine shall apply the first outcome whose `when` holds against the current state, or the final outcome when none does.
- [x] **SIT-RES-004**: When an outcome is applied, the situation engine shall replace role names in its effects with the bound ids, give each effect the cause of that situation and choice, and submit them to the simulation core as one batch.
- [x] **SIT-RES-005**: When an outcome is applied, the situation engine shall return the new simulation state, the core's change log, the rendered aftermath line and a debrief record.
- [x] **SIT-RES-006**: When an outcome is applied, the situation engine shall record a debrief record carrying the status `resolved`, the game week, situation id, choice id, outcome id, bindings, rendered aftermath line and rendered debrief text.
- [x] **SIT-RES-007**: If the simulation core rejects an outcome's batch, then the situation engine shall return an error naming the situation, choice and outcome, and leave both states unchanged.

## Text

- [x] **SIT-TEXT-001**: When rendering text, the situation engine shall replace `{role}` with the bound person's, team's or project's name and `{role.team}` with a bound person's team name.
- [x] **SIT-TEXT-002**: The situation engine shall return rendered text as plain strings, inserting names verbatim without interpreting them as markup.
- [x] **SIT-TEXT-003**: The situation engine shall substitute placeholders in a single pass, leaving braces inside inserted names as they are.

## Engine state

- [x] **SIT-STATE-001**: The situation engine shall represent its state as plain data that survives serialization to JSON and back without change.
- [x] **SIT-STATE-002**: The situation engine shall return a new engine state from every operation and leave the input state unchanged.
- [x] **SIT-STATE-003**: When the same operations are applied with the same inputs to engine states created from the same seed, the situation engine shall produce identical results.
- [x] **SIT-STATE-005**: When the engine state refers to situation ids not in the loaded content, the situation engine shall keep those records and otherwise ignore them.
- [x] **SIT-STATE-004**: When debrief records are requested from a game week, the situation engine shall return the records from that week on, in the order they were recorded.
