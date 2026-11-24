---
id: feedback-gap
title: Work that isn't landing
levels: [line-manager]
priority: normal
cooldownWeeks: 26
waitDebrief: "Feedback held back doesn't go away. It turns up later as a surprise in someone's evaluation, when it's too late to act on."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - value: engineer.correspondingRating
          below: meets
        - value: engineer.plan
          is: none
        # Once a year per engineer: the same conversation again, as if the first never happened, reads as the game forgetting.
        - history: engineer
          situation: feedback-gap
          withinWeeks: 52
          is: 0
choices:
  - id: direct
    label: "Give {engineer} specific feedback on what isn't landing"
    outcomes:
      - id: lands-blunt
        when:
          all:
            - { value: engineer.trust, atLeast: 50 }
            - { value: engineer.personality, is: blunt }
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Got straight feedback on their work
          - type: value
            target: engineer
            field: motivation
            amount: -2
        aftermath: "\"Finally, someone says it straight.\" {engineer} rewrites the pull request that afternoon."
        debrief: "Blunt people often want feedback the way they give it: direct, and without padding. It lands best that way."
      - id: lands-anxious
        when:
          all:
            - { value: engineer.trust, atLeast: 50 }
            - { value: engineer.personality, is: anxious }
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Got specific feedback on their work
          - type: value
            target: engineer
            field: motivation
            amount: -2
        aftermath: "{engineer} thanks you, then asks twice whether they're in trouble. They aren't, and you say so."
        debrief: "Anxious people hear feedback louder than it is said. Say what is going well too, and say plainly that the problem is small."
      - id: lands
        when:
          value: engineer.trust
          atLeast: 50
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Got specific feedback on their work
          - type: value
            target: engineer
            field: motivation
            amount: -2
        aftermath: "{engineer} takes notes and asks two good questions."
        debrief: "Specific feedback lands when there is trust behind it, and giving it early is a kindness: the problem is still small."
      - id: stings
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
          - type: value
            target: engineer
            field: trust
            amount: 2
            historyNote: Got specific feedback on their work
        aftermath: "{engineer} goes quiet. It stung."
        debrief: "Without trust, even fair feedback feels like an attack. Keep giving it, and keep building the relationship that lets it land."
  - id: wait
    label: Save it for the evaluation
    outcomes:
      - id: deferred
        effects: []
        aftermath: The week moves on.
        debrief: "Saving feedback for the review turns a fixable problem into a surprise, and surprises at review time cost trust."
---

{engineer}'s last two pull requests came back with the same comments as the ones before. Nobody has said anything to them directly.
