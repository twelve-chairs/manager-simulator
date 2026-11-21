---
id: scope-creep
title: Just one more feature
levels: [line-manager]
priority: normal
cooldownWeeks: 8
waitDebrief: "A request left unanswered gets answered for you, usually by the team quietly absorbing the extra work."
roles:
  - name: project
    kind: project
    where:
      value: project.behind
      is: false
choices:
  - id: agree
    label: Agree to add it
    outcomes:
      - id: too-late
        when:
          value: project.weeksToDeadline
          below: 8
        effects:
          - type: value
            target: project
            field: scope
            amount: 15
          - type: value
            target: project
            field: risk
            amount: 8
          - type: value
            target: player
            field: reputation
            amount: 2
        aftermath: "The stakeholder is delighted. The team looks at the calendar."
        debrief: "Late scope with no trade puts the deadline at risk, and the goodwill lasts only until the date slips."
      - id: room-for-it
        effects:
          - type: value
            target: project
            field: scope
            amount: 15
          - type: value
            target: player
            field: reputation
            amount: 3
        aftermath: "The stakeholder is delighted."
        debrief: "Saying yes early, with time to absorb it, is cheaper than saying yes late, but it still has to be paid for."
  - id: trade
    label: Offer to swap it for something lower-priority
    outcomes:
      - id: traded
        effects:
          - type: value
            target: project
            field: scope
            amount: 5
          - type: value
            target: player
            field: reputation
            amount: 2
        aftermath: "They pick something to drop. Everyone gets most of what they wanted."
        debrief: "Making the trade explicit keeps scope honest and keeps stakeholders on your side."
  - id: decline
    label: Decline
    outcomes:
      - id: declined
        effects:
          - type: value
            target: player
            field: reputation
            amount: -3
        aftermath: "The stakeholder takes it to your manager."
        debrief: "A flat no protects the plan but costs goodwill; offering a trade usually gets more."
---

A stakeholder on {project} asks for "one small addition" that isn't small.
