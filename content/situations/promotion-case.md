---
id: promotion-case
title: A promotion case
levels: [line-manager]
priority: normal
cooldownWeeks: 26
roles:
  - name: engineer
    kind: person
    where:
      all:
        - value: engineer.performance
          atLeast: exceeds
        - value: engineer.tenureWeeks
          atLeast: 26
choices:
  - id: write-it
    label: "Write a detailed promotion case for {engineer}"
    outcomes:
      - id: strong-case
        when:
          value: engineer.performance
          is: outstanding
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 8
            wantTags:
              serves: [growth, recognition]
            historyNote: You wrote their promotion case
          - type: value
            target: engineer
            field: trust
            amount: 5
        aftermath: "The case is strong. {engineer} hears you went to bat for them."
        debrief: "A case built on evidence is how a manager turns strong work into a career step."
      - id: not-yet
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 3
            wantTags:
              serves: [growth]
            historyNote: You wrote their promotion case
          - type: value
            target: engineer
            field: trust
            amount: 3
        aftermath: "The committee says not yet, with specific feedback."
        debrief: "A case built on evidence helps even when it falls short: the person learns exactly what is missing."
  - id: hold-off
    label: Tell them it isn't the right time
    outcomes:
      - id: deferred
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -6
            wantTags:
              against: [growth]
            historyNote: Their promotion case was put off
        aftermath: "{engineer} nods. They don't bring it up again."
        debrief: "Putting off a strong performer without a plan tells them their growth isn't a priority. They notice, and some leave."
---

{engineer} asks, carefully, whether you think they're ready for the next level.
