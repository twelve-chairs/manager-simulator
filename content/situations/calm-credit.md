---
id: calm-credit
title: Credit where it's due
levels: [line-manager]
priority: normal
cooldownWeeks: 13
quietWeek: true
waitDebrief: "A project going well that nobody remarks on teaches the team that shipping well is invisible. The people who wanted it seen notice most."
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
        - { value: project.progressShare, atLeast: 70 }
        - { value: project.behind, is: false }
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.want, is: recognition }
        - { value: engineer.stress, below: 60 }
  - name: other
    kind: person
    where:
      all:
        - { value: other.team, is: { value: player.team } }
        - { value: other.stress, below: 60 }
choices:
  - id: star
    label: "Write {engineer} up as the reason {project} is on time"
    outcomes:
      - id: starred
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 8
            wantTags:
              serves: [recognition]
            historyNote: Was named as the reason a project was on time
          - type: value
            target: other
            field: motivation
            amount: -4
          - type: value
            target: other
            field: trust
            amount: -3
            historyNote: Saw a teammate credited alone for shared work
        aftermath: "{engineer} forwards your note to their family. {other} reads it twice and says nothing."
        debrief: "Credit given to one person for shared work is noticed by everyone who did the rest of it."
  - id: team
    label: "Thank the whole team for {project} in the update"
    outcomes:
      - id: thanked
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 1
          - type: value
            target: other
            field: motivation
            amount: 2
        aftermath: "The team gets a line in the update. {engineer} skims past it."
        debrief: "Thanking everyone is safe, and for someone who wants to be seen it reads as not being seen."
  - id: specific
    label: "Take an evening to write up what each of {engineer} and {other} did on {project}"
    outcomes:
      - id: written
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 6
            wantTags:
              serves: [recognition]
            historyNote: Had their part in a launch written up by name
          - type: value
            target: other
            field: motivation
            amount: 3
          - type: value
            target: player
            field: stress
            amount: 4
          - type: value
            target: player
            field: reputation
            amount: 2
        aftermath: "Your note names who built what. Your own manager replies asking whether {engineer} would present it."
        debrief: "Specific credit costs you an evening, and it's the kind people remember: what they did, said by name, with no one left out."
---

{project} is into its final stretch and on plan, with no drama, which is the best way to ship. You're writing the update to leadership, and {engineer} did more of the work than anyone.
