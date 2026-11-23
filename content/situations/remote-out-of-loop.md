---
id: remote-out-of-loop
title: Out of the loop
levels: [line-manager]
priority: normal
cooldownWeeks: 13
waitDebrief: "Being left out of decisions is quiet. Nothing happens until someone who stopped hearing about things stops caring about them."
roles:
  - name: engineer
    kind: person
    where:
      all:
        - { value: engineer.team, is: { value: player.team } }
        - { value: engineer.personality, is: quiet }
        - { value: engineer.motivation, below: 50 }
choices:
  - id: write-first
    label: "Move the team's decisions into writing, for everyone"
    outcomes:
      - id: written
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 8
            wantTags:
              serves: [autonomy]
          - type: value
            target: engineer
            field: trust
            amount: 4
            historyNote: You changed how the team decides things
          - type: value
            target: player
            field: stress
            amount: 3
        aftermath: "Decisions now land in a shared doc first. {engineer} comments on three of them in the first week."
        debrief: "Fix the process that leaves people out, rather than asking them to fit it. Writing helps everyone who wasn't in the room."
  - id: private
    label: "Check in with {engineer} privately"
    outcomes:
      - id: checked-in
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: 3
          - type: value
            target: engineer
            field: trust
            amount: 2
            historyNote: You asked how they were finding things
        aftermath: "{engineer} appreciates it. Next week's decisions still happen in a call they weren't on."
        debrief: "A private check-in shows you noticed, but the meetings that left them out are still running."
  - id: speak-up
    label: "Tell {engineer} to speak up more in meetings"
    outcomes:
      - id: told
        effects:
          - type: value
            target: engineer
            field: motivation
            amount: -6
          - type: value
            target: engineer
            field: trust
            amount: -5
          - type: value
            target: engineer
            field: stress
            amount: 5
            historyNote: Told to speak up more
        aftermath: "{engineer} nods. In the next meeting they say even less."
        debrief: "Asking a quiet person to be louder puts the problem on them. The meeting is what's excluding people."
---

{engineer} works remotely, and keeps finding out about decisions after they're made, in calls they weren't on.
