---
id: director-specialty-group
title: The specialty group asks for time
levels: [director]
priority: normal
cooldownWeeks: 104
waitDebrief: "A group of people who want to make the organization better, left without an answer, usually stops asking."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: group
    kind: team
    form: aggregate
    where: { value: group.leader, is: { value: lead.id } }
choices:
  - id: own-time
    label: Allow it, on their own time
    outcomes:
      - id: evenings
        effects:
          - { type: value, target: group, field: stress, amount: 3 }
        aftermath: The guild meets in the evenings for a while. Then it doesn't.
        debrief: Allowing good work only on people's own time tells them it isn't really work.
  - id: sponsor
    label: Back it, with {lead} as its sponsor
    outcomes:
      - id: sponsored
        effects:
          - { type: value, target: group, field: motivation, amount: 5 }
          - { type: value, target: group, field: attritionRisk, amount: -3 }
          - { type: value, target: lead, field: skill, amount: 2, historyNote: Sponsored the accessibility guild }
        aftermath: "The guild's first fix ships in a month. {lead} starts bringing its notes to your staff meeting."
        debrief: A specialty group with a sponsor and a little time improves the work and keeps the people who care.
  - id: no
    label: Say no; the bets come first
    outcomes:
      - id: refused
        effects:
          - { type: value, target: group, field: motivation, amount: -5 }
          - { type: value, target: group, field: attritionRisk, amount: 3 }
        aftermath: The engineers who asked stop raising ideas in meetings.
        debrief: Refusing a few hours for work people care about saves little and costs their belief that it matters here.
---

Engineers across {group} want a few hours a month for an accessibility guild. They've already written a plan.
