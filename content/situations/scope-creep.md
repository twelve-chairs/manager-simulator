---
id: scope-creep
title: Just one more feature
levels: [line-manager]
priority: normal
cooldownWeeks: 26
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
        when:
          value: player.reputation
          atLeast: 50
        effects:
          - { type: value, target: project, field: scope, amount: 5 }
          - { type: value, target: player, field: reputation, amount: 2 }
        aftermath: "They pick something smaller to drop, so {project} still grows a little. Everyone gets most of what they wanted."
        debrief: "Making the trade explicit keeps scope honest and keeps stakeholders on your side, when they trust your judgement of what matters."
      - id: no-swap
        effects:
          - { type: value, target: project, field: scope, amount: 12 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The stakeholder won't give anything up. After two meetings, {project} takes most of the addition and nothing comes off."
        debrief: "A swap needs the stakeholder to accept your view of what's lower-priority. Without the standing for that, you negotiate yourself into the yes you were trying to avoid."
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

A stakeholder on {project} asks for "one small addition" that isn't small. Whether they'll swap it for something else depends on how much they trust your judgement; with plenty of runway, a yes is cheaper than it looks.
