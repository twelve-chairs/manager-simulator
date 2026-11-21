# Presentation / UI — Specs

Design: [ui-design.md](ui-design.md)

## The page

- [x] **UI-SHELL-001**: When the page starts with no saved run, or one that fails to load, the UI shall show the start screen with a new seed drawn from the browser's cryptographic random source, and when the player begins, start a new run from that seed and show it.
- [x] **UI-SHELL-002**: When the UI shows a run, it shall show the week screen in the week phase, the review screen in the review phase, and the ended screen once the run has ended.
- [x] **UI-SHELL-003**: When a command applies, the UI shall redraw the whole screen from the new run.
- [x] **UI-SHELL-004**: If a command returns an error, then the UI shall show the error next to the control that sent it and leave the rest of the screen as it was.
- [x] **UI-SHELL-005**: When the scene changes (after an answer, a wait, Continue, starting the week, closing the recap or ending the week), the UI shall move keyboard focus to the heading of the week screen's scene, or of the review or ended screen; after a habit change it shall keep focus on that habit's control.
- [x] **UI-TEXT-002**: When the UI shows situation text, it shall show each span wrapped in `*` or `_` as an emphasized element whose text is set as text, and show an unmatched marker as written.
- [x] **UI-TEXT-001**: The UI shall put every string from content, the simulation or the player on the page only as text nodes or as attributes set as text, and shall never parse HTML from a string.

## The week screen

- [x] **UI-WEEK-001**: When the week screen is shown, the UI shall show a header with the week the scene is about (while the recap is shown, the week it recaps), the weeks until the next review, the five days with the current moment's day marked and earlier days shown as past, the player's energy as a meter and a band word, their reputation as a band word, and each of the review period's goals with its progress.
- [x] **UI-WEEK-002**: When the week screen shows the current moment, the UI shall show its day and time in words (such as "Tuesday morning"), its title and text, a button per choice that sends an answer command for it, and a Let it wait button that sends the wait command.
- [x] **UI-WEEK-003**: When the week screen shows the current moment or a reaction, the UI shall show an End the week button beside the scene that sends the end-week command, and shall show no such button beside the Before Monday scene, the recap or the week-done scene.
- [x] **UI-WEEK-004**: When the week screen is shown after a week has ended, while no moment of the new week has been answered or let wait and the player has not closed the recap, the UI shall show the recap, set at the weekend, in place of the current moment: each of last week's moments in order with its day, time, title and what happened (its reaction or aftermath line, that it was let wait, or that it passed), followed by the level's part of the recap, and a Start week button that closes it; before the first week ends it shall show no recap.
- [x] **UI-WEEK-005**: When the week screen is shown in game week 0 before the player has started the week and while no moment of the week has been answered or let wait, the UI shall show a Before Monday scene with each habit, a line on what it does and a control to change it, the How to play section open, and a Start the week button that closes the scene.
- [x] **UI-WEEK-006**: When a choice for the current moment applies, the UI shall show that moment's reaction or aftermath line, or that the moment passed when it expired, with the change chips, a line naming each later moment of the week that the answer left expired, and a Continue button, in place of the next moment, until the player presses Continue.
- [x] **UI-WEEK-007**: When the week screen is shown with no open moment left and no reaction waiting, the UI shall show that the week is done, set at the weekend, with an End the week button.
- [x] **UI-WEEK-008**: When a choice for a moment applies, the UI shall show a change chip for each band in the level's view that differs from before the command (a person's motivation or stress, the player's energy or reputation, or a project's risk or tech debt) and for each person who left or joined the team, each naming who or what changed and marked good or bad for the player (lower stress, risk and tech debt are good; someone leaving is bad).
- [x] **UI-WEEK-010**: When a choice for a moment applies, the UI shall show a change chip, marked neither good nor bad, with the newest memory note of each person who gained one from the command and has no band chip from it.
- [x] **UI-WEEK-011**: The UI shall show every week number counting from 1, game week *w* as week *w* + 1: the header's week, a heading or button about a week that has ended or is starting (the recap's heading, Start week, the review's heading, the ended screen), and the line manager's project deadlines.
- [x] **UI-WEEK-009**: The UI shall keep whether the player has read the latest reaction, started week 0 and closed the latest recap only as page state, never in the run or the save, so a reload never shows a reaction again.

## Help

- [x] **UI-HELP-001**: When the week screen is shown, the UI shall show a collapsible How to play section with the help text's six topics (How to play, Moments, Habits, Your people, Energy, Reviews), open by default in game weeks 0 to 2 and closed by default after, keeping the player's choice to open or close it across redraws.
- [x] **UI-HELP-002**: When the week screen is shown for the line manager, the UI shall show the help text's line under the team, projects and habits panels' headings.

## Line manager panels and scenes

