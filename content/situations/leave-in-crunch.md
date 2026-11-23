---
id: leave-in-crunch
title: Two weeks off, mid-crunch
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "Leave requests don't wait well. Someone who hears nothing either cancels quietly or goes anyway, and either way the plan didn't account for it."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.stress, atLeast: 40 }
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.weeksToDeadline, atLeast: 1 }
        - { value: project.weeksToDeadline, atMost: 8 }
choices:
  - id: wait-until-after
    label: "Ask {engineer} to wait until {project} ships"
    outcomes:
      - id: postponed
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: trust
            amount: -5
            historyNote: You asked them to put off their leave
          - type: value
            target: engineer
            field: motivation
            amount: -5
        aftermath: "{engineer} agrees, flatly, and moves the booking."
        debrief: "Asking a stretched person to keep going protects the date this week and spends the trust you'll need next time."
  - id: approve-replan
    label: "Approve it, and re-plan {project} openly with the stakeholders"
    outcomes:
      - id: replanned
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -15
            historyNote: Took two weeks off
          - type: value
            target: engineer
            field: trust
            amount: 4
          - type: value
            target: project
            field: deadlineWeek
            amount: 1
          - type: value
            target: player
            field: reputation
            amount: -1
        aftermath: "The stakeholders grumble about the week, then plan around it. {engineer} comes back rested."
        debrief: "Leave in a crunch is a planning problem, not a loyalty test. Moving the date in the open costs a little goodwill once."
  - id: approve-quietly
    label: "Approve it and say nothing to the stakeholders"
    outcomes:
      - id: quiet
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -15
            historyNote: Took two weeks off
          - type: value
            target: project
            field: risk
            amount: 12
        aftermath: "{engineer} goes. The plan still assumes they're here."
        debrief: "Approving the leave was right; hiding its effect on the plan just moves the surprise to the deadline."
---

{engineer} asks for two weeks off. They've been working flat out, and {project} is due within two months.
