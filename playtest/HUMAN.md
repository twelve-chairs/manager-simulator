# Running a Human Playtest

This is the script for one playtest session: one player, one facilitator, 30 to 60 minutes. Each heading below is one of the HLD's success metrics (`docs/high-level-design.md`, *Success Metrics*). The scripted players in `metrics.playtest.ts` measure a proxy for the same metrics under the same headings, so you can compare a round of sessions with the scorecard for the same version (see *Comparing with the scorecard*).

## Setup

- **The game:** the live site, https://twelve-chairs.github.io/manager-simulator/, in a fresh browser profile or a private window, so no earlier run is loaded.
- **The version:** write down the version from the bottom of the start screen ("Version v0.1.61 (07ccf45)") before the player starts.
- **The player:** someone who hasn't played before. Note whether they manage people, have been managed, or neither; don't screen anyone out.
- **Time:** let them play for up to 60 minutes. Stop earlier if they want to stop, and note when and why.
- **Think aloud:** ask them to say what they're thinking as they play: what they expect a choice to do, and what they make of what happens.
- **Don't coach.** Don't explain the game, suggest a choice or answer how something works. If they ask, say "What do you think?" and note the question. The only exception is a bug that blocks play: note it, and help them past it.
- **Take notes** with the week number from the header, so a note can be matched with what was on screen.

## Metrics

### A promotion in the first session

The HLD: playtesters complete at least one promotion in their first session.

**Watch for**
- The week and the time on the clock at each review, and its rating.
- Whether they reach a promotion before stopping, and when. Promotion is possible from the third review (week 39) on, after two strong reviews in a row; How to play says so, but don't point them to it.
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

**Ask afterwards**
- What was the worst thing that happened in your run?
- Why do you think it happened?
- Was there a moment when you saw it coming? What did you see?

### Choices feel consequential

The HLD: every choice gets a reaction at once, and people bring past choices up later.

**Watch for**
- Whether they read the reactions or click straight past them.
- Moments when they notice someone remembers something ("she's still upset about...").
- Choices they make without reading them.
- Whether they open *The whole week* in the weekend recap, and what they were looking for when they did.

**Ask afterwards**
- Tell me about a choice that turned out to matter.
- Did anyone on your team bring up something you'd done earlier?
- Were there choices that didn't seem to matter? Which ones?
- Did the weekend recap tell you what you needed before the next week?

### It feels like a game, not a test

The HLD: playtesters describe a session as playing a game. If they describe it as answering questions or taking a test, the moments loop has failed.

**Watch for**
- Words they use for the experience while playing: "game", "story", "quiz", "test", "form".
- Repetition they comment on ("this again").
- Moments of enjoyment or frustration, and what was on screen.

**Ask afterwards**
- How would you describe what you just did to a friend?
- What was the most fun part? The most tedious?
- Did anything feel like being tested? When?

### Promotion changes the job

The HLD: playtesters asked "what changed when you were promoted?" name concrete mechanics, not only bigger numbers. Only one career level is playable so far, so this needs a player who was promoted in their run.

**Watch for**
- How they react to the promotion, and what they expect next.

**Ask afterwards**
- If they were promoted: what do you expect to change in the new job? What would you stop doing?
- If they weren't: skip this metric and record "not reached".

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

Promotion changes the job:
  What they expect to change (or "not reached"):

Skill can be learned:
  What they would do differently:

Bugs, and questions they asked:
```

## Comparing with the scorecard

Run `npm run playtest` on the same version (or `PLAYTEST_URL=https://twelve-chairs.github.io/manager-simulator/ npm run playtest` against the live site), open the report with `npx playwright show-report`, and read the first-timer's scorecard. Its headings match the ones above. Where the people disagree with the scorecard, for example a scorecard that shows every quit was flagged on the card but players who were surprised by quits, record it: that is how the scorecard's proxies are calibrated (see the design's *Open Questions*).
