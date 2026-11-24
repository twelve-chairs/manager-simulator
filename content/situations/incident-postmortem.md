---
id: incident-postmortem
title: The morning after
levels: [line-manager]
priority: normal
cooldownWeeks: 13
time: morning
waitDebrief: "An outage nobody looks back at tends to happen again. The cause is easiest to find while everyone still remembers it."
roles:
  - name: project
    kind: project
    where:
      value: project.risk
      atLeast: 50
  # Someone on the team who handled a night page this week or last, so the scene follows a real outage.
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - any:
            - { history: engineer, note: Handled a night page alone, withinWeeks: 2, atLeast: 1 }
            - { history: engineer, note: Handled a night page with you, withinWeeks: 2, atLeast: 1 }
            - { history: engineer, action: line-manager.on-call, withinWeeks: 2, atLeast: 1 }
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
  - id: fix-the-cause
    label: "Put the outage's follow-ups ahead of the roadmap on {project} for a week"
    outcomes:
      - id: fixed
        effects:
          - { type: value, target: project, field: techDebt, amount: -12 }
          - { type: value, target: project, field: risk, amount: -8 }
          - { type: value, target: project, field: progress, amount: -6 }
          - { type: value, target: player, field: stress, amount: 2 }
        aftermath: "The team spends the week on the deploy checks and the brittle code behind last night. {project} slips, and nobody talks much about who shipped what."
        debrief: "Fixing what let the outage through stops the next one, at a cost in delivery now. It doesn't tell {engineer} you have their back; a postmortem does that."
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

Last night's outage traced back to a change from {project}. It's fixed, {engineer} was the one on the call, and the team is quiet at stand-up. A postmortem looks after the people; fixing the debt behind it looks after the system. There's time for one this week.
