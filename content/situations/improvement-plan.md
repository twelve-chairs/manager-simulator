---
id: improvement-plan
title: Writing the improvement plan
levels: [line-manager]
priority: normal
cooldownWeeks: 13
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
            target: engineer
            field: trust
            amount: 3
        aftermath: "{engineer} has a clear target and a reason to think it's reachable."
        debrief: "A plan with specific goals and real support gives someone a fair chance to succeed, and many do."
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
        aftermath: "{engineer} signs it, but doesn't look like they believe it."
        debrief: "A plan only works if the person still wants the job. Low motivation needs a real conversation before goals can help."
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

HR has sent the improvement plan template for {engineer}. It has a lot of empty boxes.
