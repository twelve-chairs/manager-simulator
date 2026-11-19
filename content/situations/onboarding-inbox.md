---
id: onboarding-inbox
title: "Onboarding: the inbox"
levels: [line-manager]
priority: urgent
once: true
when:
  value: week
  is: 1
roles: []
choices:
  - id: ask-delegation
    label: Ask how to choose who to delegate to
    outcomes:
      - id: answered
        effects: []
        aftermath: "\"Look at the difficulty against their skill. Stretch people a little, not a lot.\""
        debrief: "Delegating work within someone's reach grows them; well beyond it, it goes badly and costs them stress."
  - id: ask-letting-go
    label: Ask what you can safely let slide
    outcomes:
      - id: answered
        effects: []
        aftermath: "\"Most things can wait a week. On-call can't. And nothing waits forever.\""
        debrief: "Every inbox item has a deadline; left past it, it causes trouble. On-call escalations are due the week they arrive."
---

Your manager glances at your inbox. "You won't get through all of that yourself, and you shouldn't try. Handle what only you can, *delegate* what someone on the team can grow into, and decide what can wait. Everything you handle yourself comes out of your forty hours."
