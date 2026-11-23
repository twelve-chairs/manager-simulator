---
id: senior-protected-low-performer
title: The protected low performer
levels: [senior-manager]
priority: normal
cooldownWeeks: 26
waitDebrief: "A low performer protected by their manager is carried by the rest of the team, and the team keeps count."
roles:
  - name: manager
    kind: person
    where: { value: manager.role, is: manager }
  - name: team
    kind: team
    form: aggregate
    where:
      all:
        - { value: team.leader, is: { value: manager.id } }
        - { value: team.ratings.meets, atLeast: 2 }
        - { value: team.skill, below: 50 }
choices:
  - id: accept
    label: Accept their judgment
    outcomes:
      - id: accepted
        effects:
          - { type: value, target: team, field: motivation, amount: -4 }
          - { type: value, target: team, field: attritionRisk, amount: 3 }
        aftermath: "{manager} is relieved. The engineers covering for their colleague are not."
        debrief: Deferring to a manager who is protecting someone leaves the people doing the extra work without anyone on their side.
  - id: plan-with-dates
    label: Ask {manager} for a plan with dates
    outcomes:
      - id: real-plan
        when: { value: manager.skill, atLeast: 40 }
        effects:
          - { type: value, target: manager, field: skill, amount: 3, historyNote: Wrote a performance plan with dates for someone they had been protecting }
          - { type: value, target: team, field: motivation, amount: 3 }
        aftermath: "{manager} comes back with a plan, dates and all. The team notices something is happening."
        debrief: Asking the manager for a plan keeps the problem theirs to solve and gives them the practice.
      - id: struggles
        effects:
          - { type: value, target: manager, field: skill, amount: 2, historyNote: Wrote their first performance plan }
          - { type: value, target: manager, field: stress, amount: 5 }
        aftermath: "{manager} writes their first plan. It takes three drafts and most of a week."
        debrief: A less experienced manager finds the plan hard, and learns more from writing it than from anything else that month.
  - id: go-around
    label: Talk to the engineer yourself
    outcomes:
      - id: around
        effects:
          - { type: value, target: manager, field: trust, amount: -8, historyNote: Had you talk to one of their people over their head }
          - { type: value, target: team, field: motivation, amount: 2 }
        aftermath: The engineer is surprised to hear from you. {manager} is more surprised.
        debrief: Going around a manager to their report fixes nothing about the manager, and costs you the manager's trust.
---

Ratings proposals are in. {manager} has someone on {team} rated as meeting expectations again, though their teammates have been quietly finishing their work for months.
