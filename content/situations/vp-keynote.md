---
id: vp-keynote
title: A conference keynote
levels: [vp]
priority: normal
cooldownWeeks: 52
waitDebrief: "An invitation left unanswered goes to someone else's function, and so do the people it would have drawn."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
choices:
  - id: send-lead
    label: Send {lead} to give it, with your help on the talk
    outcomes:
      - id: sent
        effects:
          - { type: value, target: lead, field: motivation, amount: 6, wantTags: { serves: [recognition, growth] }, historyNote: Gave a conference keynote for the function }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "{lead}'s talk is the one people quote afterwards. Applications to the function pick up."
        debrief: Putting a director on the stage markets the function through the people who built it, and grows them.
  - id: give-it
    label: Give it yourself
    outcomes:
      - id: gave
        effects:
          - { type: value, target: player, field: reputation, amount: 3 }
          - { type: value, target: player, field: stress, amount: 5 }
        aftermath: The talk goes well. It took three evenings you didn't have.
        debrief: Giving every keynote yourself raises your profile and teaches the function that the stage is yours.
  - id: decline
    label: Decline; there's too much on
    outcomes:
      - id: declined
        effects:
          - { type: value, target: player, field: reputation, amount: -1 }
        aftermath: The organizers thank you, and ask a peer company instead.
        debrief: Declining saves the time and gives up a chance to show people why they would want to work for you.
---

A large engineering conference invites your function to give a keynote about how it builds and ships.
