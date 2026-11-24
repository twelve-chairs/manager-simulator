---
id: improvement-plan
title: Writing the improvement plan
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "An improvement plan left blank isn't a kindness. Without clear goals and real support, the person can't succeed and the plan can't be fair."
roles:
  - name: engineer
    kind: person
    where:
      value: engineer.plan
      is: pip
choices:
  - id: real-plan
    label: "Write a concrete plan with {engineer}, with weekly check-ins"
    outcomes:
      - id: believes
        when:
          value: engineer.motivation
          atLeast: 40
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 5
            historyNote: Agreed a concrete improvement plan
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: player
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: trust
            amount: 3
        aftermath: "{engineer} has a clear target and a reason to think it's reachable."
        debrief: "A plan with specific goals and real support gives someone a fair chance to succeed, and many do. The weekly check-ins are hours of your own, every week, for as long as it runs."
      - id: going-through-motions
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 8
            historyNote: Signed an improvement plan
          - type: value
            target: engineer
            field: motivation
            amount: -3
          - type: value
            target: player
            field: stress
            amount: 5
        aftermath: "{engineer} signs it, but doesn't look like they believe it."
        debrief: "A plan only works if the person still wants the job. Low motivation needs a real conversation before goals can help."
  # Offered when the player's own choices loaded them: the plan can name that load and take it back.
  - id: own-the-load
    label: "Write the plan around taking back what you've put on {engineer}"
    availableIf:
      any:
        - { history: engineer, note: Handled a night page alone, withinWeeks: 13, atLeast: 2 }
        - { history: engineer, note: Took on new work while stretched, withinWeeks: 13, atLeast: 1 }
        - { history: engineer, action: line-manager.delegate, withinWeeks: 13, atLeast: 3 }
    outcomes:
      - id: owned
        effects:
          - { type: value, target: engineer, field: trust, amount: 5, historyNote: You named the load you had put on them in their plan }
          - { type: value, target: engineer, field: stress, amount: -8 }
          - { type: value, target: engineer, field: motivation, amount: 3 }
          - { type: value, target: player, field: stress, amount: 6 }
        aftermath: "The first goal on the plan is yours: the night shifts and extra work come back to you. {engineer} reads it twice, then looks up."
        debrief: "When someone is failing partly under the load you gave them, a plan that says so is the fair one, and the one they can pass. The load doesn't vanish; it comes back to you."
  - id: paper-trail
    label: Write it to document the problem
    outcomes:
      - id: documented
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 6
            historyNote: Received an improvement plan
          - type: value
            target: engineer
            field: trust
            amount: -8
        aftermath: "HR has the document. {engineer} has a good idea where this is going."
        debrief: "An improvement plan written to justify an exit tends to become one, and the rest of the team notices how it was done."
---

HR has sent the improvement plan template for {engineer}. It has a lot of empty boxes. A real plan means weekly check-ins you'll have to make time for; a plan written for the file takes an afternoon. Look at what {engineer} has been carrying before you decide what the plan is about.
