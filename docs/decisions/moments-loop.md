---
node: high-level-design
---

# Decision: The week as a run of moments

## Context

This builds on [Simulated organization with authored situations](simulation-and-situations.md): the simulation produces state, and authored situations produce drama.

How a week plays decides what the player spends their time doing, and so whether the game feels like a game. One way is a planning screen: the player schedules actions in a calendar, decides each inbox item, then reads the week's situations. Built that way, a line manager game plays correctly but reads as a multiple-choice exam. Each situation is a paragraph and some buttons. People are rows in a table. Consequences happen in numbers the player has to compare. And most of a turn is clerical clicking. The moments that land, in play, are the short reactions after a choice. The structure of the week shapes the career levels, the situation engine, the turn loop, the UI, the content and the balance checks, so changing it later means rebuilding most of what the player touches.

## Decision Elements

- **Engagement** — *major* (tenet: *Fun over authenticity in pace and process*). Whether a week feels like playing a game rather than filling in a form or sitting a test.
- **Traceable consequences** — *major*. Whether the player can see what their choices did, at once and later, and connect a bad outcome to the choice behind it.
- **Learnability** — *major* (tenet: *Learnable over ambiguous*). Whether better choices can be designed, recognised and seen to pay off.
- **Proactive play** — *moderate*. Whether the player shapes how the team runs, not only reacts to what arrives. A loop where every decision is a reaction to something that happened plays as triage.
- **Fidelity to the job** — *moderate*. Whether the line manager's real work, people work and the delivery and operations duties that compete with it, stays present.
- **Room for distinct levels** — *moderate* (tenet: *A fresh role over a continuous system*). Whether higher career levels can still be a different game, not the same loop with more people.
- **Build and rework cost** — *moderate*. Engineering effort, given a working planner-based line manager level.
- **Writing cost** — *moderate*. How much content a week of play needs.

## Options in the Domain

### A week as a run of moments

A week plays as a short sequence of **moments**: Monday standup, someone at your desk, a 2 a.m. page, a stakeholder email, Friday's 1:1. Each moment is a small scene with a few choices, and every choice gets an **immediate, characterful reaction** and visible changes. People have a **personality** that colours how they react, and a **memory** of what happened between you, which later moments bring up ("you asked on Monday, so I figured I'd say it"). Routine work is handled by a few standing **habits** the player sets and adjusts (who takes night pages, whether Fridays are kept for 1:1s, who signs routine approvals). Only interesting work becomes a moment. The week ends with a **recap** of what changed and why. Each quarter has a few **goals** from the player's own manager.

- **Engagement — strong.** The player's time is spent in scenes and reactions, which is the part of play that lands. A hand-built mockup of one week was judged to feel like a game.
- **Traceable consequences — strong.** Reactions show effects at once, the recap names causes, and callbacks tie later moments to earlier choices.
- **Learnability — strong.** Each moment can have a better choice, and memory makes it pay off later where the player can see it.
- **Proactive play — partial.** Habits and quarterly goals give standing control over how the team runs. The rest of the play responds to moments, as an all-reactive loop does.
- **Fidelity to the job — strong.** Delivery and operations work stays, as moments and as what habits handle; people work becomes more central.
- **Room for distinct levels — strong.** Moments, habits and recaps are a frame that each level fills differently. A senior manager's moments are about managers and teams, and their habits are policies.
- **Build and rework cost — weak.** It replaces the line manager's calendar and inbox, most of the UI and the balance strategies, extends the situation engine and the turn loop, and adds personality to the simulation.
- **Writing cost — weak.** Many short moments per week, with reactions that vary by personality and with follow-ups, need a lot of writing.

*Summary:* the most engaging and the most legible, at the highest rebuild and writing cost.

### Keep the planner, add life

Keep the calendar and inbox as the week's main activity. Add an end-of-week recap, people shown as cards with a mood and a short history, a reaction to every action, follow-up situations that call back to earlier choices, and quarterly goals.

- **Engagement — partial.** Feedback and characters improve the experience, but most of the player's time is still per-item planning, which plays as clerical work.
- **Traceable consequences — strong.** Recaps and follow-ups surface causes as well as the other options do.
- **Learnability — strong.** The existing better-choice design carries over unchanged.
- **Proactive play — strong.** The calendar is direct, proactive control of the week.
- **Fidelity to the job — strong.** Every duty stays as an action or a demand.
- **Room for distinct levels — partial.** Other levels can change the panels, but the planning interaction tends to stay the same at every level.
- **Build and rework cost — strong.** Additions to working systems; little is replaced.
- **Writing cost — partial.** Follow-ups and reactions add writing, on top of the existing situations.

*Summary:* cheapest and keeps direct control, but the activity found exam-like stays at the centre.

### Relationships at the centre

Each engineer has an arc across the run: a struggling junior, a flight risk, a rising star. A week is mostly about whom the player spends time with and how. Delivery and operations pressure is reduced to a single meter that rises when the team is neglected.

- **Engagement — strong.** Character arcs are the most emotionally engaging structure.
- **Traceable consequences — strong.** Arcs make cause and effect personal and visible.
- **Learnability — partial.** People lessons are clear; delivery and operations lessons shrink to managing one meter.
- **Proactive play — strong.** Choosing whom to invest in is the core activity.
- **Fidelity to the job — weak.** Delivery and operations work, half of a line manager's job and the main source of its pressure, mostly disappears.
- **Room for distinct levels — partial.** Arcs suit the line manager; at levels managing managers and organizations, a relationship-centred loop fits less well.
- **Build and rework cost — weak.** A different simulation emphasis and a new content structure.
- **Writing cost — weak.** Arcs need long, branching writing per character.

*Summary:* the most emotionally engaging, at the cost of half of the job the game is about.

## Selection

**A week as a run of moments.** It is the only option strong on all three major criteria. Engagement, which comes from *Fun over authenticity in pace and process*, rules against keeping the planner, because the activity found exam-like would stay the player's main occupation. Learnability, from *Learnable over ambiguous*, and fidelity to the job rule against centring relationships, which drops the delivery and operations half of the role. The mockup of one week confirmed the engagement judgement in play, and showed that memory between moments carries the experience.

Its weak fits are traded away knowingly. The rebuild cost is accepted because the planner's problem is its core activity, not its presentation. The writing cost is accepted because writing is already the game's main source of drama under the simulation-and-situations decision. Proactive play is only partial, so habits and quarterly goals have to carry real weight; without them, the loop would become pure triage.

Committing obligates:
- personality in the simulation's people;
- a place in the week for each situation, and reactions that vary by personality;
- a turn loop that plays a week one moment at a time and ends it with a recap;
- habits and energy in place of the line manager's calendar and inbox;
- a UI built around scenes, people and the recap;
- balance strategies rewritten for habits and moments;
- a much larger body of short, reactive content.

It forecloses per-item planning of the week as the main activity at the line manager level.
