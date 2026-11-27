---
parent: high-level-design
prefix: SENIOR
---

# Senior Manager Level

## Context and Design Philosophy

The senior manager level is the second career level: the player manages three line managers, and through them three teams, month by month. Following the HLD's decision that [the senior manager acts through managers](../../decisions/senior-manager-shape.md), the managers are the player's people: full characters, as engineers are at the first level. Their teams are aggregates, a few health numbers each. The player never acts on an engineer directly. A month is a run of moments, as a week is at the first level, filled with the work of a senior manager: managers' escalations, staffing between teams, disputes across teams, approvals a manager asks for, and before every review, calibration.

The level's core tension is between stepping in and building managers. Fixing a team's problem yourself is quick and drains you, and the manager learns nothing; coaching the manager through it is slower and makes the next problem theirs. The first level asked whether to do work yourself or give it to an engineer; this level asks whether to do a manager's job or grow them into it.

Four principles shape it:

- **Through managers, never around them.** Every effect on a team goes through its manager, and lands according to the manager's management skill and their trust in the player. Situations may be about an engineer, but a manager brings them: only managers are active people a situation can feature, and an engineer in an aggregate team appears only by name in its text.
- **What you're told is not always what's true.** The player sees each team as its manager reports it. A manager who is struggling or doesn't trust the player reports a rosier team than the real one. Close oversight and skip-level listening show the truth, at a cost.
- **A fresh role.** Following the HLD's tenet, the first level's mechanics are retired, not scaled up: no work moments, no night pages, no check-ins with engineers. What carries over is the frame (moments, habits, the recap, energy) and the character system, now applied to managers.
- **Pace like the first level.** A run at this level should take about as long to play as one at the first level: a promotion is possible about an hour into the level.

## The Organization

The player leads a group of three teams, each with a line manager. A team is in aggregate form: headcount, skill, motivation, stress, attrition risk and its people's ratings, as the simulation core defines them. Each team has one or two projects, as at the first level.

A manager is a person with the role `manager`. Their `skill` is their management skill, shown in the same five bands as an engineer's. Like an engineer, a manager has a personality, motivation, stress, trust in the player, a want and a memory, and is rated by the player. Each manager also has a **leniency**, how far their proposed ratings run above what their team delivered, which the player learns from calibration rather than being told.

