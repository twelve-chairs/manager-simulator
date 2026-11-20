---
id: onboarding-inbox
title: "Onboarding: giving work away"
levels: [line-manager]
priority: urgent
once: true
day: monday
time: morning
when:
  value: week
  is: 1
roles: []
choices:
  - id: ask-delegation
    label: Ask how to choose who to give work to
    outcomes:
      - id: answered
        effects: []
        aftermath: "\"Look at the difficulty against their skill. Stretch people a little, not a lot.\""
        debrief: "Giving work within someone's reach grows them; well beyond it, it goes badly and costs them stress."
  - id: ask-letting-go
    label: Ask what you can safely let wait
    outcomes:
      - id: answered
        effects: []
        aftermath: "\"Most things can wait a week. A night page can't. And nothing waits forever.\""
        debrief: "Work you let wait keeps counting down, and past its last week it causes trouble. A night page is due the night it arrives."
---

Your manager catches you after a design review you did yourself. "You can't do every piece of work that lands on the team, and you shouldn't try. *Give* work to someone who can grow into it, do what only you can, and decide what can wait."
