---
node: high-level-design
---

# Decision: The senior manager acts through managers

## Context

This builds on [The week as a run of moments](moments-loop.md), which kept room for each career level to be a different game, and on the HLD's career levels: a senior manager manages line managers across several teams, a turn is a month, and on promotion the previous level's mechanics are retired or folded into aggregates.

The line manager level plays as moments with engineers who are characters. The senior manager level has to feel like a new job, not that game with more people: the HLD's success metrics name "the same thing with more people" as the sign that the per-level design has failed. The simulation core already supports what a level above the line manager needs: teams that are aggregate summaries instead of individuals, team leaders, moving people and projects between teams, re-rating heads within an aggregate team for calibration, and a month as a time step.

## Decision Elements

- **A new job** — *major* (tenet: *A fresh role over a continuous system*). Whether a promoted player can name things they no longer do and things they now have to learn.
- **People first** — *major* (tenet: *Show it through people over through numbers*). Whether the level is still played through characters and their reactions, not through numbers.
- **Engagement** — *major* (tenet: *Fun over authenticity in pace and process*). Whether a month still plays as scenes with reactions, not as a planning screen; the moments-loop decision rejected the planner because it read as a test.
- **Fidelity to the job** — *moderate*. Whether the HLD's senior manager duties are present: coaching and delegating to managers, calibration, approving promotions and terminations, restructuring, staffing across teams, cross-team dependencies and disputes, escalations.
- **Learnability** — *moderate* (tenet: *Learnable over ambiguous*). Whether better choices can be designed and seen to pay off.
- **Build cost** — *moderate*. How much is new rather than reused from the line manager level and the simulation core.

## Options in the Domain

### Managers as your people

The player manages three or four line managers. Each is a full character, with a personality, memory, trust and wants, and a management skill in place of an engineer's technical one. Each leads a team the player sees only as an aggregate: headcount, skill, motivation, stress and attrition risk. A month is a run of moments: 1:1s with managers, escalations a manager brings, staffing requests, disputes between teams. The player never acts on an engineer directly; every effect on a team goes through its manager, and lands according to that manager's skill and trust. Habits become how closely the player manages each manager, how they staff, and how they run calibration, which becomes the level's own quarterly mechanic.

- **A new job — strong.** No engineer is ever acted on directly; coaching, calibration and staffing are new to the player.
- **People first — strong.** The managers are the characters; teams stay numbers, which is what a senior manager sees of them.
- **Engagement — strong.** The moments loop, recap and habits carry over as a frame filled with new content.
- **Fidelity to the job — strong.** Every listed duty fits as a habit, a mechanic or a moment.
- **Learnability — strong.** Acting through a manager, and whether to coach, delegate or step in, gives clear better choices.
- **Build cost — partial.** Reuses the character system and aggregate teams; needs management skill, the effect of a manager on their team, a new level module, renderer and content.

*Summary:* the new job the HLD asks for, played through people, at a moderate build cost; its risk is reading as the first level with managers in place of engineers.

### The organization as a system

Teams are units on a board, each with a project portfolio, headcount, dependencies and delivery risk. The player's main lever each month is allocation: who works on what, where headcount goes, which priorities win. Managers are names with a trait; crises arrive as situations.

- **A new job — strong.** Allocation across a portfolio is plainly a different activity.
- **People first — weak.** Numbers lead; people appear only in situations.
- **Engagement — weak.** The monthly board is a planning screen, the activity the moments-loop decision found exam-like.
- **Fidelity to the job — partial.** Staffing and dependencies are central; coaching managers mostly disappears.
- **Learnability — strong.** Allocation decisions are easy to score.
- **Build cost — partial.** New board UI and allocation model; little reuse of the character system.

*Summary:* clearly a new job and easy to balance, but it leads with numbers and brings back the planning screen.

### Player-coach

The player keeps leading their original team directly, now through a team lead, and takes on two more teams through their managers.

- **A new job — weak.** Most of the player's time is still spent on the first level's team.
- **People first — strong.** The original engineers stay characters.
- **Engagement — strong.** The first level's loop carries over.
- **Fidelity to the job — partial.** Realistic for a first senior role, but most senior duties are a side line.
- **Learnability — strong.** The first level's better choices carry over.
- **Build cost — strong.** Mostly reuses the line manager level.

*Summary:* the cheapest and most realistic transition, and the most likely to be described as the same thing with more people.

## Selection

**Managers as your people.** It is the only option strong on all three major criteria. *A fresh role over a continuous system* rules out the player-coach, which keeps the player doing the first level's job. *Show it through people over through numbers* and the moments-loop decision rule out the organization as a system, whose main activity is a planning board. The staffing and dependency decisions that the system option centres are kept, as moments rather than a board.

Its risk, reading as the first level with managers in place of engineers, is guarded by two commitments: the player never acts on an engineer directly, and managers bring moments of their own kinds (escalations, coaching, disputes between teams) rather than the first level's work moments.

Committing obligates:
- a management skill for people who lead teams, and a rule for how a manager's skill and the player's trust with them shape what happens to their team;
- a senior manager level module, with its habits, moments, review measures and calibration;
- a handover that converts a promoted line manager run: the player's old team gets a leader and becomes one of the aggregate teams they oversee;
- a renderer for the level's panels and moments;
- senior manager situation content, written about managers and teams;
- balance strategies for the new level;
- the success-metric playtests' *Promotion changes the job* measure.

It forecloses acting on individual engineers at the senior manager level, except through situations about them that a manager brings.