A fourth team can join the group through a restructuring moment (see *A Month's Moments*). The group never shrinks by the player's choice; a team whose manager leaves is leaderless until a new manager is set.

## The Handover

A run reaches this level when a line manager review promotes the player. Before the level begins, the player makes one last call as their old team's manager: **who leads the team now**. The choices are each of the team's engineers, shown with their skill, trust in the player and want, and an outside hire.

- An engineer chosen becomes the team's manager and leaves the team's membership, so the team is a head short until the backfill habit replaces them: promoting from within costs the team, as it does in practice. Their management skill starts from their trust in the player and whether they want growth: an engineer who trusts the player and wants to grow starts as a *developing* manager, others as *learning*. Their old skill stops mattering; a strong engineer is not thereby a good manager.
- An outside hire starts as a *capable* manager with neutral trust and a want drawn at random, and the team's stress rises for a while as it adjusts.

The level then converts the run: the old team becomes an aggregate team led by the new manager, keeping its projects; two more teams join the group, each generated with a manager, headcount, projects and health; and the player's energy, reputation and own rating history carry over. The player's old engineers become heads in their team's aggregate; their histories stay in the state for situations and debriefs to cite.

## Visibility

- **Managers** appear as cards, like engineers at the first level: name, personality, motivation and stress as words, management skill as a band, their want once a 1:1 has revealed it, their memory of what happened between you, and their team's name.
- **Teams** appear under their manager's card as the manager reports them: headcount, motivation and stress as words, attrition risk as a word, and each project's schedule. A report is accurate when the manager's management skill is at least *capable* and their trust is at least moderate; otherwise each health word is reported one band better than the truth.
- **The truth** shows for a team when the player's oversight of its manager is *close*, or in the month a skip-level session listened to that team. The card then says the numbers come from what the player saw for themselves.
- **Calibration** shows, for each team, the delivery behind its proposed ratings, so the player can compare a manager's proposal with the evidence.

## Habits

| Habit | Options | Effects |
|---|---|---|
| **Oversight**, per manager | Hands-off; coaching (default); close | Hands-off costs nothing and lets a skilled, trusted manager grow their autonomy; a struggling manager's team drifts. Coaching costs a little energy each month and raises the manager's management skill slowly. Close shows the true team, catches problems early and costs the most energy; the manager loses motivation if they want autonomy, and trust if kept close for long. |
| **1:1s with managers** | Weekly; fortnightly (default); monthly | As at the first level: 1:1s build trust and reveal each manager's want, and cost energy by how often they happen. |
| **Backfill** | Fast; hold the bar (default) | When a team loses a head: fast backfills within a month at lower skill; holding the bar takes two months and keeps the team's skill. The gap raises the team's stress. |
| **New work for an idle team** | Decide each time (default); give it to a team with room | Whether new work for a team with nothing on comes to the player as a moment. Given to a team with room, the player's manager assigns it at the month's end and the recap says so; a strained idle team still brings it to the player, where taking it on costs something. |
| **Skip-level listening** | None (default); monthly | A monthly session with one team's engineers, rotating through the teams: shows that team's true health that month and surfaces one problem its manager hasn't raised. Costs energy, and the team's manager loses trust if they don't trust the player already. A problem the player's answer settled (stepping in, coaching a manager able to act on it, or leaving it with a capable one) is not raised again by that team for half a year; one left unsettled comes back as itself, saying how the player answered it last time; and a healthy team whose frictions are all settled has nothing new to raise. A friction one team raised rests across the group for half a year, so a month's skip-level usually brings something the player has not heard lately from anyone. Coaching then visibly works or doesn't, instead of the same few frictions cycling through every team on a timetable. Some everyday frictions are the manager's to settle (too many meetings, reviews waiting on one person); others sit above them (priorities changing upstream, nobody sure who decides on a shared service), and the moment says the manager can't settle it alone. Only stepping in settles one of those; coaching still grows the manager but leaves the problem where it was. Which answer is right then depends on what the engineers raised. |

## How Managers Shape Their Teams

Each month, the level moves each team's motivation and stress toward what its manager's management skill can sustain, and its attrition risk with them. A skilled manager pulls their team toward health; a struggling one lets it slide, faster when the player is hands-off. A leaderless team's stress rises, as the simulation core already applies. Coaching oversight and moments the player handles by coaching raise a manager's management skill; stepping in on a manager's behalf solves the problem now and teaches them nothing.

A manager's own motivation and stress follow from their team's health, the player's oversight, how their wants are served and what the player did in their moments, as an engineer's do. A month serves a manager's want when it gives them what they want from the job: coaching oversight serves growth, hands-off oversight serves autonomy, 1:1s at least fortnightly serve recognition, and a team below the *strained* band serves stability.

## A Month's Moments

A month is a handful of moments, Monday of the first week to Friday of the last, each set in a week and day of the month. The level makes them from the group's state, up to a cap so a month stays a handful of scenes:

- **Escalation**: a manager brings a problem in their team (stress or attrition risk high, a project slipping, a conflict). Coach them through it; step in and fix it yourself; let them handle it. Stepping in fixes the problem and costs energy and the manager's growth; coaching costs less energy, and works if the manager's skill is at least *developing*; letting them handle it works only for a skilled manager.
- **Staffing request**: a team is overloaded while another has room. Move a head between teams; backfill with a hire; decline. Moving helps both teams if the giving team has room, and costs its manager's trust if it doesn't.
- **Cross-team dispute**: two teams need the same thing, or one blocks the other. Get the two managers to agree a plan; decide it yourself; let it run. Agreeing builds both managers' skill and eases both projects' risk a little; deciding is quick, eases the winning project's risk more and costs the losing manager's trust; letting it run raises both projects' risk. Agreeing or deciding settles the dispute between those two teams for a quarter, so it does not come back before then; letting it run settles nothing, and it can come back the next month.
- **New work for the group**: the player's manager offers a project. Give it to a team with room; decline; take it and spread it thin. Spreading it raises every team's stress. Under the habit of giving it to a team with room, it comes as a moment only for a strained team. Each offer is one of three kinds, taking turns from one offer to the next, since offers come a set number of weeks apart and turns by month could land on the same kind every time: a **launch** the whole company will see, which lifts the player's reputation if taken and costs more to decline; a **handover** of another group's system, heavy with tech debt, cheap to decline; and the idle team's **own project**, one its manager has been pushing for, which lifts the team if taken and costs its motivation if declined. While the player decides each offer themselves, the player's manager offers new work at most once a quarter; between offers an idle team waits, or the player can let the manager give work straight to a team with room. A new offer every month made deciding them the month's routine. The choices say what each gains or costs for that kind of offer, and the reaction says what it did, so the difference is visible at the moment of choosing and not only in the numbers afterwards. The same offer answered the same way every month is no decision; offers that differ make which ones to take one.
- **Approval**: a manager asks the player to approve promoting one of their people, which moves one of the team's heads up a rating, or letting one go, which removes a head. Approve; ask for the evidence first; refuse. Approving applies it, and when the manager runs lenient the promotion is unearned and the team's motivation dips; asking for the evidence applies it only when the manager does not run lenient, at a small cost to their trust either way; refusing costs their trust.
- **Final evaluation**: a manager on an improvement plan whose third low rating is due, as at the first level: let them go, or one more period.
- **A stay conversation**: a manager is restless, the simulation's notice that they will quit within weeks unless they get what they want from the job. The month opens with a conversation about it, early enough that the cap never crowds it out, in which they say what would keep them, and the player now knows their want. Give it to them, at a cost in energy: their motivation and trust rise, tagged as serving their want, which settles them; or wish them well, and they leave when their notice runs. Letting it wait is the same as wishing them well. The month's drift is a rule, and settles no one, so this and the few situations that serve a want are the player's only ways to keep a restless manager.
- **Restructuring**: once the group has run a year, the player's manager offers a fourth team. Choose its manager: promote someone from one of the teams (that team loses a strong head) or hire from outside.
- **Calibration** (see below), before each review.

The month after an approval, the recap says what came of it, in words that match what the answer did: a strict manager's promotion settling in, a lenient one's leaving the team wondering, evidence that held up costing the manager a little trust, a case that didn't, a refusal remembered. Without it, asking for the evidence looks free and the right answer every time, and a manager's leniency shows only at calibration. Approvals come from the teams' ratings rather than chance: a manager proposes a promotion when their team has a head rated *exceeds* or better, and letting someone go when it has one rated *below*, at most once every three months a team. A project counts as at risk for a dispute when its risk is *elevated* or worse. A manager hired from outside, at restructuring or to replace one let go, joins at once but starts leading the following month; until then their team is leaderless.

Authored situations add written drama on top, tagged for this level and written about managers and teams. Their effects never lower a team's headcount: the level counts a fall in headcount between months as attrition, so a situation that took a head away would book a backfill and could count a regretted loss. A situation may add a head, or remove a manager, which leaves their team leaderless.

## Calibration

In the last month before each review, calibration is a moment of its own. Each manager proposes ratings for their team's heads: what the team delivered, shifted up by their leniency. What a team delivered comes from its skill, motivation and stress, and climbs steadily as the team gets better: a team between two ratings has a share of its heads at the higher one by how far it has climbed, and a few a rating either side, so getting a little better earns a few more top ratings, never a whole team's worth at once. The thresholds are set so that a well-run group delivers a few more top ratings than the curve holds, and a middling one about what it holds. The group shares one **curve**: across its teams, top ratings (*exceeds* and *outstanding*) may number at most a tuned share of the group's heads, set so that a healthy group delivers more top ratings than the curve holds; for an exceptionally strong group, the room stretches the curve to a few heads short of what the teams delivered, never further, so the cut stays a few heads however well the group is run. The scene shows each team's proposal beside its delivery, the curve's room beside the top ratings settled so far, and how many top ratings the teams would hold set to what they delivered, with one control that sets every team there, so the player starts from the evidence rather than adding it up. For each team, the player can accept the proposal, or move heads up or down a rating, and hears the manager's case and reaction. The result is applied with the simulation core's re-rate effect.

When every team is settled and the group holds more top ratings than the curve, the player takes it to the room or lets the room trim. Arguing for an exception spends the player's reputation, and holds only when that reputation is good or excellent, which the scene says in those words. The room also remembers: after the player argues at one calibration, the next asks a band more, an excellent reputation, costs twice the reputation, and the choice to argue says plainly that they argued last time. Without that, a player with standing to spare argues at every calibration and always wins, and the argument is no trade at all. Otherwise, and when the player lets it go, the room trims the excess a rating down at a time: from the team furthest above what it delivered first, then from the team with the most top ratings, ties broken by team id. A player who wants to decide where the cut falls makes it while settling the teams.

If the player lets the calibration moment wait, each manager's proposal stands as proposed, and the room trims what goes over the curve: a manager who skips calibration lets the room decide.

Correcting a lenient manager's inflation comes first, and costs that manager's trust. Once the inflation is gone, a healthy group still holds more earned top ratings than the curve allows, so no settlement matches every team's delivery. A team that gives up a top rating it earned loses motivation, and its manager loses trust, so the choice turns on which team and manager can bear it this quarter (a team at risk of losing people, a manager whose trust is already thin), or on whether the player's standing is worth spending to keep them all. A manager's leniency becomes visible over reviews, as the gap between their proposals and the evidence.

## Managers' Plans

A manager rated low on what their team delivered and how it fared under them, for two periods in a row, goes on an improvement plan, as an engineer does at the first level; a third low rating is held for a final evaluation. Letting a manager go leaves their team leaderless, as a manager who quits does, until the player sets a new manager; the month after a team is left without one, a moment offers it a new manager: promoted from the team, which takes a strong head out of it and starts a *developing* manager who already knows the team and has the player's trust, or hired from outside, a *capable* stranger who takes a month to arrive. Either way the team's stress rises while it adjusts.

## The Period's Goals

At the start of each review period, the player's manager sets two or three goals for it, drawn from the group's state: grow a named manager by a band, keep regretted attrition at zero, ship a named project by its deadline, bring a team out of the strained band. Their progress shows all period, and they are scored at the review as extra measures.

## The Recap

Each month ends with a recap, folded as the first level's is: what changed first (managers whose bands moved or who gained a memory note, team health that changed as reported, heads who left or joined, each manager who quit with what led to it and the last thing between you as the first level words it, projects that shipped in the month and whether by their deadline, projects back on schedule, so an escalation the player answered shows whether it held, asked of the level after the month's advance since projects and quits happen during it, what slipped), and the month's moments, the habits' routine and the goals folded into a disclosure, *The whole month*.

