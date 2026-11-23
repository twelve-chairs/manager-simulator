---
id: senior-one-promotion-slot
title: One promotion slot
levels: [senior-manager]
priority: normal
cooldownWeeks: 48
waitDebrief: "When there's one slot and two candidates, saying nothing is still a decision, and both of them notice."
when: { value: review.weeksAway, atMost: 8 }
roles:
  - name: manager
    kind: person
    where:
      all:
        - { value: manager.role, is: manager }
        - { value: manager.want, is: growth }
  - name: other
    kind: person
    where:
      all:
        - { value: other.role, is: manager }
        - { value: other.want, is: growth }
choices:
  - id: asked-first
    label: Put forward {manager}, who asked first
    outcomes:
      - id: first-come
        effects:
          - { type: value, target: manager, field: motivation, amount: 8, wantTags: { serves: [growth] }, historyNote: Was put forward for promotion }
          - { type: value, target: other, field: trust, amount: -6, historyNote: Lost a promotion slot to whoever asked first }
          - { type: value, target: other, field: motivation, amount: -5 }
        aftermath: "{other} hears who was put forward, and how it was decided."
        debrief: Deciding by who asked first rewards asking, not the work, and the other candidate knows it.
  - id: on-evidence
    label: Choose on what their teams delivered, and tell the other why
    outcomes:
      - id: explained
        effects:
          - { type: value, target: manager, field: motivation, amount: 8, wantTags: { serves: [growth] }, historyNote: Was put forward for promotion on their team's results }
          - { type: value, target: other, field: motivation, amount: -2 }
          - { type: value, target: other, field: trust, amount: 2, historyNote: Was told plainly what would earn the next slot }
        aftermath: "{other} is disappointed, but leaves with a clear idea of what the next case needs."
        debrief: A decision made on evidence and explained to the person who lost it costs far less trust than one made any other way.
  - id: push-for-second
    label: Push your own manager for a second slot
    outcomes:
      - id: second-slot
        when: { value: player.reputation, atLeast: 60 }
        effects:
          - { type: value, target: manager, field: motivation, amount: 6, wantTags: { serves: [growth] } }
          - { type: value, target: other, field: motivation, amount: 6, wantTags: { serves: [growth] } }
          - { type: value, target: player, field: reputation, amount: -8 }
        aftermath: You get the second slot, and your manager makes a note of how much it cost.
        debrief: Spending reputation on a second slot works once; the budget was the budget for everyone else too.
      - id: turned-down
        effects:
          - { type: value, target: player, field: reputation, amount: -5 }
          - { type: value, target: manager, field: motivation, amount: -3 }
          - { type: value, target: other, field: motivation, amount: -3 }
        aftermath: Your manager says no, and the decision is still yours to make, later.
        debrief: Asking for more than the budget without the standing to get it only delays the choice.
---

Calibration is close, and there's budget to promote one manager. {manager} and {other} both want it, and both have asked you about it this month.
