---
id: conference-talk
title: A talk accepted
levels: [line-manager]
priority: normal
once: true
waitDebrief: "A growth opportunity left unanswered usually lapses. The engineer notices that it did, and who let it."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.want, in: [growth, recognition] }
        - { value: engineer.skill, atLeast: 40 }
choices:
  - id: cover
    label: "Approve it and cover {engineer}'s work while they prepare"
    outcomes:
      - id: covered
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 10
            wantTags:
              serves: [growth, recognition]
            historyNote: You backed their conference talk
          - type: value
            target: engineer
            field: skill
            amount: 3
          - type: value
            target: player
            field: stress
            amount: 4
        aftermath: "{engineer} gives the talk. Three people from other companies ask for the slides."
        debrief: "Growth only counts if you protect the time for it. Covering the work is what makes the yes real."
  - id: own-time
    label: "Approve it, but {engineer} catches up on their own time"
    outcomes:
      - id: stretched
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 4
            wantTags:
              serves: [growth, recognition]
          - type: value
            target: engineer
            field: stress
            amount: 10
            historyNote: Prepared a talk on top of a full week
        aftermath: "{engineer} gives the talk, and spends the weekend before it catching up."
        debrief: "A yes that comes with a weekend of catch-up teaches people that growth is something to do after hours."
  - id: decline
    label: "Decline: there's no budget this quarter"
    outcomes:
      - id: declined
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -6
            historyNote: Had their conference talk turned down
          - type: value
            target: engineer
            field: trust
            amount: -3
        aftermath: "{engineer} withdraws the talk and doesn't mention it again."
        debrief: "Saying no to the growth someone asked for costs more than the ticket would have."
---

{engineer} has had a talk accepted at a conference next month. They'd need a few days to prepare, and the travel approved.
