---
parent: high-level-design
prefix: VP
---

# VP Level

## Context and Design Philosophy

The VP level is the fourth and top career level: the player runs an engineering function of three divisions, each led by a director, a quarter at a time. Following the HLD's decision that [the VP's first team is the leadership team](../../decisions/vp-shape.md), the player is one of a leadership team: the CEO, who is the player's manager, and two peer VPs, each leading another function the player's depends on and competes with for budget. The directors are the player's people, full characters as senior managers are at the third level; each division is one aggregate, a few numbers. A quarter is a run of moments filled with a VP's work: arguing for the year's headcount from one company budget, carrying the company's priorities, settling disputes in the leadership team, making cuts when the company asks for them, and telling the whole function how things stand at the all-hands.

The level's core tension is which team the player belongs to first. A VP who leads only for their function wins its arguments and loses the room: the peers stop trusting them and the CEO stops giving them the hard problems. A VP who acts for the company carries priorities that are not their function's, and has to bring their directors with them.

Four principles shape it:

- **Through directors, never around them.** Every effect on a division goes through its director and lands according to their management skill and trust in the player. The groups, teams and people inside a division are gone from view; situations may mention them by name, but a director brings them.
- **One budget, shared.** Headcount comes once a year from a company budget the leadership team divides. What the player asks for, and how, is the level's main lever, and it costs or earns the peers' trust.
- **Say it to everyone.** Each quarter ends with an all-hands to the whole function, a presentation that faces down rather than up. Telling the function what is hard keeps its trust when hard news lands; spin costs more when it does.
- **A fresh role.** Following the HLD's tenet, the director's levers are retired, not scaled up: no placing heads, no funding single bets, no quarterly review to one executive, no staff meeting or listening tour. The directors place heads and run their own bets, seen only in their results. What carries over is the frame (moments, habits, the recap, energy, goals), the character system and the engagement survey.

## The Function

The player leads three **divisions**. A division is one aggregate team in the simulation core, led by a director: the groups it was made of are folded into it, as the director level folds teams into a group. Each division carries two or three projects, sized for a division.

A director is a person with the role `manager`, whose `skill` is their management skill. Like the director level's senior managers, each has a personality, motivation, stress, trust in the player, a want, a memory and a leniency, which shapes the ratings their division's calibration produces.

Outside the function are three people the simulation core holds with no team: the **CEO**, with the role `executive`, who sets the budget and the company's priorities and rates the player; and two **peer VPs**, with the role `peer`, each leading a function the player's work touches. Each has a personality, a want, trust in the player and a memory. The peers' own functions are not simulated: they appear through their VPs' asks and arguments.

## The Handover

A run reaches this level when a director review promotes the player. Before the level begins, the player chooses **who leads their organization now**: each of their senior managers, shown with their management skill, trust in the player and want, or an outside hire.

- A senior manager chosen becomes the division's director. Their management skill, trust and want carry over, and the division forms around the group they led.
- An outside hire starts as a *capable* director with neutral trust, leading the division formed around the first group, whose senior manager joins it as one of its people; the division's stress rises for a quarter as it adjusts.

The level then converts the run as the director level's handover does, one step up: the player's groups are folded into one division led by the new director, keeping their projects; two more divisions join, each generated with a director, headcount, projects and health; the director level's executive and peers stay in the state out of view, and the CEO and two peer VPs are added; the player's energy, reputation and own rating history carry over. The player's old senior managers become heads in their division; their histories stay in the state for situations and debriefs to cite.

## Visibility

- **Directors** appear as cards, as senior managers do at the third level: name, personality, motivation and stress as words, management skill as a band, their want once a moment they took part in has shown it, their memory, and their division's name.
- **Divisions** appear under their director's card: headcount and each project's schedule as they are now; motivation, stress and attrition risk as the last engagement survey measured them, with the survey's quarter.
- **The leadership team** is a panel of its own: the CEO and the two peers as cards, with trust in the player as a word, their want once a moment they took part in has shown it, and their memory.
- **The year's plan** is a panel of its own: the headcount the function was given for the year and how much has arrived, and the company priority the function is carrying, with the division carrying it and its schedule.

## Habits

| Habit | Options | Effects |
|---|---|---|
| **Your first team** | Your function (default); the leadership team | With the function first, the directors' trust rises each quarter and the peers' trust falls, and annual planning gives the function a little more. With the leadership team first, the peers' and the CEO's trust rise each quarter, the directors' trust falls a little, and leadership disputes settle more easily. |
| **How you lead your directors** | Set direction and step back (default); review their plans closely | Stepping back lets a director whose skill is at least *developing* grow each quarter, and leaves a struggling one's division to drift as their skill allows. Close review speeds the company priority's project and lifts a struggling director's division toward what a capable director would sustain, at a cost in energy and in every director's trust. |

