# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub: [report a vulnerability](https://github.com/twelve-chairs/manager-simulator/security/advisories/new), or on the repository's **Security** tab, choose **Report a vulnerability**. That opens a private advisory only the maintainer can see. Please don't open a public issue for a security problem.

A useful report says what the issue is, how to reproduce it (a save file, a situation file or steps in the game), and what an attacker could do with it.

This is a small project maintained in spare time, so responses are best effort. Every report is read, and a confirmed issue is fixed on `main` and credited to the reporter unless they ask not to be named.

## Supported versions

Only the current `main` branch, which is what the [live game](https://twelve-chairs.github.io/manager-simulator/) runs. There are no releases or older versions to patch.

## What's in scope

Manager Simulator runs entirely in the player's browser: no server, no accounts, no network requests. So the issues that matter are the ones that reach a player through the game itself:

- **Saved games.** A crafted save file or edited browser storage that runs code, injects markup into the page, corrupts the game or crashes or freezes it.
- **Situation content.** Content that is executed rather than treated as data, or that gets markup onto the page.
- **The page.** Anything that gets around its Content-Security-Policy, or makes the game send data anywhere.
- **The build and deployment.** Weaknesses in the GitHub Actions workflows or the dependency supply chain that could change what is published.

Out of scope: issues that need an already compromised browser or machine, and the headers GitHub Pages cannot send (`X-Content-Type-Options` and `frame-ancestors`). That limitation is known and accepted while the game is hosted there for playtesting.

## How the project stays secure

The rules every change is checked against are in [.claude/rules/security-and-privacy.md](.claude/rules/security-and-privacy.md). Every push is scanned by CodeQL, secret scanning and OpenSSF Scorecard, and Dependabot keeps the development tools and workflow actions up to date.
