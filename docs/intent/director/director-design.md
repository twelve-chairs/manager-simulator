---
parent: high-level-design
prefix: DIR
---

# Director Level

## Context and Design Philosophy

The director level is the third career level: the player runs an organization of three groups, each led by a senior manager, a quarter at a time. Following the HLD's decision that [the director runs an organization through senior managers and quarterly bets](../../decisions/director-shape.md), the senior managers are the player's people, full characters as line managers are at the second level; each group is one aggregate, a few numbers. Above and beside the player are characters of a kind no earlier level has: their own manager, an executive, and two peer directors. A quarter is a run of moments filled with a director's work: dividing the quarter's headcount, choosing which strategy bets to fund, reshaping groups, keeping peers on side, and presenting the quarter to the executive.

The level's core tension is between the organization and the room above it. Time spent with executives and peers earns headcount, backing for bets and reputation; time spent with the organization keeps its groups healthy and its senior managers growing. The second level asked whether to do a manager's job or grow them into it; this level asks how much of the job faces up, and whether to tell the room above what is really happening.

Four principles shape it:

- **Through senior managers, never around them.** Every effect on a group goes through its senior manager and lands according to their management skill and trust in the player. The line managers and teams inside a group are gone from view; situations may mention them by name, but a senior manager brings them.
- **The numbers come late.** A director sees delivery as it happens but the organization's mood only through the engagement survey, taken twice a year. Between surveys, a group's motivation and stress show as they were last measured; a listening tour shows one group as it is now.
- **Honesty upward pays later, and spin costs later.** The quarterly review presentation is where the player chooses how to tell the quarter. Spinning a bad quarter earns reputation now and costs more when the problem surfaces.
- **A fresh role.** Following the HLD's tenet, the second level's mechanics are retired, not scaled up: no oversight habit per manager, no backfill habit, no calibration scene, no approvals of single promotions. Calibration is the senior managers' work now, seen only in its results. What carries over is the frame (moments, habits, the recap, energy, goals) and the character system.

## The Organization

