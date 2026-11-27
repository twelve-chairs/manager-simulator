---
id: director-org-chart-tug
title: Two senior managers, one org chart
levels: [director]
priority: normal
cooldownWeeks: 104
waitDebrief: "A dispute over the org chart left open keeps two senior managers lobbying you instead of leading."
roles:
  - name: lead
    kind: person
    where: { value: lead.role, is: manager }
  - name: other
    kind: person
    where: { value: other.role, is: manager }
choices:
  - id: decide
    label: Decide it yourself
    outcomes:
      - id: decided
        effects:
          - { type: value, target: other, field: trust, amount: -6, historyNote: Lost an org-chart argument to your decision }
          - { type: value, target: lead, field: motivation, amount: 3 }
        aftermath: "{lead} gets the team. {other} accepts it, and remembers it."
        debrief: Deciding between two senior managers settles it fast and leaves one of them with a grievance.
  - id: make-case
    label: Have them make the case to each other with the groups' goals, then decide
    outcomes:
      - id: cased
        effects:
          - { type: value, target: lead, field: skill, amount: 2, historyNote: Argued an org change from the groups' goals }
          - { type: value, target: other, field: skill, amount: 2, historyNote: Argued an org change from the groups' goals }
          - { type: value, target: other, field: trust, amount: 2 }
        aftermath: "Halfway through, {other} concedes the team fits {lead}'s goals better. Your decision is a formality."
        debrief: Making senior managers argue from the groups' goals usually decides it for them, and teaches the habit.
  - id: postpone
    label: Postpone it
    outcomes:
      - id: postponed
        effects:
          - { type: value, target: lead, field: stress, amount: 4 }
          - { type: value, target: other, field: stress, amount: 4 }
        aftermath: The team in question hears about the tug-of-war before either of them does.
        debrief: Postponing an org question leaves the people in the middle to find out how it feels.
---

{lead} and {other} each want the same team when the organization next changes, and each has been making their case to you separately.
