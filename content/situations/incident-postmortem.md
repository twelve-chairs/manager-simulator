---
id: incident-postmortem
title: The morning after
levels: [line-manager]
priority: normal
cooldownWeeks: 6
time: morning
roles:
  - name: project
    kind: project
    where:
      value: project.risk
      atLeast: 50
  - name: engineer
    kind: person
choices:
  - id: move-on
    label: The fix is in. Move on
    outcomes:
      - id: comes-back
        effects:
          - type: value
            target: project
            field: risk
            amount: 3
        aftermath: "The team gets back to the roadmap. The outage is a line in the incident channel."
        debrief: "An outage nobody looks back at tends to happen again. Even a short review finds the cause while everyone still remembers it."
  - id: blameless
    label: Run a blameless postmortem with the team
    outcomes:
      - id: finds-the-cause
        effects:
          - type: value
            target: player
            field: stress
            amount: 4
          - type: value
            target: project
            field: risk
            amount: -6
          - type: value
            target: engineer
            field: trust
            amount: 4
            historyNote: Walked the team through their outage
        aftermath: "{engineer} walks everyone through the timeline. The real cause is a missing check in the deploy, and the team writes two follow-ups."
        debrief: "A blameless postmortem asks how the system let a mistake through, not who made it. People tell you what really happened, and the fixes land where the next outage would start."
  - id: blame
    label: "Ask {engineer} why they shipped it"
    outcomes:
      - id: closes-up
        effects:
          - type: value
            target: engineer
            field: trust
            amount: -6
          - type: value
            target: engineer
            field: motivation
            amount: -8
            historyNote: Was asked to explain the outage alone
          - type: value
            target: engineer
            field: stress
            amount: 6
          - type: value
            target: project
            field: risk
            amount: -2
        aftermath: "{engineer} apologizes and promises to be more careful. Nobody else says much."
        debrief: "Asking one person to answer for an outage teaches the whole team to hide mistakes. You get an apology instead of the cause, and the gap that let it through stays open."
---

Last night's outage traced back to a change from {project}. It's fixed, {engineer} was the one who shipped it, and the team is quiet at stand-up. What now?