## Scorecard, Reviews and the End of the Level

- **Cadence**: a turn is a month of four weeks, so six months are 24 game weeks. Months and reviews count from the start of this level. A review comes every six months, after the sixth, twelfth and so on.
- **Scorecard**: delivery (projects shipped on time across the teams, and the share on schedule); retention and team health (regretted attrition, and the teams' average motivation and stress); managers' growth (how far the managers' management skill rose over the period, and whether their teams' health held); and calibration quality (how closely the period's ratings matched what each team delivered, beyond the gap the curve forced). The period's goals are added as measures.
- **Promotion**: possible from the third review (month 18), when the performance review rates the player highly enough twice in a row.
- **The last review**: the sixth, at month 36. A player not promoted there has stayed a senior manager, and the run ends.
- **Burnout**: four months in a row ending at the edge, as four weeks at the first level.
- **Managed out**: as at the first level, the performance review ends the run when the player fails an improvement plan.
- **Promotion past this level**: the run continues at the director level, through its handover (see the [director design](../director/director-design.md)).

A month should take about two and a half to three estimated minutes to play, by the success-metric playtests' session clock, so a promotion at month 18 comes about an hour into the level.

## Turn Loop Contract

The level provides the turn loop's career level contract, as the line manager level does, with a time step of four weeks. It adds one step the loop calls when a line manager review promotes the player: the handover choice, then the conversion of the run (see *The Handover*).

## Level State

The managers' leniency, the habits, the month's moments and their status, the goals, the months each team has spent with true or reported visibility, each manager's oversight history, plans, the pairs of teams whose dispute is settled and when, and the counters burnout and reviews need. Management skill, trust, motivation and the teams' health live in the simulation core.

## Effects Beyond This Level

Committing to this level changes other segments, each walked through its own design when built:

- **Turn loop**: a promotion below the top level now continues the run at the next level through its handover, instead of ending it.
- **UI**: a renderer for this level's panels and moments, the handover scene and the calibration scene; the start screen's career ladder shows the senior manager rung as playable.
- **Balance**: strategies for this level, including how sound practice and naive play (always step in, never oversee, accept every proposal) fare.
- **Success-metric playtests**: *Promotion changes the job* can be measured.
- **Situation content**: situations for this level.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| When a dispute comes back | Agreeing or deciding settles the two teams' dispute for a quarter, and agreeing eases both projects' risk | Offer it every month both projects are at risk; a cooldown after any answer | Offered every month, a dispute the player had settled came back unchanged, since agreeing moved nothing that raised it, and the scene read as the game ignoring the answer. A cooldown after letting it run would reward ignoring it. |
| Size of the group | Three teams, a fourth through restructuring | Four from the start; two plus the old team | Three managers are enough to compare and calibrate across, and few enough to know as characters. Two plus the old team pulls attention back to the first level's job. |
| Who leads the old team | The player chooses: one of their engineers, or an outside hire | The strongest engineer automatically; always an outside hire | The choice is the player's first senior call and has consequences they can trace. An automatic pick hides that strong engineers aren't always good managers; an outside hire loses the team the player built. |
| Review cadence | Every six months, promotion from the third, last review the sixth | Every three months; yearly | Six-monthly reviews are common at this level and, with monthly turns, put a promotion about an hour into the level. Quarterly reviews would leave nine turns before promotion; yearly ones would leave long stretches without feedback. |
| Calibration | A scene before each review, with re-rated heads | Situations only; a standing ratings habit | Running calibration is the level's most distinctive duty; a habit would play no scene, and occasional situations would lose it. |
| What makes calibration a judgement | A curve shared across the group's teams, holding fewer top ratings than a healthy group delivers; the player chooses where the cut falls or spends reputation arguing for an exception | Delivery as the whole truth, matched head for head; delivery that leaves out work a team carried, with each manager's case to weigh | Matched head for head, calibration had one right answer every time and played as an arithmetic check. Cases that may or may not be true still hide a right answer to find, and are hard to make readable. A shared curve makes every settlement cost someone, as real calibration does, and is the dilemma the line manager level already plays with one slot. |
| What settles a skip-level friction | Each friction has an owner: the manager's to settle, or above them and the player's, which the moment names | Every friction settled by the same answers, rated by the manager's skill | With one rule for every friction, the same answer was right every month, and a playtester coached through dozens of skip-level problems without reading them. An owner makes the problem's wording the thing to judge, as it is in the job: some problems a manager can be coached through, and some only their manager's manager can move. |
| Keeping a restless manager | A stay conversation at the month's start, which names their want and offers to serve it for energy | Let the month's drift settle them when the habits serve their want; a habit that serves wants generally; leave it to situations | The card warns that a restless manager may leave unless they get what they want, and without a lever the warning only foreshadowed a quit. Drift settling them let a player who answers nothing keep every manager, and made naive play win promotions. A habit would not aim at the person about to leave. Few situations serve a want, and one rarely lands on the right person within their notice. Naming the want in the conversation makes the choice whether to spend the energy, not a guess. |
| Curve for an exceptionally strong group | The curve stretches to a few heads short of what the group's teams delivered | A fixed share of heads at every level of health | With a fixed share, a group whose teams nearly all deliver top ratings ran seven or more heads over, and a playtester spent each calibration doing sums. Rooms make room for a group that plainly delivered, but never all of it, so the choice of who gives a rating up remains. |
| How far over the curve a healthy group delivers | A few heads: delivery climbs steadily with a team's health, with thresholds set so a well-run group's honest ratings exceed the curve by a few heads | Every head of a healthy team at its band's rating, with the curve well below | With whole teams jumping a rating at once, a well-run group delivered two to three times the top ratings the curve holds, so settling on the evidence still left a cut of ten heads or so. The choice of who gave up a rating was lost in arithmetic, and a playtester called calibration an exam. A cut of a few heads is a judgement about people that a player can hold in their head. |
| Replacing managers | Coach, then an improvement plan, then replace | Coach only; replace at will | Mirrors the first level's lesson about engineers, and makes replacement a real decision with a cost to the team. |
| Visibility | Teams as their manager reports them; the truth through close oversight or skip-levels | Always the true numbers | A senior manager learns about teams through managers; misreporting makes oversight and listening worth their cost, and makes a struggling manager something to find, not something shown. |
| Energy | Kept, with the burnout rule in months | Reputation as the only personal stake | Doing a manager's job for them is the cost the level teaches; energy is how the player feels it. |
| Review targets | Set so sound practice meets them and its best skills score above: settling calibration on the evidence scores above (the cuts the curve forces are not counted against it), on-schedule share is judged against what a group of teams carrying new work achieves, and team stress against what a coached manager's team sustains | Targets carried over from the line manager, or set as ideals | Targets beyond what good practice reaches mark every player down alike and rank nothing; the balance harness measures them against sound and naive play. |
| New work as a habit | A habit, defaulting to decide each time, that lets the player's manager give new work to a team with room | Assign all work with room automatically; always a moment | With a team plainly idle and calm, giving it the work is the same click every month, so a player can hand it off. Assigning it automatically for everyone let a player who answers nothing be promoted, since the group then delivered without them. |
| Declining new work | Costs the player reputation with their manager, enough that declining everything scores below | A free choice | A group that takes on nothing keeps its teams calm; without a cost, refusing work would be the best way to play. |
| What a manager sustains | A team settles at a stress that falls with its manager's management skill, so a coached, capable manager's team sits within the review's target | Higher settled stress, so only the most skilled managers keep teams healthy | Growing managers is the level's lesson; their teams' health is where it shows. |
| Promoting from the team | A *developing* manager with the player's trust, at a small cost in the team's skill and a head | A weaker promotion than an outside hire | Growing people from within is practice the game teaches; it should be at least as good a choice as hiring a stranger. |

## Open Questions & Future Decisions

### Deferred
1. Tuning: how fast teams drift under managers of each skill, the oversight and skip-level costs, the moment cap, leniency ranges, and goal thresholds are set by the balance harness and playtesting.
2. Whether managers' own ratings use the same five-step scale and measures as engineers', or a manager-specific basis beyond their team's results.

## References

- HLD: *Each career level is a different game*, *Progression and failure*
- Decision: [The senior manager acts through managers](../../decisions/senior-manager-shape.md)
- Simulation core: *Team* (aggregate teams, leaders, re-rating)
- Line manager design: the level this one takes over from
