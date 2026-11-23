---
id: director-staff-meeting-leak
title: The leak
levels: [director]
priority: normal
once: true
waitDebrief: "A leak nobody addresses becomes how information moves in the organization."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
choices:
  - id: hunt
    label: Find out who leaked it
    outcomes:
      - id: hunted
        effects:
          - { type: value, target: lead, field: trust, amount: -6, historyNote: Was questioned about a leak from your staff meeting }
          - { type: value, target: player, field: stress, amount: 3 }
        aftermath: "You find out. Your staff meeting gets very quiet afterwards, {lead} quietest of all."
        debrief: Hunting a leaker teaches everyone in the room to say less, which is the opposite of what a staff meeting is for.
  - id: ignore
    label: Ignore it
    outcomes:
      - id: ignored
        effects:
          - { type: value, target: lead, field: stress, amount: 3 }
        aftermath: The next leak comes a month later, about something worse.
        debrief: Ignoring a leak leaves nobody sure what is safe to say, in the room or outside it.
  - id: agreement
    label: Tell your senior managers what you'll share with whom from now on, and do it
    outcomes:
      - id: agreed
        effects:
          - { type: value, target: lead, field: trust, amount: 4, historyNote: Agreed with you what the staff meeting shares and with whom }
          - { type: value, target: lead, field: motivation, amount: 2 }
        aftermath: "The staff meeting agrees what's for the room and what goes to the groups. {lead} says it's a relief."
        debrief: Saying plainly what you will share and when removes most of the reason anyone leaks.
---

Something said in your staff meeting about next year's budget has reached the engineers in {lead}'s group, word for word.
