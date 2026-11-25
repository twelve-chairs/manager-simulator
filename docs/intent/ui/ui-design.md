---
parent: high-level-design
prefix: UI
---

# Presentation / UI

## Context and Design Philosophy

The UI is the browser page the player plays on. It shows the run (the week's moments one at a time, the team as people, the habits and goals, a review when one is due) and turns the player's clicks into turn loop commands. It holds no game rules: every rule lives in the simulation core, the situation engine, the career level, the turn loop or the performance review.

Four principles shape it:

- **A view over the run.** The run is one value. After every command the UI redraws the screen from the new run; it keeps no copy of game state that could drift from it. The only state it holds is where the player is looking: whether they have read the reaction to their last choice, and whether they have closed last week's recap.
- **People first, numbers second.** A choice's result leads with what the person said or did, the reaction or aftermath line; what changed follows as short secondary chips ("Carmen: more stressed"). This is the HLD's tenet *show it through people over through numbers*.
- **Text, never HTML.** Every string from content, the simulation or the player reaches the page through `textContent` or an attribute set as text. The UI never parses HTML from a string, so a situation file or a name cannot inject markup or script.
- **No runtime dependencies.** The page is built from plain DOM calls through a small helper. A framework would add the project's first runtime dependency for screens that are mostly lists, buttons and selects.

## The Start Screen

The start screen sells the game's core idea, that every promotion is a new job, by showing the climb itself. In order, it shows:

1. The game's name, and the line **Every promotion is a new job.**
2. The pitch: "Start with a team of five engineers and a pager. Earn your way to managing managers, then a whole organization, and learn a new job at every step."
3. Two buttons: **Start a new game**, the primary button, which begins a run; and **Load a saved game**, a secondary button that opens the browser's file picker for an exported save and loads it as the start screen's import does (see *Saving*). The file input itself is hidden behind that button; a bare "Choose File" control reads as a form, not a game.
4. The **career ladder**: one rung per career level, drawn bottom to top so the player sees the climb from where they start. Each rung names the level, who the player manages there and how long a turn lasts, and says **Playable now** when the game has that level's module or **Coming later** when it does not. The playable rung is drawn in the accent colour; the others are muted.
5. In small print, the disclaimer, the version and the copyright notice: **© 2026 Twelve Chairs Software. All rights reserved.** The year is the year the game was first published; the game is not open source, and the repository has no license that grants reuse.

| Rung | You manage | Each turn is |
|---|---|---|
| Line manager | a team of five engineers | a week |
| Senior manager | several teams, through their managers | a month |
| Director and above | an organization | a quarter |

A rung reads as two sentences under its name: "You manage a team of five engineers. Each turn is a week." 

The rungs follow the HLD's table of career levels. Which rungs are playable is read from the levels the game was started with, not written into the text, so a level lights up when its module ships. Each rung names the level modules it stands for: line manager is `line-manager`, senior manager is `senior-manager`, and director and above is `director` and any other level module, since that rung may span several levels (such as director and VP); a rung is playable when the game has any of its modules. The ladder is an ordered list from line manager upward; only the drawing runs bottom to top, so a screen reader reads the climb in order.

On a wide screen the pitch and buttons sit on the left and the ladder on the right, on an opaque panel so the background pattern stays behind it; at phone width they stack, ladder below the buttons. The page has no animation: the ladder is the one strong element, and everything around it stays quiet.

## The Disclaimer

The start screen carries this text, in small print below the career ladder, readable in both themes and at phone width:

> Manager Simulator is a game. Its people, companies and situations are fictional, and its outcomes are simplified for play. It is not management, career, legal or HR advice; don't use it to make real decisions about real people.

It says on the page what the HLD's non-goals say in the design: the game teaches through play and makes no claim that its outcomes predict real ones. It sits on the start screen because every run begins there and a returning player passes it again whenever a run ends.

## Versions

Every build is stamped with a version, so a player's report or a screenshot can be traced to the code that produced it. The version is `v<major>.<minor>.<count> (<commit>)`: the major and minor numbers come from `package.json`'s `version` field and are raised by hand when the game changes in a way worth naming; `<count>` is the number of commits since the one that set the current major and minor, counting that one, so every push to `main` deploys a higher number than the last and a new major or minor starts again from 1; `<commit>` is the short hash of that commit. The start screen shows it as "Version v0.2.5 (93face2)".

The build reads the count and hash from git. A build without the whole history (no git, or a shallow clone, which would count too few commits) is stamped `unversioned` rather than given a wrong number, and the development server shows `development`. The deploy and playtest workflows check out the whole history so that what they build carries a real version.

## Emphasis in Situation Text

Situation text may use Markdown emphasis, `*like this*` or `_like this_`, and nothing else. The UI shows emphasis as italic by splitting the string and wrapping each emphasized span in an `em` element whose text is set with `textContent`. This is not HTML parsing: no other markup has any meaning, and an unmatched marker shows as written.

## Screens

The screen follows the run's phase:

- **Start**: the page a new player lands on, which has to make them want to play: the whole career climb, which levels can be played, **Start a new game** and **Load a saved game**, and in small print the disclaimer and the version (see *The Start Screen*). The seed is not shown.
- **Week** (week phase): a header and a team panel around a **scene**, the one place the player's attention goes. The scene shows, in order:
  1. **Before Monday**, in the first week only, until the player starts the week: the habits with a line on what each does, and the How to play section, so the player sets how they run the team before anything arrives.
  2. **Last week's recap**, set at the weekend, after a week has ended, until the player closes it with **Start week N** (see *The Recap*).
  3. The **current moment** (the turn loop's first open moment): where and when it happens ("Tuesday morning", "Wednesday night"), its title and text, and a button per choice. A line manager moment shows its difficulty as a word where it has one, and a choice that gives work or an interview to an engineer shows that engineer's skill and stress words beside it, so the player can choose without leaving the scene. A **Let it wait** button sends the wait command.
  4. After the player answers, the **reaction**: the moment's reaction or aftermath line, the change chips, a line for each later moment the answer made impossible ("Thursday night's night page has passed"), and **Continue**, which moves on to the next moment. An expired moment says the moment passed because something changed.
  5. When no moment is open: "That's the week", set at the weekend, since a Friday night page can come before it, with **End the week**.

  While a moment or its reaction is showing, an **End the week** button is also available beside the scene; ending early lets the rest of the week wait. The other scenes leave it out: Before Monday and the recap each lead into the week with their own button, and "That's the week" has its own End the week.

  Which of these the scene shows is read from the run where it can be: Before Monday and the recap show only until a moment of their week has been answered or let wait, so a reload returns the player to where they were, and a reaction, which only the page remembers, is never shown twice. Whenever the scene changes, keyboard focus moves to the scene's heading (a habit change keeps focus on its control), so a player on the keyboard or a screen reader follows the week from scene to scene.
- **Header**, on every week screen: the week number and the weeks until the next review, for the week the scene is about (while the recap shows, the week it recaps, so the weeks to review count from the end of that week); a strip of the five days, marking the current moment's day and the days already past; the player's energy as a meter and a word, and reputation as a word; at the burnout threshold the word is **at the edge** rather than a band word, and once the player has ended a week there, a warning under it counts the weeks toward burnout ("You've ended 2 weeks at the edge. 4 in a row and you burn out."); and while energy is running on fumes, before any week has ended at the edge, an earlier warning says "You're close to the edge. Take something off your plate.", while there is still time to ease off; where the player stands toward their own promotion, in the review screen's words ("One more review rated exceeds or better and you'll be promoted."), from the level's last review, or "Promotion opens at your third review, then takes two reviews in a row rated exceeds or better." before its first, since a rule seen once a quarter on the review screen is easy to lose, and the ratings the player gives engineers use the same words as their own; and the review period's goals, each with its progress.
- **Team panel**, on every week screen: a card per engineer with their name, role and personality; their motivation and stress as words ("seems strained"); skill as a word; their want once a 1:1 has revealed it; and their memory, the latest notes of what happened between you, newest first. A card gives tenure as "1 week here" or "N weeks here". Below the cards, open vacancies with their interview counts ("1 interview so far"), and the team's projects with progress against scope, deadline, schedule status as words (on schedule, behind, overdue), and risk and tech debt as words.
- **Habits panel**, on every week screen, folded away by default after the first week: each habit with a control to change it, sending a plan command at once. A habit that names an engineer offers the team's engineers by name.
- **Review** (review phase): the outcome in plain words (continuing, promoted, staying a line manager after the last review, or being managed out), so the player knows what acknowledging will do; the rating, and the ceiling's reason when one held it down; how near it came to the ratings either side ("One measure a step better would have made it outstanding."); where the player stands toward promotion ("One more review rated exceeds or better and you'll be promoted.", "Promotion takes two reviews in a row rated exceeds or better.", "Promotion opens in 2 reviews, then takes two in a row rated exceeds or better.", "There aren't enough reviews left at this level for a promotion."); the plan's next step when the player is on one ("One more review rated partial or below puts you on an improvement plan.", "One more review rated partial or below and you'll be managed out."); each measure by a plain name, its value in words and its verdict in words ("above target"), with the number and target in small print beside it for players who want them (a goal is named by its text, and its value is met or missed); the score in small print beside the rating, from −1 to 1, for players who want it; the quarter's debriefs (each situation's title, or its id when the loaded content no longer has it, with what happened in the words the recap uses: "You dealt with it" with its debrief text, "You let it wait" with the situation's lesson for waiting when it has one, or "It passed before you got to it"), and an **Acknowledge** button.
- **Handover** (handover phase): the promotion in plain words, and the one call the player makes as they leave their team: who leads it now (see *The Senior Manager's Screens*).
- **Ended**: why the run ended (burnout, managed out, stayed at the level, completed); a short **career summary** (how many weeks the run lasted, each review's rating in order, and the level's part: for the line manager, the projects shipped on time, who joined and who left and why), so a long run ends with its story rather than only its last week; the final week's recap with *The whole week* open, since that week's moments are what explain a burnout, and a button to start a new run. The seed is not shown here either.

The level's renderer names its review measures and puts their values into words ("Team stress: strained", "Projects on schedule: all"), since only the level knows what each measure is.

The scene, header and recap are a shell shared by every level; the team panel, habits panel, the words beside a moment's choices and the level's part of the recap come from a renderer per career level, working from the level's view.

## Look

The page sits on a faint circuit-board pattern: traces, pads, vias and a chip, tiled across the background. It is drawn as a mask over a theme colour, so one image follows light and dark mode, and it stays faint behind the scene and the cards, which are opaque, so text keeps its contrast. The pattern ships as its own image file: the build never inlines an image into the stylesheet as a `data:` URL, which the page's Content-Security-Policy (`img-src 'self'`) would block.

## Turns and Their Numbers

A turn is a week at the line manager, a month at the senior manager and a quarter at the director, and the shell names it in the level's word: the header, the recap's heading ("How month 3 went"), its button ("Start month 4"), the review's heading ("Month 6 review") and the ended screen. Months count from 1 from the start of the senior manager level, and quarters from the start of the director level, as weeks count from 1 from the start of the run. Within a month or a quarter, a moment says which week of it and which day it falls on ("Week 2, Tuesday morning"), and the header's strip shows that week's five days. The weeks to the next review are shown in the level's turns ("3 months to your review").

## Week Numbers

Every week number the UI shows (the header, the recap's heading and its Start week button, a project's deadline, the review's heading, the ended screen) counts from 1, per the HLD's *Players count weeks from 1*: game week *w* shows as week *w* + 1. A heading about a week that has ended names that week, so the recap after game week 0 reads "How week 1 went" and the review held after game week 12 reads "Week 13 review". The exported save's file name is read by the player too, so it names the week the screen shows (the header's week, or the week the recap, review or ended screen is about); the save's contents keep game weeks.

## Change Chips

After a choice applies, the UI compares the level's view before and after the command and shows a chip for each band that moved: a person's motivation or stress ("Dario: less motivated"), the player's energy and reputation, and a project's risk or tech debt; and a chip for each person who left the team or joined it. A person with no band chip who gained a memory note from the choice gets a chip with that note ("Ada: struggled through an incident"), so a cost too small to move a band still shows that the choice landed on someone; a note is neither good nor bad, so its chip is marked neither. The player gets the same: where the level's view counts the choices that spent the player's energy, a choice that spent it without moving the energy band gets a chip saying so ("You: energy spent"), marked bad. A rise that is good for the player reads as good and a fall as bad, whatever the number did: less stress is good news. The comparison reads bands the view already shows, so it adds no rule and reveals nothing the player could not see by comparing the panels.

## The Recap

The recap tells the story of the week just ended, from the run's last week. It shows first what changed, which the player needs before the next week, and folds away what they have already seen or can see elsewhere, so the weekend is a glance rather than a page to read.

What changed, shown at once:

- **Your people**: each engineer the level reports for the week (for the line manager, whose motivation or stress changed band, or who gained a memory note from a moment or situation), with what was recorded for them that week;
- **Evaluations**: for the line manager, the engineers rated at the end of a review period;
- **Habits that changed**: any habit that fell back because its engineer left;
- **What slipped**: work that expired, by its kind and what it was about;
- **Projects that lost ground**: for the line manager, each project that went backwards or had a setback, with what moved it;
- **Waiting for you**: for the line manager, each final evaluation held for Monday;
- **New work**: a project the player's manager assigned to an idle team.

When none of these has anything to show, the recap says "A quiet week." in their place.

The line manager's part ends with its **watch line**, when the level reports one: the one thing most likely to go wrong next, under the label "Watch", set apart from the lines above it so that it reads as a look ahead rather than one more thing that happened. It comes after "A quiet week." when the week was otherwise quiet, since a quiet week can still be heading somewhere.

Below them, a disclosure, **The whole week**, closed until the player opens it, holds:

- **The week**: each moment in order, its day and time, its title, and what happened (the reaction or aftermath line, "You let it wait", or "It passed"). The player read each reaction as it came;
- **Habits**: what each habit did, which is the same routine most weeks;
- **Projects**: for the line manager, how each project moved and why, which most weeks is the team's work alone;
- **Goals**: each goal's progress, which the header also shows.

On the ended screen the disclosure is open: the final week's moments are what explain how the run ended. On the week screen, once the player opens or closes the disclosure, that choice holds for later recaps until the page is reloaded, the same way the How to play section keeps its state. It is page state, never saved.

## Saving

The UI wires the save component (see [Save / load](../save/save-design.md)) to the page:

- When the page starts, it loads the saved run from storage, if there is one, and shows it, so a reload resumes where the player was. With no save, or one that fails to load, it shows the start screen, with a message when a save failed.
- After every command that applies, and when a run begins, it saves.
- A notice under the header says when a loaded run was rebuilt (how many of its commands still applied) or when saving is not possible; it stays until the next command.
- Every run screen has a small save area with **Export save**, **Load a saved game** and **Discard and start over**; the start screen has **Load a saved game** too. Loading is the same action everywhere, under the same name: a button that opens the browser's file picker, with the file input hidden behind it. Discarding, and importing over the current run, each show a confirmation (**Yes** and **Cancel** buttons in the save area) before anything is replaced or removed.
- If writing a save fails, the UI also removes the stored save if it can, so a reload does not resume a run from before the failure.

Storage is passed to the app rather than reached for directly, so tests can supply their own and the app works when the browser's storage is missing.

## Help Text

Each level has its own How to play topics and panel help lines; the senior manager's are in *The Senior Manager's Screens*. The How to play section and the panel help lines teach the game's controls, not management (see the HLD's non-goals); the first weeks' onboarding situations, written as content, do the same in the story.

| Topic | Text |
|---|---|
| How to play | Each week is a handful of moments, Monday to Friday. Pick what you do in each one, or let it wait. Your habits handle the routine, and a recap ends the week. |
| Moments | Choices take effect at once. Doing something yourself costs energy; giving it to someone costs them, and goes well if it's within their skill. What you let wait may come back, or cause trouble. |
| Habits | Habits are how you run the team every week: who takes night pages, how often you hold 1:1s, who signs routine approvals, how much ceremony there is, and whose growth you focus on. Change them any time. |
| Your people | Everyone has a personality and remembers what happened between you. 1:1s build trust and reveal what each person wants; people whose wants go unserved lose motivation, and unhappy people leave. |
| Energy | Your energy falls with the work you take on and recovers in quiet weeks, fastest in a week you take nothing on yourself. Push it to the edge for four weeks in a row and you burn out. |
| Reviews | Every 13 weeks your own manager reviews you: delivery, retention, team health and the quarter's goals. From your third review on, two of your reviews in a row rated exceeds or better get you promoted to senior manager; three in a row rated partial or below and you're managed out. After two years without a promotion, the run ends. |

| Panel | Help line |
|---|---|
| Team | Words are your read on each person. Wants appear after a 1:1. |
| Projects | Projects move on their own. Risk and tech debt make setbacks more likely. |
| Habits | Changes apply from this week's end, and to moments from next week. |

## The Senior Manager's Screens

The senior manager level keeps the shell (header, scene, recap, review, ended) and brings its own renderer.

**The handover.** After the review that promotes a line manager is acknowledged, the screen says so ("You've been promoted to senior manager") and asks the one question the player answers as they leave their team: who leads it now. Each of the team's engineers is a choice, showing their name, skill in words, how much they trust the player in words (*wary*, *guarded*, *neutral*, *trusting*, *loyal*, the bands of trust) and their want if a 1:1 revealed it; the last choice is an outside hire, "a capable manager you don't know yet". A line under the question says what each kind of choice costs ("Someone from the team leaves it an engineer short, and starts out learning the job unless they trust you and want to grow. An outside hire keeps every engineer, but a stranger in charge unsettles the team at first."), so the outside hire is not a blind pick. Choosing sends the hand over command, and the first month begins.

**The first month** opens, like the first week, on a scene before anything arrives: the senior manager's habits with a line on what each does, and How to play, closed by **Start month 1**.

**The managers panel**, in place of the team panel: a card per manager with their name, personality, motivation and stress in words, their management skill in words ("manages: developing"), their want once a 1:1 has revealed it, and their memory. Under each manager, their team: its name, headcount ("6 people"), motivation and stress in words, how likely it is to lose people (attrition risk in words), and its projects as the line manager's projects panel shows them. A team's numbers are labelled by where they come from: "as Ada tells it", or "as you saw it" when close oversight or a skip-level showed the truth. A team without a manager says so ("No manager yet"). No engineer is ever shown.

**The habits panel** has the four senior habits: oversight per manager (hands-off, coaching, close), 1:1s with managers, backfill and skip-level listening.

**Calibration** is a scene of its own: for each team, its manager's proposal and what the team delivered, as counts at each rating side by side, and for each rating a control to move a head down or up a rating. **Accept every proposal** sends the calibration as proposed; **Settle calibration** sends every team's moves at once. Above the teams, the group's **curve** shows the most top ratings it may hold beside how many the teams would hold as the moves stand, updated with each move, so the player sees where they are over before settling. When the settled ratings are still over the curve, the scene asks the last question: argue for an exception, which spends reputation and holds only with a high one, or let the room trim. Letting it wait lets the proposals stand, and the room trims what is over.

**Other moments** read as the line manager's do: where and when, the title and text, a button per choice. A choice that depends on a manager shows that manager's skill in words beside it, as a work moment shows an engineer's.

**Change chips** compare the senior view before and after a choice: a manager's motivation, stress or management skill, a team's motivation or stress as shown, a team's headcount, and the player's energy and reputation.

**The recap** shows what changed (managers, teams as shown, heads that left or joined, projects that slipped) and folds the routine (the habits' lines and the goals' progress) into *The whole month*, as the line manager's folds *The whole week*.

**The review** names the senior measures: projects shipped on time, projects on schedule, people you'd have kept who left, the teams' motivation and stress, how much your managers grew, the teams that held up, calibration quality and your reputation; goals by their text.

**The ended screen** says why the run ended at the level it ended at: "You stayed a senior manager. Three years went by without the promotion.", or burned out, managed out, or completed, as at the line manager. The career summary covers the whole run: the weeks played, each review's rating, the line manager's part, and the senior manager's part (the months played, the managers who joined and who were let go).

| Topic | Text |
|---|---|
| How to play | Each month is a handful of moments. Your managers run the teams; you run your managers. Pick what you do, or let it wait. A recap ends the month. |
| Managers | Your managers act for you. Coach them and they grow; step in and you fix it yourself, at a cost, and they learn nothing. |
| What you're told | Each team is shown as its manager tells it. A manager who struggles or doesn't trust you makes it sound better than it is. Close oversight and skip-levels show you the truth. |
| Calibration | Before each review your managers propose their teams' ratings. Compare them with what each team delivered, and move heads up or down. The group shares a curve with fewer top ratings than a strong group earns: decide whose people give one up, or argue for an exception with your reputation. |
| Energy | Your energy falls with what you take on yourself and recovers in quieter months. Four months in a row at the edge and you burn out. |
| Reviews | Every six months your own manager reviews you: delivery, retention, your teams' health, how your managers grew, calibration and the period's goals. From your third review on, two of your reviews in a row rated exceeds or better get you promoted to director. After three years without one, the run ends. |

| Panel | Help line |
|---|---|
| Managers | Each team is shown as its manager tells it, unless you saw for yourself. |
| Habits | Changes apply from this month's end, and to moments from next month. |

## The Director's Screens

The director level keeps the shell (header, scene, recap, review, ended) and brings its own renderer, as the senior manager does.

**The handover.** After the review that promotes a senior manager is acknowledged, the screen says so ("You've been promoted to director") and asks who leads the player's group now. Each of their managers is a choice, showing their name, management skill in words, how much they trust the player in words and their want if known; the last choice is an outside hire, "a capable senior manager you don't know yet". A line under the question says what each costs ("One of your managers brings the trust they've built with you. An outside hire is capable, but a stranger in charge unsettles the group at first."). Choosing sends the hand over command, and the first quarter begins.

**The first quarter** opens on a scene before anything arrives: the director's habits with a line on what each does, and How to play, closed by **Start quarter 1**.

**The senior managers panel**, in place of the managers panel: a card per senior manager with their name, personality, motivation and stress in words, management skill in words ("leads: capable"), their want once known, and their memory. Under each, their group: its name, headcount ("18 people"), its projects as the projects panel shows them, and its motivation, stress and attrition risk in words, labelled by where they come from: "at the survey in quarter 2", or "as you saw it" in a quarter the listening tour visited it. A group without a senior manager says so. No team or line manager inside a group is ever shown.

**The upward panel**: the executive and the two peers, each as a card with their name, role ("your executive", "a peer director"), personality, how much they trust you in words, their want once known, and their memory.

**The bets panel**: each funded bet with the group carrying it, its progress and deadline as a project shows them, and its stakes in words ("lands: a big win; fails: a hard knock"). With no bet funded, it says so.

**The habits panel** has the three director habits: where your time goes, the staff meeting and the listening tour.

**Headcount planning** is a scene of its own: the heads given this quarter, a stepper per group and per funded bet, and a count of heads still to place. **Place the heads** sends the placement; **Spread them**, **Give them all to the most stretched group** and **Hold them back** are one-press choices. Letting it wait holds them back.

**Strategy bets** are a scene of their own: each bet on offer with its name, size, deadline, stakes and the peer it touches, and for each a choice of the group to carry it, or none. **Fund these bets** sends at most two; **Fund none** declines them all.

**The quarterly review** reads as other moments do, with what the quarter held in its text and a button per way of telling it.

**Other moments** read as at the earlier levels. A choice that depends on a senior manager shows their skill in words beside it.

**Change chips** compare the director view before and after a choice: a senior manager's motivation, stress or management skill, a group's headcount, the executive's or a peer's trust, a bet's schedule, and the player's energy and reputation.

**The recap** shows what changed (senior managers, a new survey's results, heads that left or joined, bets that landed, failed or slipped, and who above trusts you more or less) and folds the routine into *The whole quarter*.

**The review** names the director measures: bets landed, projects shipped on time, people you'd have kept who left, the groups' motivation and stress at the survey, your executive's confidence and your reputation; goals by their text.

**The ended screen** says why the run ended at the director level ("You stayed a director. Three years went by without the promotion.", or burned out, managed out, or completed), and the career summary adds the director's part: the quarters played, and the senior managers who joined and who were let go.

| Topic | Text |
|---|---|
| How to play | Each quarter is a run of moments. Your senior managers run the groups; you set the headcount, place the bets and answer to your executive. Pick what you do, or let it wait. A recap ends the quarter. |
| The room above | Your executive and your peers each trust you more or less. Time with them earns headcount and backing; time away from your organization costs it. |
| The survey | You see your groups' mood as the last engagement survey measured it, twice a year. A listening tour shows one group as it is now. |
| Bets and the review | Fund bets your groups can carry. Each quarter you tell your executive how it went; what you leave out tends to come back. |
| Energy | Your energy falls with what you take on yourself. Two quarters in a row at the edge and you burn out. |
| Reviews | Every two quarters your executive reviews you: the bets, delivery, retention, your groups' health and their confidence in you. From your third review on, two of your reviews in a row rated exceeds or better get you promoted. After three years without one, the run ends. |

| Panel | Help line |
|---|---|
| Senior managers | Each group's mood is from the last survey, unless your listening tour saw it this quarter. |
| Upward | How much your executive and peers trust you shapes your headcount and your bets. |
| Bets | A bet lands if its project ships by its deadline. |
| Habits | Changes apply from this quarter's end, and to moments from next quarter. |

## Bands as Words

The career level shows values as bands, 0 for the lowest. The UI names each band per kind of value:

| Value | Bands 0 to 4 |
|---|---|
| Motivation | struggling, flat, fine, good, energized |
| Stress | calm, steady, busy, strained, overwhelmed |
| Energy | running on fumes, tired, okay, good, fresh |
| Skill and work difficulty | learning, developing, capable, strong, expert |
| Risk and tech debt | low, moderate, elevated, high, severe |
| Reputation | poor, mixed, fair, good, excellent |
| Trust | wary, guarded, neutral, trusting, loyal |

The words are UI text; the bands come from the level. A manager's management skill uses the skill words, and a team's attrition risk the risk words. Skill and difficulty share words so the player can compare a piece of work with the person they might give it to.

## Commands and Errors

Every control sends one turn loop command. If the loop returns an error (a habit the level rejects, a choice that no longer applies), the UI shows the error next to the control that caused it and redraws nothing else; the run is unchanged.

## Content and Seeds

Situation content is compiled from `content/situations/` into a JSON bundle at build time and imported by the page. At start the page loads it through the situation engine, which drops invalid situations; in the development build their errors are listed on the page, and in the production build they are dropped silently.

A new run's seed is drawn from the browser's cryptographic random source. The page never shows it: to a player it is a meaningless number. It travels in the save, and in an exported save's file name, which keeps exports from different runs from overwriting each other, so a run can still be reproduced from the save a player sends. The seed only chooses where the run starts; everything after is deterministic from it, so the page needs no other randomness and no clock.

## Build

Vite builds the page (a development dependency). The build compiles the situation content, bundles the TypeScript, and emits static files with no inline script, so the page can be served with a Content-Security-Policy that forbids inline script and `eval`. The production build also carries that policy itself, in a `<meta>` tag, so it applies on hosts that cannot send headers: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. `connect-src 'none'` makes the no-network promise something the browser enforces. The development server injects styles inline for live reloading, so the tag is added only to the production build. Render functions are tested under Vitest in `happy-dom`, a development dependency that provides a DOM without a browser. End-to-end tests in Playwright (a development dependency) play the production build in Chromium, served as it is deployed: they cover what `happy-dom` cannot, such as the Content-Security-Policy, assets actually loading, focus and the browser's storage. **Playtests** go further: scripted players of different styles play whole runs from fixed seeds through the page's own controls, across every level a run reaches, and every screen is checked as it goes (text quality, time order, the header against the scene, the team cards, the review and the career summary, nothing wider than the viewport), along with scenarios for features a run reaches only sometimes, saves, phone width, dark mode and the keyboard. They are slower, so they run on request and weekly in CI rather than on every commit, and the same suite can be pointed at a deployed copy, such as the live site. The success-metric playtests in the same suite measure a proxy for each of the HLD's success metrics (see the [playtest design](../playtest/playtest-design.md)). The code is linted with oxlint (a development dependency), whose correctness rules and two type-aware rules (no floating promises, no unnecessary type assertions) must pass with no warnings in every commit and CI run.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Rendering | Plain DOM through a small helper that sets text with `textContent`; redraw the screen after each command | Preact or another small framework; web components (Lit) | Zero runtime dependencies, safe-by-construction text that is easy to audit, and a redraw fits the one-value run. A framework's escape hatch for HTML would need policing; its ergonomics are not needed for screens of lists and forms. |
| Level-specific screens | A renderer per career level for its panels, inside a shared shell | One generic renderer for every level | Each level is a different game with different panels; a shared shell keeps the scene, recap, reviews and endings consistent. |
| The week on screen | One scene at a time, with the team and header around it | Every moment of the week listed at once | A list of the week's moments reads as a form to fill in; one scene at a time, with its reaction before the next, is what made the mockup feel like a game. |
| Reactions | Shown after each choice until the player presses Continue | Shown above the next moment | Reading the reaction is the payoff of the choice; moving on at once buries it. |
| The recap | What changed shown at once; the moments, routine habit lines and goals in a closed disclosure | Everything shown at once; a shorter recap with the folded parts removed | Shown at once, the recap was a third of each week's reading, and most of it repeated reactions the player had just read or goals the header shows. Removing those parts would lose the week's full story, which a player looking back still wants. |
| What changed | Chips from comparing the view's bands before and after a choice, after the reaction, plus a chip for a new memory note when no band moved | Numbers changed; no chips; band chips only; a chip for every value change | The tenet puts people first, but a player learning the game needs to see that a choice landed; bands are what the view already shows. Band chips alone hid real costs, such as an engineer struggling through a night page without changing band; a chip per value change would be noise every week, and the note is the person's own account of what happened, which the tenet favours. |
| Habits | Set before Monday in the first week, then in a panel at any time | Only in a panel | Habits are the player's main lever; meeting them first makes clear the routine is handled before the first moment arrives. |
| Seed choice | Drawn from the browser's cryptographic random source | A fixed seed; the clock | A random seed gives a fresh run each time; the clock and `Math.random` are kept out of the game. |
| Seed on screen | Not shown; carried in the save and the exported file's name | Shown on the start and ended screens | A number with no meaning to the player makes the game read like a debug build. A run is reproduced from its save, which holds the seed and every command, so showing the seed alone adds nothing for a bug report. |
| Version scheme | `v<major>.<minor>.<commit count> (<short hash>)`, stamped by the build from git | Semantic version bumped by hand; the CI run number; the date; a git tag or release per deploy | A hand bump is forgotten, and two deploys then share a number. The CI run number also counts pull-request runs and restarts with a renamed workflow. A date is not unique within a day. A tag or release per deploy needs the workflow to write to the repository, which the deploy otherwise does not. The commit count rises with every push to `main` and starts again at each major or minor, as version numbers usually do; the hash points to the exact commit. A count over the whole history would never reset, which reads oddly after a bump. |
| Where the version shows | In small print on the start screen | A footer on every screen; only in the page's source | The start screen is where every run begins and ends up again; a footer on every screen competes with the scene. Hidden in the source, a player could not quote it. |
| Start screen | A career ladder of every level, marked playable or coming later, beside the pitch and two named buttons | A promotion email from the player's new boss; an org chart that grows on load | The ladder shows the game's core idea, a new job at every level, rather than telling it, and grows as levels ship. The email is atmospheric but only tells the climb; an animated org chart is the most eye-catching and the hardest to keep legible at phone width. |
| Rungs not yet built | Shown, marked **Coming later** | Hidden until playable | The climb is the promise of the game; hiding the upper levels makes it read as a line-manager game. Marking them keeps the page honest about what can be played today. |
| Disclaimer placement | On the start screen, always | A dismissable banner; a separate about page | A banner is dismissed unread and an about page is never opened; small print on the screen every run starts from is seen without getting in the way. |
| Background | A circuit-board pattern as a CSS mask over a theme colour, served as a file | A coloured image per theme; a CSS-only pattern of gradients; a photo | One small image serves both themes. Gradients can draw a grid but not traces and chips, and a photo is heavy and fights the text. Serving it as a file keeps the strict CSP: an inlined `data:` image would be blocked. |
| End-to-end tests | Playwright against the production build, in Chromium | Only unit tests in `happy-dom`; Vitest's browser mode | `happy-dom` has no Content-Security-Policy and no real asset loading, so a blocked background or script would pass every unit test. Playwright serves the real build; Vitest's browser mode tests modules, not the deployed page. |
| Playtests | Whole runs played by scripted players in the browser, on request and weekly, against the local build or a deployed copy | Playing runs by hand; folding them into the end-to-end suite | Hand-played runs found most of the game's playability problems but are slow and easy to skip; in the end-to-end suite they would slow every commit. Fixed seeds keep every failure replayable. |
| Linter | oxlint with its type-aware companion, oxlint-tsgolint | ESLint with typescript-eslint; Biome | typescript-eslint supports only TypeScript before 6.1, and the project builds with TypeScript 7; ESLint would need a second, older TypeScript and so lint against a different compiler. oxlint runs ESLint's core rules and ports of typescript-eslint's without TypeScript's JavaScript API, and its type-aware rules are built on TypeScript 7. Biome has no type-aware rules. |
| A month on screen | Named in months from the level's start, with each moment's week of the month and day | Weeks throughout; a calendar of the month | Months are the senior manager's turn; weeks would make a six-month review read as 24 weeks. A calendar would show twenty days for a handful of moments. |
| Trust at the handover | In words, the bands of trust | Hidden, as at the line manager; as a number | Choosing who leads your team is a judgement about people the player knows; trust is what makes a promoted engineer a developing manager, so hiding it would make the choice a guess. |
| Calibration controls | Counts per rating beside the delivery, with a control per rating to move a head | Dragging heads between columns; one slider per team | Counts beside counts make the gap readable at a glance; per-rating controls work on a keyboard and at phone width. |
| Invalid content | Dropped; listed on the page only in the development build | Always listed; failing to start | Players should not see authoring errors; authors should. The build already fails on invalid content, so this only matters for a bundle edited by hand. |

## Open Questions & Future Decisions

### Deferred
1. Undo within a week.
2. Visual design beyond a clean, readable default: faces, animation.
3. Accessibility beyond semantic HTML, labels and keyboard-operable controls.

## References

- [High-level design](../../high-level-design.md)
- [Turn loop](../turn-loop/turn-loop-design.md)
- [Line manager level](../line-manager/line-manager-design.md)
- [Situation engine](../situation-engine/situation-engine-design.md)
- [Performance review](../performance-review/performance-review-design.md)
- [Security rule](../../../.claude/rules/security-and-privacy.md)
