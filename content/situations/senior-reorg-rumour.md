---
id: senior-reorg-rumour
title: Reorg rumour
levels: [senior-manager]
priority: normal
once: true
waitDebrief: "Rumours fill silence. A team that hears nothing from you assumes the worst version."
roles:
  - name: manager
    kind: person
    where: { value: manager.role, is: manager }
  - name: team
    kind: team
    form: aggregate
    where: { value: team.leader, is: { value: manager.id } }
choices:
  - id: deny
    label: Tell them there's nothing to it
    outcomes:
      - id: denied
        effects:
          - { type: value, target: manager, field: trust, amount: -4, historyNote: Was told there was nothing to a rumour that had something to it }
          - { type: value, target: team, field: motivation, amount: -3 }
        aftermath: "{manager} passes it on. Nobody on {team} quite believes it."
        debrief: A flat denial of something half-true costs you trust when the true half arrives.
  - id: say-nothing
    label: Say nothing until it's official
    outcomes:
      - id: silence
        effects:
          - { type: value, target: team, field: motivation, amount: -5 }
          - { type: value, target: team, field: attritionRisk, amount: 5 }
        aftermath: The rumour grows a new detail every day.
        debrief: Silence doesn't stop a rumour; it hands the story to whoever is most worried.
  - id: tell-what-you-know
    label: Tell your managers what you know and what you don't
    outcomes:
      - id: told
        effects:
          - { type: value, target: manager, field: trust, amount: 4, historyNote: Was told plainly what you knew about a reorg }
          - { type: value, target: team, field: motivation, amount: 2 }
        aftermath: "{manager} takes it back to {team}: some plans, nothing decided, and a promise to hear first."
        debrief: Saying what you know and what you don't is the one answer that stays true whatever happens next.
---

{manager} asks you directly: {team} has heard your group is being merged into another. There are early plans you've seen, and nothing has been decided.
