---
id: calibration
title: Calibration
levels: [line-manager]
priority: normal
cooldownWeeks: 13
# Quarterly, with the team's strongest engineers: the same people can be argued over again next quarter.
personCooldownWeeks: 0
# Alternates with calibration-no-slot: one top slot to argue over, then the next quarter none.
when:
  all:
    - { value: review.weeksAway, atMost: 1 }
    - { presented: calibration, withinWeeks: 20, atMost: 0 }
waitDebrief: "A manager who skips calibration lets the room decide. People who aren't argued for are rated by whoever was there."
roles:
  # Two engineers who both earned a top rating, competing for the one the curve leaves your team.
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.correspondingRating, atLeast: exceeds }
  - name: other
    kind: person
    where:
      all:
        - { value: other.team, is: { value: player.team } }
        - { value: other.correspondingRating, atLeast: exceeds }
choices:
  - id: back-engineer
    label: "Put {engineer} forward for it"
    outcomes:
      - id: backed
        effects:
          - { type: rate, target: other, rating: meets, historyNote: "Rated meets in calibration, without the top rating" }
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [recognition] } }
          - { type: value, target: engineer, field: trust, amount: 3, historyNote: You put them forward in calibration }
          - { type: value, target: other, field: motivation, amount: -6 }
          - { type: value, target: other, field: trust, amount: -4, historyNote: Lost the top rating in calibration }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The room takes your pick. {engineer} gets the top rating; {other} gets a solid one, and will work out why."
        debrief: "When the curve leaves one slot, choosing is the job. Whoever you don't choose deserves to hear it from you, with the reason."
  - id: back-other
    label: "Put {other} forward for it"
    outcomes:
      - id: backed
        effects:
          - { type: rate, target: engineer, rating: meets, historyNote: "Rated meets in calibration, without the top rating" }
          - { type: value, target: other, field: motivation, amount: 5, wantTags: { serves: [recognition] } }
          - { type: value, target: other, field: trust, amount: 3, historyNote: You put them forward in calibration }
          - { type: value, target: engineer, field: motivation, amount: -6 }
          - { type: value, target: engineer, field: trust, amount: -4, historyNote: Lost the top rating in calibration }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The room takes your pick. {other} gets the top rating; {engineer} gets a solid one, and will work out why."
        debrief: "When the curve leaves one slot, choosing is the job. Whoever you don't choose deserves to hear it from you, with the reason."
  - id: both
    label: "Argue that both earned it, at a cost to your standing in the room"
    outcomes:
      - id: both-held
        when:
          value: player.reputation
          atLeast: 60
        effects:
          - { type: value, target: engineer, field: motivation, amount: 4, wantTags: { serves: [recognition] } }
          - { type: value, target: engineer, field: trust, amount: 4, historyNote: You argued for them in calibration }
          - { type: value, target: other, field: motivation, amount: 4, wantTags: { serves: [recognition] } }
          - { type: value, target: other, field: trust, amount: 4, historyNote: You argued for them in calibration }
          - { type: value, target: player, field: reputation, amount: -4 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "It takes the whole afternoon and most of your standing in the room, but both ratings hold. Another manager's engineer takes the drop instead."
        debrief: "Winning both spends goodwill you will want back next quarter. The curve doesn't grow; someone else's person paid for it."
      - id: both-lost
        effects:
          - { type: rate, target: engineer, rating: meets, historyNote: "Rated meets in calibration, after you argued for both" }
          - { type: rate, target: other, rating: meets, historyNote: "Rated meets in calibration, after you argued for both" }
          - { type: value, target: engineer, field: motivation, amount: -3 }
          - { type: value, target: engineer, field: trust, amount: 3, historyNote: You argued for them in calibration }
          - { type: value, target: other, field: motivation, amount: -3 }
          - { type: value, target: other, field: trust, amount: 3, historyNote: You argued for them in calibration }
          - { type: value, target: player, field: reputation, amount: -2 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "The room hears you out, then gives neither the top rating. {engineer} and {other} both know you tried."
        debrief: "Arguing for everyone can leave you with no one. Without the standing to win both, the room settles it, and both lose."
---

Calibration is this week. The curve leaves room for one more top rating from your team, and both {engineer} and {other} had a quarter that earns it. Whoever doesn't get it will be rated solid, and will know someone chose. Arguing for both spends your standing with the other managers: with a good reputation you might win both, and without one the room gives it to neither.
