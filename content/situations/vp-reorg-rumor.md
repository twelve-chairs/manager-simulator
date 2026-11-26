---
id: vp-reorg-rumor
title: A reorg rumour
levels: [vp]
priority: normal
cooldownWeeks: 52
waitDebrief: "A rumour nobody answers is answered anyway, by whoever is most worried."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: division
    kind: team
    form: aggregate
    where: { value: division.leader, is: { value: lead.id } }
choices:
  - id: tell-known
    label: Tell your directors what is known, what isn't, and when you'll know more
    outcomes:
      - id: told
        effects:
          - { type: value, target: division, field: stress, amount: -5 }
          - { type: value, target: lead, field: trust, amount: 5, historyNote: "Was told what you knew about the reorg, and what you didn't" }
        aftermath: "{lead} passes it on word for word. The questions in {division} get more specific, and calmer."
        debrief: Saying what you know and don't, with a date, gives people something to hold that a denial can't.
  - id: deny
    label: Deny there's anything to it
    outcomes:
      - id: denied
        effects:
          - { type: value, target: division, field: stress, amount: 2 }
          - { type: value, target: lead, field: trust, amount: -6, historyNote: Heard you deny a reorg that was being discussed }
        aftermath: People nod. Nobody believes it, and the rumour grows a second version.
        debrief: A denial nobody believes adds a second worry to the first, about whether you'll be straight.
  - id: wait-and-see
    label: Wait until there's something definite to say
    outcomes:
      - id: waited
        effects:
          - { type: value, target: division, field: stress, amount: 6 }
          - { type: value, target: division, field: attritionRisk, amount: 4 }
        aftermath: Two of {division}'s engineers take recruiter calls that week.
        debrief: Waiting for certainty leaves the function to fill the silence with its worst guess.
---

A rumour is going round {division}: the function is being reorganized, and some teams will be folded away. The leadership team has discussed it, and decided nothing yet.
