---
node: high-level-design
---

# Decision: The director runs an organization through senior managers and quarterly bets

## Context

This builds on [The senior manager acts through managers](senior-manager-shape.md), which made the second career level a game played through line managers who are characters, and on the HLD's career levels: a director manages senior managers across an organization, a turn is a quarter, and the director's duties are headcount budget, org design, seating and space, strategy bets, executive politics and presentations, culture and belonging, volunteering and specialty groups, and marketing the organization. Presentations exist as a mechanic only from this level up. Director and above spans several career levels; this decision shapes the director, the first of them, and leaves room for the levels above it to be different games again.

The HLD's success metrics ask that each promotion feel like a new job: a promoted senior manager must be able to name something they no longer do and something they now have to learn. The senior manager level's own risk was reading as the first level with managers in place of engineers; the director's equivalent risk is reading as the senior manager with bigger numbers.

## Decision Elements

- **A new job** — *major* (tenet: *A fresh role over a continuous system*). Whether a promoted senior manager can name things they no longer do and things they now have to learn.
- **People first** — *major* (tenet: *Show it through people over through numbers*). Whether the level is still played through characters and their reactions, not through numbers.
- **Engagement** — *major* (tenet: *Fun over authenticity in pace and process*). Whether a quarter still plays as scenes with reactions, not as a planning screen; the moments-loop decision rejected the planner because it read as a test.
- **Fidelity to the job** — *moderate*. Whether the HLD's director duties are present: headcount, org design, strategy bets, executive politics and presentations, culture.
- **Learnability** — *moderate* (tenet: *Learnable over ambiguous*). Whether better choices can be designed and seen to pay off.
- **Room above** — *moderate*. Whether the levels above the director can still be a different game.
- **Build cost** — *moderate*. How much is new rather than reused from the senior manager level and the simulation core.

## Options in the Domain

### Senior managers as your people, the organization as quarterly bets

The player leads three or four senior managers, each a full character, whose groups are shown only as aggregates, two steps removed: no team inside a group is visible. A quarter is a run of moments of kinds no earlier level has: dividing a fixed number of heads among the groups at the start of the quarter; choosing which strategy bets to fund, which pay off or fail over later quarters depending on how well the groups carrying them are staffed and led; a quarterly review presented to the player's executives, where how honestly bad news is framed moves reputation and surfaces later; and org design, splitting, merging or re-chartering groups. The player's boss and one or two peer directors are characters too, so the job faces upward as well as down. Habits become how the player splits their time between the executives and their own organization, how they run their staff meeting, and skip-level listening.

- **A new job — strong.** Budget, bets and presenting upward are new; coaching individual managers and running calibration are retired into the senior managers' hands.
- **People first — strong.** Senior managers, the boss and peers are the characters; groups stay numbers, which is what a director sees of them.
- **Engagement — strong.** The moments loop, recap and habits carry over as a frame filled with new content.
- **Fidelity to the job — strong.** Headcount, org design, bets, presentations and executive relationships are each a moment or a mechanic; culture and belonging fit as situations and goals.
- **Learnability — strong.** Funding bets the organization can carry, framing bad news honestly, and staffing to strategy give clear better choices.
- **Room above — strong.** Executive politics enters as one strand; a level above can make it the main game.
- **Build cost — partial.** Reuses the character system, aggregates and the moments frame; needs aggregate groups of aggregate teams, a headcount budget, strategy bets, the presentation mechanic, a new level module, renderer and content.

*Summary:* the new job the HLD asks for, still played through people, at a moderate build cost; its risk is reading as the senior manager with bigger numbers.

### Upward and outward

The player's main characters are their boss and peer directors. The core activity is executive politics: winning headcount in quarterly planning against peers, building coalitions for bets, presenting, and guarding the organization's reputation. The senior managers are lighter characters, and the organization is a handful of health and delivery numbers that the player's political wins and losses feed.

- **A new job — strong.** Facing upward is plainly new.
- **People first — partial.** Peers and the boss are characters, but the organization the player runs becomes numbers.
- **Engagement — strong.** Negotiation and presentation scenes play well as moments.
- **Fidelity to the job — partial.** Executive politics is central; running the organization mostly disappears.
- **Learnability — weak.** Politics resists clearly better choices without reading as cynical or arbitrary.
- **Room above — weak.** It uses up the strand a VP level would most naturally be built on.
- **Build cost — partial.** New negotiation and coalition mechanics; little reuse of the organization model.

*Summary:* the most clearly new job, but it lets the organization fade into numbers and spends the levels above's best material now.

### The portfolio

The organization is a board of groups and bets. Each quarter the player allocates headcount and budget across groups and strategy bets and approves org changes. Senior managers are names with a trait; drama arrives only as situations.

- **A new job — strong.** Allocation across a portfolio is plainly a different activity.
- **People first — weak.** Numbers lead; people appear only in situations.
- **Engagement — weak.** The quarterly board is a planning screen, the activity the moments-loop decision found exam-like.
- **Fidelity to the job — partial.** Budget and bets are central; executive politics and people mostly disappear.
- **Learnability — strong.** Allocation decisions are easy to score.
- **Room above — partial.** A level above would need another way to differ from a bigger board.
- **Build cost — strong.** A board UI and an allocation model, with little else.

*Summary:* clearly a new job and the cheapest to build and balance, but it leads with numbers and brings back the planning screen, for the reasons the senior manager decision already rejected it.

## Selection

**Senior managers as your people, the organization as quarterly bets.** It is the only option strong on all three major criteria. *Show it through people over through numbers* and the moments-loop decision rule out the portfolio, as they ruled out the allocation board at the senior manager. *Show it through people* also weighs against upward and outward, which lets the organization the player runs fade into numbers; its best material, the boss and peers as characters and presenting upward, is kept as one strand of the chosen option, and the rest is left for the levels above.

Its risk, reading as the senior manager with bigger numbers, is guarded by three commitments: headcount, strategy bets and presentations are the level's main levers, not coaching; calibration and coaching individual managers are the senior managers' work, which the player sees only in its results; and the player's boss and peers are characters whose moments face upward, which no earlier level has.

Committing obligates:
- an organization of groups, each an aggregate of teams led by a senior manager, and a rule for how a senior manager's skill and trust shape their group;
- a headcount budget and strategy bets in the simulation, with outcomes that resolve over quarters;
- a presentation mechanic for the quarterly review to executives;
- the boss and peer directors as characters;
- a director level module, with its habits, moments, review measures and goals;
- a handover that converts a promoted senior manager run: the player's old group gets a senior manager and becomes one of the groups they oversee;
- a renderer for the level's panels and moments;
- director situation content, written about senior managers, groups, executives and peers;
- balance strategies for the new level, and the playtests' scripted players at it.

It forecloses acting on individual teams or line managers at the director level, except through situations a senior manager brings.
