---
id: outage-hidden
title: "A quiet fix"
levels: [line-manager]
priority: normal
once: true
waitDebrief: "A mistake fixed in silence teaches the system nothing."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - history: engineer
          situation: incident-postmortem
          choice: blame
          withinWeeks: 26
          atLeast: 1
choices:
  - id: file-it
    label: "Ask them to file an incident for it"
    outcomes:
      - id: by-the-book
        effects:
          - type: value
            target: engineer
            field: stress
            amount: 4
          - type: value
            target: engineer
            field: trust
            amount: -2
        aftermath: "{engineer} files it, flatly, in as few words as the template allows."
        debrief: "Process without safety produces paperwork, not learning."
  - id: safe
    label: "Thank them for the fix, and say you want to hear about the next one, no blame"
    outcomes:
      - id: opens
        effects:
          - type: value
            target: engineer
            field: trust
            amount: 5
            historyNote: You made it safe to report a mistake
          - type: value
            target: engineer
            field: stress
            amount: -3
        aftermath: "A week later {engineer} flags a near-miss in standup. Two people say they've seen the same thing."
        debrief: "People hide mistakes where mistakes are punished. Saying out loud that reporting is safe, and meaning it, is how you get the near-misses back."
  - id: ignore
    label: "Let it go; it's fixed"
    outcomes:
      - id: silent
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -1
        aftermath: "Nothing happens. That's the problem."
        debrief: "The fix that nobody hears about is the one the next person makes again."
---

You notice a late-night commit from {engineer} that quietly fixes a config they broke. No incident was filed. Since the last postmortem, they haven't raised anything.
