---
id: calm-career
title: Where am I going?
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
once: true
waitDebrief: "Someone who trusts you enough to ask about their future and hears nothing tends to ask someone else next time, often a recruiter."
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
        - { value: engineer.trust, atLeast: 60 }
        - { value: engineer.tenureWeeks, atLeast: 40 }
        - { value: engineer.skill, atLeast: 50 }
        - { value: engineer.stress, below: 60 }
choices:
  - id: not-yet
    label: "Tell {engineer} it's a bit early to think about that"
    outcomes:
      - id: brushed
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -5
          - type: value
            target: engineer
            field: trust
            amount: -3
            historyNote: Asked about their future and was told it was early
        aftermath: "{engineer} says that's fair, and changes the subject."
        debrief: "A question about the future that gets brushed off is rarely asked twice, at least not to you."
  - id: try-it
    label: "Give {engineer} a taste: they run planning for the next month, and you coach them"
    outcomes:
      - id: trying
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 7
            wantTags:
              serves: [growth, recognition, autonomy]
            historyNote: Ran planning for a month to try out leading
          - type: value
            target: engineer
            field: trust
            amount: 4
          - type: value
            target: engineer
            field: stress
            amount: 4
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "{engineer}'s first planning session runs long. By the third, people are leaving it knowing what to do."
        debrief: "Trying the work tells someone more about whether they want it than any conversation. Coaching them through it costs you the time."
  - id: talk
    label: "Walk {engineer} through what both paths, staff engineer and manager, really involve"
    outcomes:
      - id: talked
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 3
          - type: value
            target: engineer
            field: trust
            amount: 2
            historyNote: Talked through their career paths with you
        aftermath: "{engineer} takes notes. They say they'll think about it."
        debrief: "A good conversation helps, but most people can't tell from a description whether they'd like the job."
---

At the end of an easy 1:1, {engineer} asks what you think comes next for them. "Manager, maybe? Or is staff engineer the better path? I don't really know what either looks like day to day."
