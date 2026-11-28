---
id: senior-running-hot
title: Running hot
levels: [senior-manager]
priority: normal
cooldownWeeks: 52
waitDebrief: "A manager running hot doesn't cool down on their own; they get quieter, and then they leave."
roles:
  - name: manager
    kind: person
    where:
      all:
        - { value: manager.role, is: manager }
        - { value: manager.stress, atLeast: 40 }
  - name: team
    kind: team
    form: aggregate
    where: { value: team.leader, is: { value: manager.id } }
choices:
  - id: take-something
    label: Take something off their plate yourself
    outcomes:
      - id: taken
        effects:
          - { type: value, target: manager, field: stress, amount: -12 }
          - { type: value, target: player, field: stress, amount: 6 }
        aftermath: "{manager} breathes out. Your own week gets longer."
        debrief: Taking a manager's work moves the load to you, and next month it is still too much for one of you.
  - id: week-off
    label: Send them on a week off
    outcomes:
      - id: covered
        when: { value: manager.skill, atLeast: 40 }
        effects:
          - { type: value, target: manager, field: stress, amount: -15 }
        aftermath: "{manager} comes back rested. {team} barely noticed they were gone."
        debrief: A week off works when the manager has built a team that runs for a week without them.
      - id: uncovered
        effects:
          - { type: value, target: manager, field: stress, amount: -15 }
          - { type: value, target: team, field: stress, amount: 8 }
        aftermath: "{manager} comes back rested, to a week of things that waited for them."
        debrief: A week off for a manager whose team depends on them for everything moves the stress onto the team.
  - id: help-hand-off
    label: Help them pick what to hand to their team
    outcomes:
      - id: delegates
        when: { value: manager.skill, atLeast: 20 }
        effects:
          - { type: value, target: manager, field: stress, amount: -10 }
          - { type: value, target: manager, field: skill, amount: 3, historyNote: Handed parts of their job to their team with your help }
        aftermath: "{manager} hands the release planning to their most senior engineer, who has wanted it for a year."
        debrief: Helping a manager delegate fixes this month's load and the next one's.
      - id: cannot-let-go
        effects:
          - { type: value, target: manager, field: stress, amount: 4 }
        aftermath: "{manager} makes a list and can't bring themselves to hand any of it over."
        debrief: Delegation needs a manager with enough skill to trust someone else's work; below that, it's one more task.
---

{manager} answered messages at midnight four nights this week. In your 1:1 they apologise twice for being slow.
