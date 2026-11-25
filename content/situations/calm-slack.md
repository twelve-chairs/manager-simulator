---
id: calm-slack
title: A week of slack
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
waitDebrief: "Slack nobody claims gets spent anyway: on whatever is loudest that week, which is rarely the debt."
roles:
  - name: team
    kind: team
    where:
      all:
        - { value: team.id, is: { value: player.team } }
        - { value: team.stress, below: 60 }
        - { value: team.troubled, is: false }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.techDebt, atLeast: 25 }
        - { value: project.risk, below: 60 }
        - { value: project.behind, is: false }
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.stress, below: 60 }
choices:
  - id: pay-down
    label: "Spend it on {project}'s tech debt"
    outcomes:
      - id: paid
        effects:
          - type: value
            target: project
            field: techDebt
            amount: -12
          - type: value
            target: project
            field: risk
            amount: -4
          - type: value
            target: project
            field: progress
            amount: -2
          - type: value
            target: engineer
            field: motivation
            amount: 3
            historyNote: Spent a quiet week cleaning up the code
            wantTags:
              serves: [autonomy]
        aftermath: "{engineer} deletes more code than they write all week, and the tests finally run in under ten minutes."
        debrief: "A team ahead of plan is the one time paying down debt doesn't cost you a deadline. It costs you the feature you might have started."
  - id: pull-forward
    label: "Start the next feature on {project} early"
    outcomes:
      - id: ahead
        effects:
          - type: value
            target: project
            field: progress
            amount: 4
          - type: value
            target: project
            field: techDebt
            amount: 4
          - type: value
            target: player
            field: reputation
            amount: 1
        aftermath: "{project} pulls further ahead. The new feature goes in on top of the old shortcuts."
        debrief: "Getting further ahead looks good this quarter and builds on the weakest part of the code."
  - id: breather
    label: "Let the team take it easy for a week"
    outcomes:
      - id: rested
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -5
          - type: value
            target: engineer
            field: motivation
            amount: 1
        aftermath: "The week is quiet. {engineer} leaves on time every day."
        debrief: "Rest is worth something, but a team that is already calm gets less from it than it gets from fixing what slows it down."
---

{project} is ahead of plan, and the team has a week nobody has claimed yet. {engineer} reminds you there's a corner of {project}'s code everyone still steps around.
