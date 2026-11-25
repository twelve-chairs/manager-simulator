---
id: calibration-no-slot
title: "Calibration: no room at the top"
levels: [line-manager]
priority: normal
cooldownWeeks: 13
personCooldownWeeks: 0
# The quarter after a calibration with one slot to argue over, the curve leaves none.
when:
  all:
    - { value: review.weeksAway, atMost: 1 }
    - { presented: calibration, withinWeeks: 20, atLeast: 1 }
    - { presented: calibration-no-slot, withinWeeks: 20, atMost: 0 }
waitDebrief: "A manager who skips calibration lets the room decide. People who aren't argued for are rated by whoever was there."
roles:
  # Someone whose quarter earned a top rating the curve has no room for, and someone rated solid beside them.
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
        - { value: other.correspondingRating, is: meets }
        # Not on an improvement plan, where a trade's partial rating could be the low one that ends their job.
        - { value: other.plan, is: none }
choices:
  - id: accept
    label: "Accept the curve, and tell {engineer} why yourself"
    outcomes:
      - id: marked-down
        effects:
          - { type: rate, target: engineer, rating: meets, historyNote: "Rated meets in calibration, without the top rating" }
          - { type: value, target: engineer, field: motivation, amount: -5 }
          - { type: value, target: engineer, field: trust, amount: 2, historyNote: Lost the top rating in calibration }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "{engineer} takes it quietly. \"At least you told me before the letter did.\""
        debrief: "Sometimes the curve wins. Telling someone yourself, with the reason, keeps the trust a letter would cost."
  - id: argue
    label: "Bring {engineer}'s work to the room and argue for an exception"
    outcomes:
      - id: exception
        when:
          value: player.reputation
          atLeast: 80
        effects:
          - { type: value, target: engineer, field: motivation, amount: 5, wantTags: { serves: [recognition] } }
          - { type: value, target: engineer, field: trust, amount: 4, historyNote: You argued for them in calibration }
          - { type: value, target: player, field: reputation, amount: -3 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "The room grumbles, then gives {engineer} the rating. Someone else's curve absorbs it."
        debrief: "An exception to the curve takes a reputation the room already trusts, and spends some of it."
      - id: no-exception
        effects:
          - { type: rate, target: engineer, rating: meets, historyNote: "Rated meets in calibration, after you argued for an exception" }
          - { type: value, target: engineer, field: motivation, amount: -3 }
          - { type: value, target: engineer, field: trust, amount: 3, historyNote: You argued for them in calibration }
          - { type: value, target: player, field: reputation, amount: -2 }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: "The room hears you out and holds the curve. {engineer} is rated solid, and knows you tried."
        debrief: "Arguing for an exception without the standing for one costs you a little, and changes nothing but how {engineer} sees you."
  - id: trade
    label: "Offer to rate {other} lower to make room for {engineer}"
    outcomes:
      - id: traded
        effects:
          - { type: rate, target: other, rating: partial, historyNote: "Rated partially meets in calibration, traded down to make room for someone else" }
          - { type: value, target: engineer, field: motivation, amount: 4, wantTags: { serves: [recognition] } }
          - { type: value, target: other, field: motivation, amount: -8 }
          - { type: value, target: other, field: trust, amount: -6, historyNote: Was rated down to make room for a colleague }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The room takes the trade. {engineer} gets the top rating; {other} gets a partial they didn't earn, and will hear why."
        debrief: "Trading one person's rating for another's makes the curve someone you manage. People notice who paid."
---

Calibration is this week, and the curve is tighter than last quarter: there's no top rating left for your team. {engineer} had a quarter that earns one, and will be rated solid unless something gives. You could argue for an exception, which the room grants only to a manager with an excellent reputation, or make room by rating {other} lower.
