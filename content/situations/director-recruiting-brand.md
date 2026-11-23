---
id: director-recruiting-brand
title: The recruiting brand
levels: [director]
priority: normal
cooldownWeeks: 52
waitDebrief: "An invitation to show the organization, left to lapse, goes to an organization that answered."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
choices:
  - id: self
    label: Give the talk yourself
    outcomes:
      - id: you
        effects:
          - { type: value, target: player, field: reputation, amount: 3 }
          - { type: value, target: player, field: stress, amount: 4 }
          - { type: value, target: lead, field: motivation, amount: -2 }
        aftermath: The talk goes well. It took three evenings you didn't have.
        debrief: Giving every talk yourself builds your name instead of your organization's.
  - id: senior-on-stage
    label: Put {lead} on stage
    outcomes:
      - id: anxious-speaker
        when: { value: lead.personality, is: anxious }
        effects:
          - { type: value, target: lead, field: stress, amount: 5 }
          - { type: value, target: lead, field: motivation, amount: 5, wantTags: { serves: [recognition, growth] }, historyNote: Gave the conference keynote }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "{lead} is sick with nerves beforehand and excellent on stage. Applications to the organization double."
        debrief: Putting a senior manager on stage grows them and the organization's name, even when it is hard for them.
      - id: speaker
        effects:
          - { type: value, target: lead, field: motivation, amount: 6, wantTags: { serves: [recognition, growth] }, historyNote: Gave the conference keynote }
          - { type: value, target: player, field: reputation, amount: 3 }
        aftermath: "{lead} gives the talk of the day. Three good candidates mention it in interviews."
        debrief: Putting a senior manager on stage grows them, and shows candidates the people they would work for.
  - id: decline
    label: Decline; it's a distraction
    outcomes:
      - id: declined
        effects:
          - { type: value, target: player, field: reputation, amount: -2 }
        aftermath: Another director's organization gives the keynote. Their recruiting has a good quarter.
        debrief: Declining every chance to show the organization leaves candidates to find someone else's.
---

Marketing wants your organization in a conference keynote next quarter, about what it builds and how.