- [x] **UI-LINE-001**: When the week screen is shown for the line manager, the UI shall show a card for each engineer with name, role, personality, tenure ("1 week here", otherwise "N weeks here"), performance level, motivation, stress and skill as band words, their want or that it is unknown, and their memory notes, newest first.
- [x] **UI-LINE-002**: When the week screen is shown for the line manager, the UI shall list each active project with name, progress against scope, deadline week, schedule status as on schedule, behind or overdue, and risk and tech debt as band words.
- [x] **UI-LINE-005**: When the week screen is shown for the line manager, the UI shall show each open vacancy with its interview count.
- [x] **UI-LINE-006**: When the week screen is shown for the line manager, the UI shall show a habits panel, folded by default after week 0 and keeping the player's choice to open or close it across redraws, with a control per habit that sends a plan command changing it at once, offering the team's engineers by name for a habit that names one.
- [x] **UI-LINE-007**: When the current moment is the line manager's, the UI shall show its difficulty as a band word where it has one, and beside each choice that gives the work or an interview to an engineer, that engineer's skill and stress band words.
- [x] **UI-LINE-008**: When the recap is shown for the line manager, the UI shall show each engineer the level reports, with their band changes and that week's notes, what each habit did and each habit that fell back, each expired work item by its kind and its subject's name, and each goal's progress.

## Saving

- [x] **UI-SAVE-001**: When the page starts with a saved run in storage, the UI shall restore it and show it.
- [x] **UI-SAVE-002**: When a run begins and after every command that applies, the UI shall write the run's save to storage.
- [x] **UI-SAVE-003**: When a restored run was rebuilt, the UI shall show a notice saying how many of its commands still applied, until the player's next command.
- [x] **UI-SAVE-004**: If a saved run in storage fails to load, then the UI shall show the start screen with a message and leave the stored save in place until a new run begins.
- [x] **UI-SAVE-005**: If storage cannot be read or written, then the UI shall keep playing without saving, show a notice once, and remove the stored save if it can.
- [x] **UI-SAVE-006**: When the player exports from a run screen, the UI shall download the save as a JSON file named `manager-simulator-<seed>-week-<week>.json`, through an object URL it revokes after the download starts.
- [x] **UI-SAVE-007**: When the player imports a save file from the start screen, or from a run screen and confirms replacing the current run, the UI shall restore it, and if it loads, replace the current run with it, save it and show it; if it fails, show a message and leave the current run as it was.
- [x] **UI-SAVE-008**: When the player discards from a run screen and confirms, the UI shall remove the stored save and show the start screen with a new seed; if they cancel, the run and its save stay as they were.

## Band words

- [x] **UI-BAND-001**: The UI shall name bands 0 to 4 as: motivation struggling, flat, fine, good, energized; stress calm, steady, busy, strained, overwhelmed; energy running on fumes, tired, okay, good, fresh; skill and work difficulty learning, developing, capable, strong, expert; risk and tech debt low, moderate, elevated, high, severe; reputation poor, mixed, fair, good, excellent.

## Review and end

- [x] **UI-REVIEW-001**: When the review screen is shown, the UI shall show the outcome in plain words (continuing, promoted, staying a line manager, or managed out), the rating, the ceiling's reason when the review returned one, the score, each measure with its name, its value in words, its verdict in words and, in secondary text, its number, target and tolerance, each of the quarter's debriefs with the situation's title (or its id when the loaded content has no such situation) and what happened (its debrief text when resolved, or that it was ignored or expired), and an Acknowledge button that sends the acknowledge command.
- [x] **UI-LINE-009**: When the review screen is shown for the line manager, the UI shall name its measures projects shipped on time, projects on schedule, people who quit, team motivation, team stress, 1:1s held and your reputation, a goal by its text, and give their values in words: counts as numbers or none, shares as all, none or a percentage, motivation, stress and reputation as band words, and a goal as met or missed.
- [x] **UI-END-001**: When the ended screen is shown, the UI shall say why the run ended (burnout, managed out, stayed a line manager, or completed), show the final week's recap, and offer a button that returns to the start screen with a new seed.

## Content and build

- [x] **UI-CONTENT-001**: When the page starts, the UI shall load the compiled situation bundle through the situation engine, listing invalid situations' errors on the page in the development build and dropping them silently in the production build.
- [x] **UI-BUILD-002**: When the game is built for production, the build shall put a Content-Security-Policy `<meta>` tag first in the page's head with the policy the UI design sets, which allows no inline script, no `eval` and no network connections.
- [x] **UI-BUILD-003**: When the game is built, the build shall emit every image the page uses as its own file, and inline none into the page, its stylesheets or its scripts as a `data:` URL, which the Content-Security-Policy's `img-src 'self'` would block.
- [x] **UI-BUILD-001**: When the game is built, the build shall compile the situations in `content/situations/` into the bundle, fail on an invalid situation, and emit static files with no inline script.
