---
id: incident-2am
title: Paged at 2 a.m.
levels: [line-manager]
priority: urgent
cooldownWeeks: 6
time: night
roles:
  - name: project
    kind: project
    where:
      value: project.risk
      atLeast: 50
  - name: engineer
    kind: person
choices:
  - id: join
    label: Join the incident call yourself
    outcomes:
      - id: hero
        effects:
          - type: value
            target: player
            field: stress
            amount: 8
          - type: value
            target: project
            field: risk
            amount: -5
          - type: value
            target: player
            field: reputation
            amount: 3
        aftermath: "You're on the call until four. It's fixed."
        debrief: "Jumping in fixes tonight, but if you are always the one on the call, the team never learns to handle it and you burn out."
  - id: back-up
    label: "Let {engineer}, on call, lead, and back them up"
    outcomes:
      - id: handles-it
        when:
          value: engineer.skill
          atLeast: 50
        effects:
          - type: value
            target: engineer
            field: skill
            amount: 3
            historyNote: Led an incident with your backup
          - type: value
            target: engineer
            field: stress
            amount: 5
          - type: value
            target: engineer
            field: trust
            amount: 4
          - type: value
            target: project
            field: risk
            amount: -5
        aftermath: "{engineer} handles it, with you on the line for questions."
        debrief: "Backing someone up while they lead builds a team that can handle incidents without you."
      - id: struggles
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 10
            historyNote: Struggled through an incident
          - type: value
            target: project
            field: risk
            amount: 3
          - type: value
            target: player
            field: reputation
            amount: -2
        aftermath: "{engineer} struggles through it. It takes until morning."
        debrief: "Leading an incident takes experience. Pair less experienced engineers with someone who has done it before they are on their own."
  - id: morning
    label: Deal with it in the morning
    outcomes:
      - id: angry-customer
        effects:
          - type: value
            target: player
            field: reputation
            amount: -6
          - type: value
            target: project
            field: progress
            amount: -5
        aftermath: The morning starts with an angry customer email.
        debrief: "Some things can wait until morning. An outage is not one of them."
---

Your phone lights up at 2:07. {project} is down, and {engineer} is the one on call.
