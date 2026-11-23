---
id: director-belonging-survey
title: A belonging survey surprise
levels: [director]
priority: normal
cooldownWeeks: 52
waitDebrief: "Survey results that go unanswered tell people the survey was the point, not them."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: group
    kind: team
    form: aggregate
    where:
      all:
        - { value: group.leader, is: { value: lead.id } }
        - { value: group.motivation, below: 65 }
choices:
  - id: share
    label: Ask {lead} to share the results with {group}, and act on them
    outcomes:
      - id: shared
        when: { value: lead.trust, atLeast: 45 }
        effects:
          - { type: value, target: group, field: motivation, amount: 6 }
          - { type: value, target: lead, field: skill, amount: 2, historyNote: Shared a hard survey with their group and acted on it }
        aftermath: "{lead} reads the results to the group, unedited, and asks for three changes. They make two."
        debrief: Having the senior manager own hard results with their group, and act, rebuilds what the survey found missing.
      - id: guarded
        effects:
          - { type: value, target: group, field: motivation, amount: 3 }
          - { type: value, target: lead, field: stress, amount: 4 }
        aftermath: "{lead} shares a summary, carefully. It helps a little."
        debrief: A senior manager who doesn't trust you yet will soften the results; it still helps more than silence.
  - id: sessions
    label: Hold listening sessions yourself
    outcomes:
      - id: around
        effects:
          - { type: value, target: group, field: motivation, amount: 3 }
          - { type: value, target: lead, field: trust, amount: -6, historyNote: Had you listen to their group around them }
        aftermath: People talk to you. {lead} hears about it secondhand.
        debrief: Listening around a senior manager helps once and undermines them; the next problem won't come to them.
  - id: noise
    label: Treat it as noise
    outcomes:
      - id: ignored
        effects:
          - { type: value, target: group, field: motivation, amount: -4 }
          - { type: value, target: group, field: attritionRisk, amount: 4 }
        aftermath: The next survey's response rate drops by a third.
        debrief: Dismissing a survey is a reply people hear clearly.
---

The belonging survey's free-text answers from {group} say the same thing in different words: people don't feel heard.
