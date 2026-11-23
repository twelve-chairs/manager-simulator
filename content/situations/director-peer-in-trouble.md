---
id: director-peer-in-trouble
title: A peer in trouble
levels: [director]
priority: normal
cooldownWeeks: 52
waitDebrief: "A peer in trouble you didn't answer will remember who did."
roles:
  - name: peer
    kind: person
    where: { value: peer.role, is: peer }
  - name: group
    kind: team
    form: aggregate
    where: { value: group.headcount, atLeast: 6 }
choices:
  - id: lend-two
    label: Lend two of {group}'s strongest for a quarter
    outcomes:
      - id: lent
        effects:
          - { type: value, target: peer, field: trust, amount: 10, historyNote: Was lent two engineers when they needed them }
          - { type: value, target: group, field: stress, amount: 10 }
        aftermath: "{peer}'s release ships. {group} spends the quarter short-handed and stretched."
        debrief: Lending your strongest people wins a peer's gratitude and costs your own group a hard quarter.
  - id: lend-one
    label: Lend one, with a clear end date
    outcomes:
      - id: one
        effects:
          - { type: value, target: peer, field: trust, amount: 6, historyNote: Was lent an engineer with a clear end date }
          - { type: value, target: group, field: stress, amount: 4 }
        aftermath: "One engineer goes over for eight weeks. {peer} sends a thank-you to your executive."
        debrief: Helping a peer within what your group can carry, on a clear timeline, keeps both organizations whole.
  - id: refuse
    label: Refuse
    outcomes:
      - id: refused
        effects:
          - { type: value, target: peer, field: trust, amount: -8, historyNote: Was refused help when their organization was failing }
        aftermath: "{peer} finds the people elsewhere, eventually."
        debrief: Refusing a peer in trouble protects your group this quarter and spends a relationship you will need.
---

{peer}'s organization is failing a launch, and they ask for two of {group}'s strongest engineers for a quarter.
