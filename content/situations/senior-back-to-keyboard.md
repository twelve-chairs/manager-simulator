---
id: senior-back-to-keyboard
title: Back to the keyboard
levels: [senior-manager]
priority: normal
once: true
waitDebrief: "A manager who wants to stop managing doesn't get better at it while they wait for an answer, and neither does their team."
roles:
  - name: manager
    kind: person
    where:
      all:
        - { value: manager.role, is: manager }
        - { value: manager.skill, below: 40 }
        - { value: manager.motivation, below: 45 }
        - { value: manager.want, isNot: growth }
  - name: team
    kind: team
    form: aggregate
    where: { value: team.leader, is: { value: manager.id } }
choices:
  - id: talk-into-staying
    label: Talk them into giving it another year
    outcomes:
      - id: persuaded
        when: { value: manager.trust, atLeast: 60 }
        effects:
          - { type: value, target: manager, field: motivation, amount: 6, historyNote: Agreed to give managing another year }
        aftermath: "{manager} agrees to try another year, mostly for you."
        debrief: Trust can buy a reluctant manager another year, but it doesn't make them want the job.
      - id: stays-unhappy
        effects:
          - { type: value, target: manager, field: motivation, amount: -6, historyNote: Was talked out of going back to engineering }
          - { type: value, target: team, field: motivation, amount: -3 }
        aftermath: "{manager} stays. Their heart isn't in it, and their team can tell."
        debrief: A manager kept in the role against their wishes brings their team down with them.
  - id: help-move-back
    label: Help them move back to engineering on their team
    outcomes:
      - id: moves-back
        effects:
          - { type: value, target: team, field: headcount, amount: 1 }
          - { type: value, target: team, field: stress, amount: 5 }
          - { type: remove, personId: manager, reason: transferred }
        aftermath: "{manager} goes back to writing code, visibly lighter. {team} needs a new manager."
        debrief: Letting someone step back from management is a loss you can plan for; a manager who doesn't want the job is one you can't.
  - id: phase
    label: Tell them it's a phase every new manager goes through
    outcomes:
      - id: brushed-off
        effects:
          - { type: value, target: manager, field: motivation, amount: -8 }
          - { type: value, target: manager, field: trust, amount: -5, historyNote: Was told missing engineering is a phase }
        aftermath: "{manager} nods and doesn't bring it up again."
        debrief: Brushing off a manager's doubt teaches them not to tell you the next one.
---

In your 1:1, {manager} admits they miss engineering. Some weeks they open an editor after everyone has gone home, just to feel useful.
