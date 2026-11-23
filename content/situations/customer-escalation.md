---
id: customer-escalation
title: An angry customer
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "An angry customer left waiting gets angrier and escalates over your head. The engineer who was on the thread takes the heat."
roles:
  - name: project
    kind: project
    where:
      all:
        - { value: project.team, is: { value: player.team } }
        - { value: project.status, is: active }
        - { value: project.risk, atLeast: 60 }
  - name: engineer
    kind: person
    where: { value: engineer.team, is: { value: player.team } }
choices:
  - id: join-call
    label: "Join the call with {engineer} and own the plan"
    outcomes:
      - id: owned
        effects:
          - type: value
            target: engineer
            field: stress
            amount: -6
          - type: value
            target: engineer
            field: trust
            amount: 4
            historyNote: You backed them on a call with an angry customer
          - type: value
            target: player
            field: stress
            amount: 6
          - type: value
            target: player
            field: reputation
            amount: 2
        aftermath: "The customer is still unhappy, but leaves the call with a plan and a name to hold to it."
        debrief: "Back your engineer in front of the customer and take the plan on yourself. Promise only what you can deliver."
  - id: let-engineer
    label: "Let {engineer} handle it"
    outcomes:
      - id: alone
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 10
          - type: value
            target: engineer
            field: trust
            amount: -3
            historyNote: Faced an angry customer alone
        aftermath: "{engineer} takes the call. It runs long."
        debrief: "Leaving an engineer alone with an angry customer tells them, and the customer, that nobody above them owns the problem."
  - id: promise-date
    label: Promise a fix date on the spot
    outcomes:
      - id: promised
        effects:
          - type: value
            target: player
            field: reputation
            amount: 3
          - type: value
            target: project
            field: risk
            amount: 10
          - type: value
            target: engineer
            field: stress
            amount: 5
        aftermath: "The customer calms down. The team hears about the date from the customer's follow-up email."
        debrief: "A date promised to end a call is a date the team didn't agree to, and the customer will hold you to it."
---

A customer is furious about problems with {project} and wants a call today. {engineer} has been answering their emails.
