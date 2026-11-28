# Running a Human Playtest

This is the script for one playtest session: one player, one facilitator, 30 to 60 minutes, and later sessions on the same run for a player who wants to go on to a promotion they didn't reach (see *Later sessions*). Each heading below is one of the HLD's success metrics (`docs/high-level-design.md`, *Success Metrics*). The scripted players in `metrics.playtest.ts` measure a proxy for the same metrics under the same headings, so you can compare a round of sessions with the scorecard for the same version (see *Comparing with the scorecard*).

## Setup

- **The game:** the live site, https://www.manager-simulator.io/, in a fresh browser profile, so no earlier run is loaded. A private window works too, but it forgets the run when it closes: export the save before closing it if there might be a later session.
- **The version:** write down the version from the bottom of the start screen (for example "Version v0.3.290 (7bdc568)") before the player starts.
- **The player:** someone who hasn't played before. Note whether they manage people, have been managed, or neither; don't screen anyone out.
- **Time:** let them play for up to 60 minutes. Stop earlier if they want to stop, and note when and why.
- **Think aloud:** ask them to say what they're thinking as they play: what they expect a choice to do, and what they make of what happens.
- **Don't coach.** Don't explain the game, suggest a choice or answer how something works. If they ask, say "What do you think?" and note the question. The only exception is a bug that blocks play: note it, and help them past it.
- **Take notes** with the week number from the header, so a note can be matched with what was on screen.

## Later sessions

Each career level takes about an hour to earn a promotion from: the earliest comes at the third review (week 39 as a line manager, month 18 as a senior manager), and many runs aren't promoted within an hour. *Promotion changes the job* needs a player who was, so a player who wants to go on plays a later session on the same run, on another day if they like: a second one to reach the senior manager, a third to reach the director, and a fourth to reach the VP.

- **Keeping the run:** the game saves after every move in the browser it was played in. If a later session is somewhere else, or an earlier one was in a private window, use **Export save** at the end of a session and **Load a saved game** at the start of the next.
- **How long:** until the next promotion and then a little time at the new level: about three months as a senior manager, through the first calibration if they get there, about two quarters as a director, through the first quarterly review, or about two quarters as a VP, through the first all-hands. Stop earlier if they want to.
- **What to record:** only *Promotion changes the job*, for the promotion the session reached, and anything new under the other headings, marked with the session it came from. *A promotion in the first session* is recorded from the first session alone.
- **The rules are the same:** think aloud, no coaching.

## Metrics

### A promotion in the first session

The HLD: playtesters complete at least one promotion in their first session.

**Watch for**
- The week and the time on the clock at each review, and its rating.
- Whether they reach a promotion before stopping, and when. Promotion is possible from the third review (week 39) on, after two strong reviews in a row; How to play and the line under the header say so, but don't point them to either.
- Whether they read the header's promotion line at all, and when it changes after a review.
- When their attention drops: skimming, sighing, checking the time.

**Ask afterwards**
- How did you feel about your reviews as they came?
- Did you know what it would take to be promoted? Where did you learn it?
- Would you have kept playing? What would have made you stop?

### Bad outcomes can be traced

The HLD: playtesters can explain at least one bad outcome by pointing to an earlier decision.

**Watch for**
- Bad outcomes: someone quitting, a low rating, a project going overdue, the burnout warning.
- Whether they connect one to something earlier, out loud ("that's because I...").
- Bad outcomes that surprise them ("where did that come from?").
- Whether they use the recap's reasons: a project that lost ground lists what cost it, and someone who became more stressed lists what raised it ("more stressed (signing approvals)").

**Ask afterwards**
- What was the worst thing that happened in your run?
- Why do you think it happened?
- Was there a moment when you saw it coming? What did you see?

### Choices feel consequential

The HLD: every choice gets a reaction at once, and people bring past choices up later.

**Watch for**
- Whether they read the reactions or click straight past them.
- Moments when they notice someone remembers something ("she's still upset about..."), in a reaction or in the recap, where someone sometimes brings up something from an earlier week.
- Choices they make without reading them.
- Whether they open *The whole week* in the weekend recap, and what they were looking for when they did.
- Whether they notice *Your promises* in the recap: what they promised someone, whether it was kept or broken, and what keeps it.

**Ask afterwards**
- Tell me about a choice that turned out to matter.
- Did anyone on your team bring up something you'd done earlier?
- Were there choices that didn't seem to matter? Which ones?
- Did the weekend recap tell you what you needed before the next week?

### It feels like a game, not a test

The HLD: playtesters describe a session as playing a game. If they describe it as answering questions or taking a test, the moments loop has failed.