## How Directors Shape Their Divisions

As at the director level: each quarter, the level moves each division's motivation and stress toward what its director's management skill can sustain, with magnitudes scaled to a division, and each director's motivation by whether the quarter served their want (growth and autonomy by being given room, recognition by putting the function first or by an all-hands that speaks about the function's work, stability by a division out of the strained band); each division's ratings are calibrated by its director before each review, without a scene, toward what it delivered and shifted up by the director's leniency; and the engagement survey is taken at the start of the level and in the last quarter before each review.

The directors place the year's heads themselves: each quarter, the heads due that quarter join the division whose stress is highest, as unrated heads with a quarter's onboarding stress.

## A Quarter's Moments

A quarter is a run of moments across its thirteen weeks. The level makes them from the function's state, up to a cap:

- **Annual planning**, in the first quarter of each year of the level (quarters 1, 5 and 9): the leadership team divides the company's headcount for the year. Ask for what the plan needs, backed by what the function delivered; ask for more than it needs; or give part of the function's share to a peer's priority. Asking for what the plan needs gives the planned headcount, more with the CEO's trust and the player's reputation; asking for more gives more heads when the CEO trusts the player and costs every peer's trust, and when the function then misses the year's priorities the CEO remembers; giving to a peer gives fewer heads and earns that peer's and the CEO's trust. The year's heads arrive over its four quarters.
- **The company priority**, in the first quarter of each half: the CEO names what the company needs from the function this half, a project with a stake. Put one division on it, named by the player; spread it across the divisions; or push back that the function's own commitments come first. One division carries it fastest at a cost in that division's stress; spreading it carries it more slowly and strains no one; pushing back costs the CEO's trust, unless a division is strained, in which case the CEO accepts it. A priority that lands by its deadline raises reputation and the CEO's trust by its stake; one that fails lowers both.
- **A leadership dispute**: two people at the leadership table disagree over something the player's function touches: a peer and the player over a shared dependency, or the two peers over a decision the player's vote settles. Settle it on what the company needs, side with the function, or broker a trade. The company's answer earns the CEO's trust and costs the losing side a little; siding with the function earns the directors' trust and costs the peers'; a trade works only with a peer who trusts the player, and costs a little energy. Each choice says whom it wins over and whom it costs, and each reaction names whose trust it cost, since a peer whose trust fell after a fair call otherwise reads as a hidden rule. At most one dispute a quarter.
- **Cuts**, once, when the company asks for them: in a quarter of the second year or later, the CEO's budget may turn down, and the function must lose a tuned share of its heads. Cut once, whole projects, and say why; cut across every division; or cut in waves, a few each quarter. A single cut ends the matter: the projects cut are cancelled, their division loses the heads, and every division's motivation dips and recovers. Cutting across every division slows every project and lowers every division's motivation more. Cutting in waves takes a share now and the rest over the next two quarters, each wave lowering motivation and raising attrition risk again. Heads cut are not counted as attrition.
- **Directors at odds**: two directors disagree over who carries shared work. Have them settle it together, which grows both when they can; decide it yourself, which costs the losing director's trust; or leave it, which slows both divisions' projects.
- **Final evaluation**: a director on an improvement plan whose third low rating is due: let them go, or one more period.
- **A stay conversation**: a director is restless, as at the second level: in the quarter's first week, they say what would keep them, and the player now knows their want. Give it to them, at a cost in energy, which settles them; or wish them well, and they leave when their notice runs. Letting it wait is the same as wishing them well.
- **A new director**: the quarter after a division is left without one, promote one of its senior managers or hire from outside, as at the director level.
- **The all-hands**, at the end of every quarter: the player speaks to the whole function. Tell them what is hard and the plan; celebrate the wins; or keep it short. Telling them what is hard steadies every division's motivation in a hard quarter and records the function as told; celebrating raises motivation now, and when hard news lands later in the year (a cut, a failed priority, a division in trouble) the function's motivation falls further than it would have; keeping it short does neither.

Authored situations add written drama on top, tagged for this level and written about directors, divisions, the CEO and the peers: culture and belonging at scale, the function's reputation, hiring brands, executive politics. As at the director level, their effects never lower a division's headcount, which the level counts as attrition.

## Directors' Plans

As at the director level: a director rated low on what their division delivered and how it fared under them, for two periods in a row, goes on an improvement plan; a third low rating is held for a final evaluation. Letting one go leaves their division leaderless until the new-director moment sets one.

## The Period's Goals

At the start of each review period, the CEO sets two or three goals for it, drawn from the function's state: land the half's company priority, lose no more than a tuned few of the people you would have kept, keep a named peer's trust at *trusting* or better, and bring a named division out of the *strained* band at the next survey. Their progress shows all period, and they are scored at the review as extra measures.

