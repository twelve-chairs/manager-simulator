---
id: director-executive-pet-project
title: The executive's pet project
levels: [director]
priority: normal
cooldownWeeks: 104
waitDebrief: "An executive's request left unanswered gets answered for you, usually with the most stretched group's time."
roles:
  - name: executive
    kind: person
    where: { value: executive.role, is: executive }
  - name: group
    kind: team
    form: aggregate
    where: { value: group.stress, atLeast: 20 }
choices:
  - id: yes
    label: Say yes, and spread it thin
    outcomes:
      - id: spread
        effects:
          - { type: value, target: executive, field: trust, amount: 4 }
          - { type: value, target: group, field: stress, amount: 8 }
        aftermath: "{executive} is pleased. {group} absorbs another thing it has no room for."
        debrief: Saying yes to work nobody has room for buys the executive's favour with the group's time.
  - id: no
    label: Say no
    outcomes:
      - id: refused
        effects:
          - { type: value, target: executive, field: trust, amount: -6, historyNote: Was told no to a project of theirs }
        aftermath: "{executive} says they understand. They don't bring it up again, or much else."
        debrief: A flat no protects the group and leaves the executive without a reason they can use.
  - id: trade-off
    label: Show what it would displace, and let {executive} choose
    outcomes:
      - id: chosen
        effects:
          - { type: value, target: executive, field: trust, amount: 3, historyNote: Was shown the trade-off and chose }
        aftermath: "{executive} looks at the list for a while, and picks the existing work. The idea can wait a quarter."
        debrief: Showing what a new request would displace turns a yes or no into the executive's own choice.
---

{executive} has an idea they want staffed this quarter. No group has room for it, and {group} would be the one to carry it.