**Watch for**
- Words they use for the experience while playing: "game", "story", "quiz", "test", "form".
- Repetition they comment on ("this again"), and which scene it was.
- New work (a launch, a handover, or a rewrite someone on the team wants): it comes only while someone, the player included, is strained. Whether they see why it costs something to say yes, and why declining costs different things for each kind.
- Moments of enjoyment or frustration, and what was on screen.

**Ask afterwards**
- How would you describe what you just did to a friend?
- What was the most fun part? The most tedious?
- Did anything feel like being tested? When?

### Promotion changes the job

The HLD: playtesters asked "what changed when you were promoted?" name concrete mechanics, not only bigger numbers. This needs a player who was promoted and has played a little at the new level, in any session. Ask it after each promotion a player reaches.

**Watch for**
- How they react to the promotion, and how they choose who leads their old team or group.
- At the senior manager, the first months: whether they notice that turns are now months, that they see their managers rather than their engineers, and that the teams are shown as their managers report them; the first calibration: whether they understand what they are being asked to set, and what they set it by; whether they read *Still open* in the recap, the skip-level problems their answer left unsettled; and, when new work is offered to several teams, what they weigh between the idle team and a better fit.
- At the director, the first quarters: whether they notice that turns are now quarters, that a group's mood comes from a survey taken twice a year, and that their executive and peers are people whose trust moves; how they place the quarter's headcount and choose bets; and at the quarterly review, whether they tell it straight, and why.
- At the VP, the first quarters: whether they notice that their first team is now the leadership team (the CEO and two peer VPs), that their divisions are seen only through their directors, that headcount comes from a budget the leadership team divides, and that each quarter ends with an all-hands to the whole function; and whether they act for the function or the company when the two pull apart.
- Habits from the level before they look for and don't find, and the new ones they try, including handing new work to a team with room.
- Anything they say sounds like "the same thing with more people".

**Ask afterwards**
- What changed when you were promoted?
- What did you stop doing?
- What did you have to learn that you didn't do before?
- Did your old team, or group, feel different once someone else was leading it?
- After the second promotion or later: what changed this time, and was it more or less of a change than the one before?
- If they weren't promoted: skip these and record "not reached".

### Skill can be learned

The HLD: situations have better and worse choices, and a player who learns from earlier runs does better in later ones. One session shows only the first run, so this asks what the player learned.

**Watch for**
- Changes in how they play as the run goes on: habits they change, choices they stop making.

**Ask afterwards**
- What would you do differently if you started again?
- What did the game teach you about running a team, if anything?
- Did the better choices feel like good management to you, or like guessing what the game wanted?

## Record sheet

Copy this for each session.

```
Date:
Version (from the start screen):
Player background (manages people / has been managed / neither):
Minutes played:          Weeks reached:          Ending, if any:

A promotion in the first session:
  Reviews (week, rating):
  Promoted? At what week and minute:

Bad outcomes can be traced:
  Bad outcomes seen:
  Explained by an earlier decision? Which:

Choices feel consequential:
  Choices they called out as mattering:
  People bringing past choices up, as they noticed:

It feels like a game, not a test:
  Words they used for it:
  Most fun / most tedious:

Promotion changes the job, to senior manager (session ___; or "not reached"):
  Promoted at week:          Months played at the new level:
  What they said changed:
  What they stopped doing:
  What they had to learn:
  "The same thing with more people"? Their words:

Promotion changes the job, to director (session ___; or "not reached"):
  Promoted at month:         Quarters played at the new level:
  What they said changed:
  What they stopped doing:
  What they had to learn:
  "The same thing with more people"? Their words:

Promotion changes the job, to VP (session ___; or "not reached"):
  Promoted at quarter:       Quarters played at the new level:
  What they said changed:
  What they stopped doing:
  What they had to learn:
  "The same thing with more people"? Their words:

Skill can be learned:
  What they would do differently:

Bugs, and questions they asked:

Later sessions, if any: for each, the date, minutes played and how the run was carried over:
```

## Comparing with the scorecard

Run `npm run playtest` on the same version (or `PLAYTEST_URL=https://www.manager-simulator.io/ npm run playtest` against the live site), open the report with `npx playwright show-report`, and read the first-timer's scorecard. Its headings match the ones above. Under *Promotion changes the job*, the scorecard lists, for each promotion, the panels, habits and kinds of moment that stopped and started appearing at it: set what players named beside it, and note what they named that it doesn't list, and what it lists that nobody noticed. Where the people disagree with the scorecard, for example a scorecard that shows every quit was flagged on the card but players who were surprised by quits, record it: that is how the scorecard's proxies are calibrated (see the design's *Open Questions*).
