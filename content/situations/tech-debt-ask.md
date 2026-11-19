---
id: tech-debt-ask
title: Time to pay down debt
levels: [line-manager]
priority: normal
cooldownWeeks: 13
roles:
  - name: project
    kind: project
    where:
      value: project.techDebt
      atLeast: 50
  - name: engineer
    kind: person
choices:
  - id: sprint
    label: Give the team a sprint to pay it down
    outcomes:
      - id: paid-down
        effects:
          - type: value
            target: project
            field: techDebt
            amount: -15
          - type: value
            target: project
            field: progress
            amount: -5
          - type: value
            target: engineer
            field: motivation
            amount: 4
            wantTags:
              serves: [autonomy]
        aftermath: "{engineer} leads the clean-up. The build gets faster."
        debrief: "Paying down debt costs a little progress now and buys back speed and safety for the rest of the project."
  - id: later
    label: Promise it after the deadline
    outcomes:
      - id: deferred
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
            wantTags:
              against: [autonomy]
          - type: value
            target: project
            field: risk
            amount: 3
        aftermath: "{engineer} has heard 'after the deadline' before."
        debrief: "Debt deferred keeps compounding: every week on {project} gets a little slower and a little riskier."
---

{engineer} asks for time to clean up {project}. "Every change takes twice as long as it should."