The player leads three **groups**. A group is one aggregate team in the simulation core, led by a senior manager: the teams it was made of are folded into it (see the simulation core's *Team*). Each group carries two or three projects, sized for a group: a project's scope follows from its deadline, so a healthy group lands it near the deadline and a stretched one misses. A strategy bet is sized the same way.

A senior manager is a person with the role `manager`, whose `skill` is their management skill. Like the second level's managers, each has a personality, motivation, stress, trust in the player, a want, a memory and a leniency, which now shapes the ratings their group's calibration produces.

Outside the organization are three people the simulation core holds with no team: the player's **executive**, who sets the quarter's headcount, offers strategy bets, hears the quarterly review and rates the player; and two **peer directors**, whose organizations depend on the player's and whose support the player's bets need. Each has a personality, a want, trust in the player and a memory.

The organization can change shape through org design moments (see *A Quarter's Moments*): a group can be split in two, or merged into another, using the simulation core's head moves and team closing.

## The Handover

A run reaches this level when a senior manager review promotes the player. Before the level begins, the player makes one last call: **who leads their group now**. The choices are each of their line managers, shown with their management skill, trust in the player and want, and an outside hire.

- A line manager chosen becomes the group's senior manager. Their management skill, trust and want carry over, and the group forms around the team they led.
- An outside hire starts as a *capable* senior manager with neutral trust, leading the group formed around the first team, whose own manager joins it as one of its people; the group's stress rises for a quarter as it adjusts.

The level then converts the run: the player's teams are folded into one group led by the new senior manager, keeping their projects; two more groups join, each generated with a senior manager, headcount, projects and health; the executive and two peers are added outside the organization; and the player's energy, reputation and own rating history carry over. The player's old managers become heads in their group; their histories stay in the state for situations and debriefs to cite.

## Visibility

- **Senior managers** appear as cards, as managers do at the second level: name, personality, motivation and stress as words, management skill as a band, their want once a staff meeting has revealed it, their memory, and their group's name.
- **Groups** appear under their senior manager's card: headcount and each project's schedule as they are now; motivation, stress and attrition risk as the last engagement survey measured them, with the survey's quarter. A listening tour shows a group's current values for the quarter it visits.
- **Upward** is a panel of its own: the executive and the two peers as cards, with trust in the player as a word, their want once known, and their memory.
- **Bets** appear in a panel of their own: each funded bet, the group carrying it, its schedule, and what is at stake if it lands or fails.

## Habits

| Habit | Options | Effects |
|---|---|---|
| **Where your time goes** | Your organization; balanced (default); upward | Upward time raises the executive's and peers' trust each quarter and makes the next quarter's headcount larger; the groups miss the player, and their motivation drifts down. Time with the organization lifts the groups' motivation and the senior managers' trust, and the room above trusts the player a little less each quarter. |
| **Staff meeting** | Weekly (default); fortnightly | As 1:1s are at the earlier levels, for the senior managers together: builds trust and reveals each one's want; weekly costs more energy. |
| **Listening tour** | None (default); quarterly | Each quarter, the player spends time inside one group, rotating through them: shows its current health and surfaces one problem its senior manager hasn't raised. Costs energy. |

## How Senior Managers Shape Their Groups

Each quarter, the level moves each group's motivation and stress toward what its senior manager's management skill can sustain, as the second level does for teams, with magnitudes scaled to a quarter. Moments the player handles by coaching raise a senior manager's skill; taking a decision out of their hands solves it and teaches them nothing.

Each group's ratings are calibrated by its senior manager before each review, without a scene: the group's ratings move toward what it delivered, and the senior manager's leniency shifts them up. A group whose senior manager runs lenient carries ratings above its delivery, and its people notice: the group's motivation falls with how far its ratings stray, which the next survey finds. The review does not score calibration itself, since the player has no hand in it; a player who sees a group's motivation fall can coach or replace its senior manager.

## A Quarter's Moments

A quarter is a run of moments across its thirteen weeks, more than a month holds at the second level, since each turn covers more. The level makes them from the organization's state, up to a cap:

- **Headcount planning**, at the start of every quarter: the executive gives the player a number of new heads, larger with the executive's trust and the player's reputation. The player places them, beside each group's stress as last seen and its projects, or gives them all to the most stretched group, which the choice names, judged as the player last saw the groups: in a group, which grows by that many unrated heads and carries their onboarding stress for a quarter; behind a bet, which speeds it; or held back, which the executive notices.
- **Strategy bets**, at the start of each half: the executive offers two or three bets, each a project with a stake. The player funds up to two and names the group to carry each, or funds none. A bet that lands by its deadline raises reputation and the executive's trust; one that fails, or is quietly dropped, lowers both. A bet carried by an overloaded or struggling group is likely to fail; one backed by a peer whose organization it touches lands more easily.
- **Quarterly review**, at the end of every quarter: the player presents the quarter to the executive. Lead with what went wrong and the plan; lead with the wins; promise more next quarter. Telling it straight costs a little reputation in a bad quarter and builds the executive's trust; leading with the wins earns reputation now, and if a problem left out surfaces the next quarter, as a bet or project in trouble, the executive's trust and the player's reputation fall further than the truth would have cost; promising more raises the stakes of every funded bet.
- **A peer's ask**: a peer needs something from the player's organization, a dependency moved up or heads lent. Agree, which costs a group stress and earns the peer's trust; negotiate a trade, which works with a peer who trusts the player, and with one who doesn't lands as a refusal, as the choice and its reaction say, since otherwise a player who always trades can't see why a guarded peer stays guarded; refuse, which costs the peer's trust. A peer who trusts the player little raises it with the executive in a later moment. An ask comes at most every other quarter, so it stays an event rather than a fixture of every quarter.
- **A group in trouble**: a senior manager brings a group whose health or delivery is failing. Coach them through it; take the decision yourself; replace them. Coaching works when the senior manager's skill is at least *developing*; taking the decision fixes the quarter and costs their growth and trust; replacing them leaves the group without a leader until a new one is set.
- **A problem from the listening tour**: the quarter after the tour visits a group, what its people raised that their senior manager hasn't brought to the player, named: the most pressing of the group's troubles as it is now (a project behind schedule, strained stress, people looking around, motivation gone), else one of the everyday frictions of running a group of teams. Some frictions are the senior manager's to settle (planning run differently in every team, an on-call rota leaning on the same few people) and some sit above them (headcount promised and never arrived, goals that pull against another organization's), and the moment says so of those. The same three answers as a group in trouble; coaching a senior manager through one that sits above them, however skilled, settles nothing, and the reaction says it wasn't theirs to fix: only taking the decision yourself does.
- **Org design**: a group has grown past a size one senior manager can lead well, or shrunk below one worth a senior manager. Split it, promoting one of its line managers or hiring a senior manager for the new group; merge it into another group; leave it. Splitting and merging move heads with the simulation core's head moves; the group left empty is closed.
- **Final evaluation**: a senior manager on an improvement plan whose third low rating is due: let them go, or one more period.
- **A stay conversation**: a senior manager is restless, as at the second level: in the quarter's first week, they say what would keep them, and the player now knows their want. Give it to them, at a cost in energy, which settles them; or wish them well, and they leave when their notice runs. Letting it wait is the same as wishing them well.
- **A new senior manager**: the quarter after a group is left without one, promote one of its line managers or hire from outside, as at the second level.

Authored situations add written drama on top, tagged for this level and written about senior managers, groups, the executive and the peers: culture and belonging, seating and space, specialty groups and volunteering, marketing the organization, executive politics. As at the second level, their effects never lower a group's headcount, which the level counts as attrition.

## Senior Managers' Plans

As at the second level: a senior manager rated low on what their group delivered and how it fared under them, for two periods in a row, goes on an improvement plan; a third low rating is held for a final evaluation. Letting one go leaves their group leaderless until the new-senior-manager moment sets one.

## The Period's Goals

At the start of each review period, the executive sets two or three goals for it, drawn from the organization's state: land a named bet, lose no more than a tuned few of the people you would have kept, lift a group out of the strained band at the next survey, keep a named peer's trust at *trusting* or better. Their progress shows all period, and they are scored at the review as extra measures.

## The Recap

Each quarter ends with a recap, folded as the earlier levels' are: what changed first (senior managers whose bands moved, a new survey's results, heads who left or joined, who left: each senior manager who quit, with what led to it, and each group that lost heads during the quarter, with how many of them the player would have kept, asked of the level after the quarter's advance since losses happen during it; bets that moved, how the room above took the quarter), and the quarter's moments, the habits' routine and the goals folded into *The whole quarter*.

## Scorecard, Reviews and the End of the Level

- **Cadence**: a turn is a quarter of thirteen weeks. Reviews come every two quarters, after the second, fourth and so on, counting from the start of this level. The engagement survey is taken in the last quarter before each review.
- **Scorecard**: strategic outcomes (bets landed against the bets whose results came in during the period, so a bet still running counts for nothing yet, and projects shipped on time); retention and health (regretted attrition, and the groups' motivation and stress as surveyed); and the executive's confidence (the executive's trust in the player). The period's goals are added as measures.
- **Promotion**: possible from the third review (quarter 6), when the performance review rates the player highly enough twice in a row.
- **The last review**: the sixth, at quarter 12. A player not promoted there has stayed a director, and the run ends.
- **Burnout**: two quarters in a row ending at the edge.
- **Managed out**: as at the earlier levels.
- **Promotion past this level**: hands the run to the [VP level](../vp/vp-design.md) through its handover.

A quarter should take about eight to ten estimated minutes to play, by the success-metric playtests' session clock, so a promotion at quarter 6 comes about an hour into the level.

## Turn Loop Contract

The level provides the turn loop's career level contract with a time step of thirteen weeks, and the handover step the loop calls when a senior manager review promotes the player (see *The Handover*).

## Level State

The senior managers' leniency, the habits, the quarter's moments and their status, the funded bets with their groups and stakes, the headcount given and placed, what each quarterly review left out and whether it has surfaced, the last survey's results per group, the listening tour's rotation, plans, goals, and the counters burnout and reviews need. Management skill, trust, motivation, the groups' health, projects and the outside people live in the simulation core.

## Effects Beyond This Level

Committing to this level changes other segments, each walked through its own design when built:

- **Turn loop**: a senior manager promotion continues the run at the director level through its handover.
- **UI**: a renderer for this level's panels (senior managers and groups, upward, bets) and moments, the headcount and bets scenes and the quarterly review; the start screen's career ladder shows the director rung as playable.
- **Balance**: strategies for this level, including how sound practice and naive play (all time upward, spin every review, fund every bet) fare.
- **Success-metric playtests**: scripted players at this level, and *Promotion changes the job* across the second promotion.
- **Situation content**: situations for this level.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Size of the organization | Three groups, changed by splitting and merging | Four or more groups; a fixed shape | Three senior managers are few enough to know as characters, as three managers are at the second level; org design is a director's duty, so the shape should be the player's to change. |
| Who leads the old group | The player chooses: one of their line managers, or an outside hire | Always an outside hire | Mirrors the second level's handover; growing a line manager into a senior manager is a choice with consequences the player can trace. |
| How the organization's mood is seen | The engagement survey, twice a year; a listening tour shows one group now | Groups as their senior managers report them, as at the second level; always the true numbers | Reported numbers would repeat the second level's mechanic; a survey is how a director actually sees morale, and its lag makes listening worth its cost. |
| Calibration | Done by the senior managers, seen in its results | A calibration scene as at the second level; an org-wide distribution the player sets | Running calibration was the second level's distinctive duty; repeating it would make this level the same thing with more people. Leniency still matters through the group's motivation, which the survey shows; the review does not score calibration, since a measure the player cannot act on teaches nothing. |
| The executive and peers | Characters outside the organization, with trust in the player | Reputation alone; peers as names in situations | The job faces upward as much as down; trust held by people makes executive politics a matter of relationships, which situations and moments can show through people. |
| The quarterly review presentation | A moment each quarter: straight, wins first, or promise more, with spin found out when its problem surfaces | A presentation mini-game; a fixed report | Presentations are a director's mechanic in the HLD; choosing how to tell the quarter is the decision, and delayed consequences make honesty learnable without a lecture. |
| Headcount | Given each quarter by the executive, placed by the player | A budget set once a year; heads that arrive without a choice | A quarterly allotment ties headcount to the player's standing above and makes placing it a recurring decision. |
| Cadence | Quarterly turns, reviews every two quarters, promotion from the third, last review the sixth | Yearly reviews; reviews every quarter | Matches the earlier levels' shape (six reviews, promotion from the third) so the level lasts three years; quarters hold more moments so a turn is worth its length. |
| What the listening tour surfaces | A named problem: the group's most pressing trouble, else an everyday friction, some of them above the senior manager | An unnamed problem the senior manager hasn't raised; frictions with a memory of how each was answered, as at the second level | An unnamed problem leaves nothing to judge, so one answer is always right and the moment teaches nothing. Frictions above the senior manager make the director's question which problems are theirs to take. A tour visits each group only once every few quarters, so remembering answers per group would rarely come into play. |
| Habits | Where your time goes, staff meetings, listening tours | Oversight per senior manager, as at the second level | Per-manager oversight is the second level's lever; a director's choice is how their time divides between the organization and the room above. |

## Open Questions & Future Decisions

### Deferred
1. Tuning: the headcount allotment, bets' scope and stakes, how fast groups drift, how spin is found out, the moment cap and goal thresholds are set by the balance harness and playtesting.

## References

- HLD: *Each career level is a different game*, *Progression and failure*
- Decision: [The director runs an organization through senior managers and quarterly bets](../../decisions/director-shape.md)
- Simulation core: *Team* (groups, moving heads, closing teams), *Organization* (people outside the organization)
- Senior manager design: the level this one takes over from
