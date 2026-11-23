---
id: senior-first-hard-conversation
title: Their first hard conversation
levels: [senior-manager]
priority: normal
cooldownWeeks: 26
when: { value: review.weeksAway, atMost: 6 }
waitDebrief: "A new manager left alone with their first hard conversation usually softens it until it says nothing."
roles:
  - name: manager
    kind: person
    where:
      all:
        - { value: manager.role, is: manager }
        - { value: manager.skill, below: 50 }
  - name: team
    kind: team
    form: aggregate
    where:
      all:
        - { value: team.leader, is: { value: manager.id } }
        - any:
            - { value: team.ratings.partial, atLeast: 1 }
            - { value: team.ratings.below, atLeast: 1 }
choices:
  - id: deliver-it
    label: Deliver it for them
    outcomes:
      - id: delivered
        effects:
          - { type: value, target: manager, field: stress, amount: -4 }
          - { type: value, target: player, field: stress, amount: 3 }
          - { type: value, target: team, field: motivation, amount: -2 }
        aftermath: The conversation goes fine. The engineer wonders why it came from you.
        debrief: Delivering a manager's hard news for them gets it said once, and leaves them no better at the next one.
  - id: sit-in
    label: Sit in, and let them lead
    outcomes:
      - id: led
        effects:
          - { type: value, target: manager, field: skill, amount: 4, historyNote: Led their first hard rating conversation with you in the room }
          - { type: value, target: manager, field: trust, amount: 3 }
        aftermath: "{manager} stumbles once, recovers, and says the hard part clearly."
        debrief: Being in the room while a new manager leads is how the hardest part of the job gets learned.
  - id: just-do-it
    label: Tell them it's part of the job
    outcomes:
      - id: managed
        when: { value: manager.skill, atLeast: 20 }
        effects:
          - { type: value, target: manager, field: skill, amount: 2 }
          - { type: value, target: manager, field: stress, amount: 5 }
        aftermath: "{manager} gets through it, and looks wrung out afterwards."
        debrief: A developing manager can manage a hard conversation alone, at a cost; some support would have made it a lesson.
      - id: softened
        effects:
          - { type: value, target: manager, field: stress, amount: 6 }
          - { type: value, target: team, field: motivation, amount: -4 }
        aftermath: The engineer leaves the meeting unsure whether anything is wrong.
        debrief: Left alone, a learning manager blurs a hard message until nobody on the team knows where they stand.
---

{manager} has to tell someone on {team} that their rating will be low this time. It's their first time, and they ask if you'll do it.
