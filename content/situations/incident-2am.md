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
  - id: roll-back
    label: "Tell {engineer} to roll back and sort it out tomorrow"
    outcomes:
      - id: rolled-back
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 3
            historyNote: Rolled back a bad change at night
          - type: value
            target: project
            field: progress
            amount: -3
        aftermath: "{engineer} rolls the change back by half past two. The fix waits for daylight."
        debrief: "Rolling back first and fixing in daylight is often the right call. It ends the outage fast, at the cost of redoing the work, but it leaves the cause unexamined and the engineer still on their own."
---

Your phone lights up at 2:07. A change from {project} has taken production down, and {engineer} is the one on call.
