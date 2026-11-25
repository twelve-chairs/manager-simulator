---
id: calm-growth-stalled
title: Coasting
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
once: true
waitDebrief: "Coasting rarely announces itself. Left alone, a capable engineer who has stopped learning drifts until someone else offers them something new."
roles:
  - name: team
    kind: team
    where:
      all:
        - { value: team.id, is: { value: player.team } }
        - { value: team.stress, below: 60 }
        - { value: team.troubled, is: false }
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.skill, atLeast: 35 }
        - { value: engineer.stress, below: 50 }
        - { value: engineer.motivation, below: 65 }
        - { value: engineer.want, in: [growth, recognition] }
        - { value: engineer.weeksSinceWantServed, atLeast: 8 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
choices:
  - id: rotate
    label: "Move {engineer} onto the unfamiliar part of {project}, and accept the slower weeks"
    outcomes:
      - id: rotated
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 7
            wantTags:
              serves: [growth]
            historyNote: Was moved onto something new when they'd started coasting
          - type: value
            target: engineer
            field: skill
            amount: 4
          - type: value
            target: engineer
            field: stress
            amount: 4
          - type: value
            target: project
            field: progress
            amount: -3
        aftermath: "{engineer} spends a week lost in code they've never read, and comes out the other side asking sharper questions."
        debrief: "Boredom is fixed by something new to learn, and new work is slower at first. A calm quarter is the cheap time to pay that."
  - id: course
    label: "Offer {engineer} a training budget to use when they like"
    outcomes:
      - id: offered
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 2
          - type: value
            target: player
            field: stress
            amount: 2
        aftermath: "{engineer} thanks you and bookmarks a course. Their days look the same."
        debrief: "A budget is a kind gesture, but it leaves the work itself unchanged, and the work is what they're bored of."
  - id: review
    label: "Tell {engineer} it's worth raising at their next review"
    outcomes:
      - id: deferred
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -4
          - type: value
            target: engineer
            field: trust
            amount: -2
            historyNote: Was told to wait for the review
        aftermath: "{engineer} says sure. They don't bring it up again."
        debrief: "Pointing someone at the review tells them their growth can wait a quarter, and they hear it."
---

Nothing's wrong with {engineer}'s work. It's just that it's the same work as last spring, done the same way, and in your 1:1 they've started answering "fine" to everything.
