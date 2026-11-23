---
id: leave-asked-again
title: "The leave, again"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "Leave put off twice stops being leave and becomes a grievance."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          situation: leave-in-crunch
          choice: wait-until-after
          withinWeeks: 26
          atLeast: 1
choices:
  - id: one-more
    label: "Ask them to wait for one more milestone"
    outcomes:
      - id: frayed
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: motivation
            amount: -5
          - type: value
            target: engineer
            field: trust
            amount: -5
            historyNote: Was asked to put off their leave again
        aftermath: "{engineer} says \"fine\" in the voice people use when it isn't."
        debrief: "There is always one more milestone. Asking twice teaches someone that their rest is negotiable and their manager isn't."
  - id: book-it
    label: "Book it now, and cover their work"
    outcomes:
      - id: rested
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -8
            historyNote: Got the leave they had put off
          - type: value
            target: engineer
            field: trust
            amount: 3
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "{engineer} books two weeks. Their out-of-office is the cheeriest thing you've read all month."
        debrief: "Leave you asked someone to postpone is a debt. Paying it promptly is what makes asking again possible one day."
  - id: long-weekend
    label: "Offer a long weekend now and the rest later"
    outcomes:
      - id: half
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -3
        aftermath: "{engineer} takes the Friday off. It helps a little."
        debrief: "A long weekend takes the edge off; it doesn't pay the debt."
---

{engineer} asks about the leave you asked them to put off. "The crunch is over, isn't it? I'm running on empty."
