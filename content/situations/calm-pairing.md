---
id: calm-pairing
title: Someone to learn from
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
waitDebrief: "A developing engineer left to work it out alone usually does, slowly, and picks up whatever habits are nearest."
roles:
  - name: team
    kind: team
    where:
      all:
        - { value: team.id, is: { value: player.team } }
        - { value: team.stress, below: 60 }
        - { value: team.troubled, is: false }
  - name: junior
    kind: person
    where:
      all:
        - { value: junior.team, is: { value: player.team } }
        - { value: junior.skill, atMost: 55 }
        - { value: junior.stress, below: 60 }
  - name: senior
    kind: person
    where:
      all:
        - { value: senior.team, is: { value: player.team } }
        - { value: senior.skill, atLeast: 65 }
        - { value: senior.stress, below: 60 }
choices:
  - id: docs
    label: "Point {junior} at the team's docs and the review comments"
    outcomes:
      - id: reading
        effects:
          - type: value
            target: junior
            field: skill
            amount: 1
          - type: value
            target: junior
            field: stress
            amount: 3
        aftermath: "{junior} reads everything, and still can't tell which parts matter."
        debrief: "Docs say what the code does. They rarely say why, and why is what someone new is missing."
  - id: pair
    label: "Ask {senior} to pair with {junior} two afternoons a week, and take the hit to {senior}'s own work"
    outcomes:
      - id: paired
        effects:
          - type: value
            target: junior
            field: skill
            amount: 5
          - type: value
            target: junior
            field: motivation
            amount: 4
            historyNote: Was paired with someone stronger to learn from
          - type: value
            target: senior
            field: stress
            amount: 5
          - type: value
            target: senior
            field: motivation
            amount: 2
            historyNote: Was asked to mentor a newer engineer
            wantTags:
              serves: [recognition]
        aftermath: "{senior} grumbles about the calendar invites, then starts sending {junior} the bugs worth learning from."
        debrief: "Mentoring costs the stronger engineer time and teaches faster than anything else. A calm team can afford the time."
  - id: leave
    label: "Leave them be: {junior} will find their feet"
    outcomes:
      - id: alone
        effects:
          - type: value
            target: junior
            field: motivation
            amount: -3
            historyNote: Was left to find their feet
        aftermath: "{junior} spends a day on something {senior} could have answered in a minute."
        debrief: "Finding your feet alone works eventually; the cost is every hour stuck on what someone nearby already knows."
---

{junior} has been stuck on the same kind of problem three times this month. {senior}, two desks over, has solved it so often they no longer notice it's hard.
