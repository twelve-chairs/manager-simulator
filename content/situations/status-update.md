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
        when:
          value: player.reputation
          atLeast: 40
        effects:
          - { type: value, target: player, field: reputation, amount: 1 }
          - { type: value, target: player, field: stress, amount: 3 }
          - { type: value, target: project, field: risk, amount: -5 }
        aftermath: "Leadership asks two hard questions, offers help with one of the blockers, and asks for a weekly update until it's green."
        debrief: "Bad news early, with a plan, keeps your credibility and often gets you help. It also gets you watched until it's fixed."
      - id: amber-doubted
        effects:
          - { type: value, target: player, field: reputation, amount: -2 }
          - { type: value, target: player, field: stress, amount: 3 }
          - { type: value, target: project, field: risk, amount: -5 }
        aftermath: "Leadership offers help, then asks, not quite lightly, whether you have the team under control. A weekly update is now on your calendar."
        debrief: "Honest amber still gets help. When your standing is already thin, it also confirms the doubts, and that's the price of not hiding it."
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

It's your turn to give leadership a status update on {project}, which is behind schedule. Amber brings help and a weekly spotlight; green buys quiet, if the team can catch up before anyone looks.
