---
id: status-update
title: Status update to leadership
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "A missed status update doesn't stop leadership forming a view of the project; it just forms without you."
roles:
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.behind, is: true }
choices:
  - id: report-green
    label: "Say {project} is green and catch up quietly"
    outcomes:
      - id: green
        effects:
          - type: value
            target: player
            field: reputation
            amount: 2
          - type: value
            target: project
            field: risk
            amount: 8
        aftermath: "Nobody asks a follow-up question. The team now has to make the green true."
        debrief: "Reporting green when it isn't buys a quiet week and spends your credibility on the day it comes out."
  - id: amber
    label: "Say {project} is amber, with a recovery plan"
    outcomes:
      - id: amber-plan
        effects:
          - type: value
            target: player
            field: reputation
            amount: 1
          - type: value
            target: project
            field: risk
            amount: -5
        aftermath: "Leadership asks two hard questions, then offers help with one of the blockers."
        debrief: "Bad news early, with a plan, keeps your credibility and often gets you help."
  - id: send-notes
    label: Skip the meeting and send notes
    outcomes:
      - id: notes
        effects:
          - type: value
            target: player
            field: reputation
            amount: -3
        aftermath: "The notes are read after the meeting, by which time the meeting has formed its own view."
        debrief: "Status meetings are where impressions form. Absent, you've left the story to others."
---

It's your turn to give leadership a status update on {project}, which is behind schedule.
