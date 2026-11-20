# Presentation / UI — Specs

Design: [ui-design.md](ui-design.md)

## The page

- [x] **UI-SHELL-001**: When the page starts with no saved run, or one that fails to load, the UI shall show the start screen with a new seed drawn from the browser's cryptographic random source, and when the player begins, start a new run from that seed and show it.
- [x] **UI-SHELL-002**: When the UI shows a run, it shall show the week screen in the planning phase, the review screen in the review phase, and the ended screen once the run has ended.
- [x] **UI-SHELL-003**: When a command applies, the UI shall redraw the whole screen from the new run.
- [x] **UI-SHELL-004**: If a command returns an error, then the UI shall show the error next to the control that sent it and leave the rest of the screen as it was.
- [x] **UI-TEXT-002**: When the UI shows situation text, it shall show each span wrapped in `*` or `_` as an emphasized element whose text is set as text, and show an unmatched marker as written.
- [x] **UI-TEXT-001**: The UI shall put every string from content, the simulation or the player on the page only as text nodes or as attributes set as text, and shall never parse HTML from a string.

## The week screen

- [x] **UI-WEEK-001**: When the week screen is shown, the UI shall show the week, the weeks until the next review, the player's reputation and stress as band words, and the week's planned hours and overtime.
- [x] **UI-WEEK-002**: When the week screen is shown, the UI shall show each open situation's text with a button per offered choice that sends an answer command, each answered situation's aftermath line, and each expired situation as expired.
- [x] **UI-WEEK-003**: When the week screen is shown, the UI shall show an End week button that sends the end-week command.
- [x] **UI-WEEK-004**: When the week screen is shown after a week has ended, the UI shall show last week's dropped calendar entries with their reasons, delegation outcomes, delegations that did not happen and void decisions with their reasons, expired demands, each demand named by its type and its subject's name, and aftermath lines; before the first week ends it shall show no last week.

## Help

- [x] **UI-HELP-001**: When the week screen is shown, the UI shall show a collapsible How to play section with the help text's six topics, open by default in weeks 0 to 2 and closed by default after, keeping the player's choice to open or close it across redraws.
- [x] **UI-HELP-002**: When the week screen is shown for the line manager, the UI shall show the help text's line under the team, projects, inbox and calendar panels' headings.

## Line manager panels

- [x] **UI-LINE-001**: When the week screen is shown for the line manager, the UI shall list each engineer with name, role, tenure, performance level, motivation, stress and skill as band words, and their want, or that it is unknown.
- [x] **UI-LINE-002**: When the week screen is shown for the line manager, the UI shall list each active project with name, progress against scope, deadline week, schedule status, and risk and tech debt as band words.
- [x] **UI-LINE-003**: When the week screen is shown for the line manager, the UI shall list each inbox demand with its type, subject's name, hours, difficulty as a band word, last week and current decision, with controls that send plan commands to handle it, delegate it to a chosen engineer (offering every engineer on the team except the request's own requester) or clear the decision, or for work intake to accept it, decline it or clear the decision.
- [x] **UI-LINE-004**: When the week screen is shown for the line manager, the UI shall list each calendar entry with its action, target's name and cadence and a button that sends a plan command removing it, and a form whose action, target and cadence choices send a plan command adding an entry, offering only targets of the action's kind, only this week for a one-off action, and for an every-other-week entry a start of this week or next.

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

- [x] **UI-BAND-001**: The UI shall name bands 0 to 4 as: motivation struggling, flat, fine, good, energized; stress calm, steady, busy, strained, overwhelmed; skill and demand difficulty learning, developing, capable, strong, expert; risk and tech debt low, moderate, elevated, high, severe; reputation poor, mixed, fair, good, excellent.

## Review and end

- [x] **UI-REVIEW-001**: When the review screen is shown, the UI shall show the outcome in plain words (continuing, promoted, or managed out), the rating, the score, each measure with its value, target and verdict, each of the quarter's debriefs with the situation's title (or its id when the loaded content has no such situation) and what happened (its debrief text when resolved, or that it was ignored or expired), and an Acknowledge button that sends the acknowledge command.
- [x] **UI-END-001**: When the ended screen is shown, the UI shall say why the run ended (burnout, managed out, or completed) and offer a button that returns to the start screen with a new seed.

## Content and build

- [x] **UI-CONTENT-001**: When the page starts, the UI shall load the compiled situation bundle through the situation engine, listing invalid situations' errors on the page in the development build and dropping them silently in the production build.
- [x] **UI-BUILD-002**: When the game is built for production, the build shall put a Content-Security-Policy `<meta>` tag first in the page's head with the policy the UI design sets, which allows no inline script, no `eval` and no network connections.
- [x] **UI-BUILD-001**: When the game is built, the build shall compile the situations in `content/situations/` into the bundle, fail on an invalid situation, and emit static files with no inline script.