## The Recap

Each quarter ends with a recap, folded as the earlier levels' are: what changed first (directors whose bands moved, a new survey's results, heads who left or joined, heads cut, who left: each director who quit, with what led to it, and each division that lost heads during the quarter, with how many of them the player would have kept, asked of the level after the quarter's advance; the company priority's progress, how the leadership team's trust moved), and the quarter's moments, the habits' routine and the goals folded into *The whole quarter*.

## Scorecard, Reviews and the End of the Level

- **Cadence**: a turn is a quarter of thirteen weeks. Reviews come every two quarters, after the second, fourth and so on, counting from the start of this level.
- **Scorecard**: business outcomes (company priorities landed against the priorities whose results came in during the period, and projects shipped on time); the function's health (regretted attrition, and the divisions' motivation and stress as surveyed); and the leadership team's confidence (the CEO's trust, and the peers' average trust in the player). The period's goals are added as measures.
- **Promotion**: possible from the third review (quarter 6), when the performance review rates the player highly enough twice in a row. The VP is the top of the ladder, so a promotion here ends the run as completed.
- **The last review**: the sixth, at quarter 12. A player not promoted there has stayed a VP, and the run ends.
- **Burnout**: two quarters in a row ending at the edge.
- **Managed out**: as at the earlier levels.

A quarter should take about eight to ten estimated minutes to play, by the success-metric playtests' session clock, as at the director level.

## Turn Loop Contract

The level provides the turn loop's career level contract with a time step of thirteen weeks, and the handover step the loop calls when a director review promotes the player (see *The Handover*).

## Level State

The directors' leniency, the habits, the quarter's moments and their status, the year's headcount given and how much has arrived, the company priority with its division and stake, cuts due in later waves, whether the function was told the truth at the last all-hands and what hard news it has heard since, the last survey's results per division, plans, goals, and the counters burnout and reviews need. Management skill, trust, motivation, the divisions' health, projects and the leadership team live in the simulation core.

## Effects Beyond This Level

Committing to this level changes other segments, each walked through its own design when built:

- **Director level**: a director promotion hands over to this level instead of ending the run as completed.
- **Turn loop**: a director promotion continues the run at the VP level through its handover.
- **UI**: a renderer for this level's panels (directors and divisions, the leadership team, the year's plan) and moments, the annual planning, cuts and all-hands scenes; the start screen's career ladder shows the VP rung as playable.
- **Balance**: strategies for this level, including how sound practice and naive play (always the function first, always ask for more, celebrate every all-hands, cut across the board) fare.
- **Success-metric playtests**: scripted players at this level, and *Promotion changes the job* across the third promotion.
- **Situation content**: situations for this level.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| The level's main game | The leadership team and the function | A board and a market; a run of crises | See the decision doc: the leadership team makes executive politics central while still played through people, and keeps the game about engineering management. |
| Size of the function | Three divisions | Two; four or more | Three directors are few enough to know as characters, as three senior managers are at the third level. Org design was the director's duty and is not repeated. |
| Who leads the old organization | The player chooses: one of their senior managers, or an outside hire | Always an outside hire | Mirrors the earlier handovers; growing a senior manager into a director is a choice with consequences the player can trace. |
| Headcount | Once a year from a budget the leadership team shares, placed by the directors | Quarterly allotments placed by the player, as at the director level | Placing heads was the director's lever; at the VP, headcount is argued for among peers, and the directors place it. |
| Presentation | An all-hands to the whole function each quarter | A quarterly review to the CEO, as at the director level | Presenting upward was the director's lever; a VP's distinctive audience is the whole function, and what they are told matters when hard news lands. |
| Cuts | A moment when the company asks, with one clean cut the better choice | No cuts; cuts as situations only | Making cuts well is a real part of the job with a clear better practice; as a moment it can shape a whole year. Arguing the number is not offered: the company's number is the company's. |
| Habits | Your first team; how you lead your directors | Where your time goes, staff meetings and listening tours, as at the director level | The director's habits were about where time goes; a VP's question is which team they belong to first, which is the level's lesson. |
| Top of the ladder | A VP promotion ends the run as completed | A further level (CTO, CEO) | The HLD's levels end at director and above; the VP completes the ladder within a few hours of play. |

## Open Questions & Future Decisions

### Deferred
1. Tuning: the year's headcount, the priority's scope and stake, the cut's share and its waves, the all-hands' effects, the moment cap and goal thresholds are set by the balance harness and playtesting.

## References

- HLD: *Each career level is a different game*, *Progression and failure*
- Decision: [The VP's first team is the leadership team](../../decisions/vp-shape.md)
- Director design: the level this one takes over from
- Simulation core: *Team* (aggregates, moving heads, closing teams), *Organization* (people outside the organization)
