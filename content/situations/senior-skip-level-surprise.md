---
id: senior-skip-level-surprise
title: What the skip-level heard
levels: [senior-manager]
priority: normal
cooldownWeeks: 26
waitDebrief: "A problem you heard about from below and did nothing with tells the team that skip-levels are for show."
roles:
  - name: manager
    kind: person
    where:
      all:
        - { value: manager.role, is: manager }
        - { value: manager.trust, below: 60 }
  - name: team
    kind: team
    form: aggregate
    where:
      all:
        - { value: team.leader, is: { value: manager.id } }
        - { value: team.stress, atLeast: 40 }
choices:
  - id: raise-with-manager
    label: Raise it with {manager} and ask for their plan
    outcomes:
      - id: plans
        when: { value: manager.trust, atLeast: 35 }
        effects:
          - { type: value, target: manager, field: skill, amount: 3, historyNote: Made a plan for the on-call load after you raised it }
          - { type: value, target: team, field: stress, amount: -6 }
        aftermath: "{manager} is embarrassed for a minute, then comes back with a plan for the rota."
        debrief: Taking what you heard back to the manager lets them fix it, and teaches them to look for it themselves.
      - id: defensive
        effects:
          - { type: value, target: manager, field: trust, amount: -4, historyNote: Felt checked up on after a skip-level }
          - { type: value, target: team, field: stress, amount: -6 }
        aftermath: "{manager} fixes the rota, and wonders who told you."
        debrief: With a manager who doesn't trust you yet, even the right conversation costs a little; it still fixes the problem.
  - id: fix-rota
    label: Fix the on-call rota yourself
    outcomes:
      - id: fixed
        effects:
          - { type: value, target: team, field: stress, amount: -10 }
          - { type: value, target: manager, field: trust, amount: -6, historyNote: Had their on-call rota rewritten over their head }
          - { type: value, target: player, field: stress, amount: 4 }
        aftermath: The rota is better by Friday. {manager} finds out from their team.
        debrief: Fixing a team's problem around its manager works today and teaches the manager nothing, except that you go around them.
  - id: say-nothing
    label: Say nothing, to protect whoever told you
    outcomes:
      - id: kept-quiet
        effects:
          - { type: value, target: team, field: stress, amount: 4 }
          - { type: value, target: team, field: attritionRisk, amount: 5 }
        aftermath: Nothing changes, and the engineer who spoke up notices.
        debrief: You can raise a problem without naming its source; staying silent protects nobody.
---

In a skip-level, one of {team}'s engineers says on-call is wearing everyone down: three pages a night some weeks. {manager} hasn't mentioned it.
