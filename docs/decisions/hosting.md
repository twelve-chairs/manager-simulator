---
node: high-level-design
---

# Decision: The game is served from its own domain by CloudFront

## Context

The game is a static site: an HTML page, one script, one stylesheet and an image, with no server and no network requests at runtime (HLD *Non-Goals*). The security rule asks that it be served with a Content-Security-Policy that disallows inline script and `eval`, `X-Content-Type-Options: nosniff` and `frame-ancestors` set. GitHub Pages cannot send headers, so while the game was hosted there the policy rode in a `<meta>` tag and the other two were missing, a documented exception to be removed before a wider release. The project owns the domain `manager-simulator.io`, with its DNS in Route 53.

## Decision Elements

- **Security headers** — *major*. Whether the host sends the headers the security rule asks for.
- **No online services** — *major* (HLD *Non-Goals*). Whether the host serves static files and nothing else: no accounts, analytics or server code.
- **Cost and upkeep** — *moderate*. What it costs at playtest traffic, and what has to be maintained.
- **Supply chain** — *moderate*. What the deploy needs: credentials, actions and dependencies, each pinned and least-privilege.

## Options in the Domain

### GitHub Pages under the domain

The domain points at GitHub Pages; the deploy is unchanged.

- **Security headers — weak.** Pages still sends none; the exception stays.
- **No online services — strong.**
- **Cost and upkeep — strong.** Nothing to maintain.
- **Supply chain — strong.** Nothing new.

### S3 and CloudFront

A private S3 bucket holds the built files; one CloudFront distribution serves them under the domain with a response headers policy, and a CloudFront function redirects the bare domain to `www`. GitHub Actions deploys through a role it assumes with OpenID Connect, allowed only to write that bucket and invalidate that distribution. The bucket, distribution, certificate, DNS records and role are one CloudFormation stack in the repository.

- **Security headers — strong.** CloudFront sends the policy, `frame-ancestors`, `nosniff`, HSTS and a referrer policy.
- **No online services — strong.** Static files only; access logging is off.
- **Cost and upkeep — strong.** About a dollar a month at playtest traffic; the stack changes only when the hosting does.
- **Supply chain — partial.** One more action (AWS credentials, pinned), and no long-lived keys.

### Amplify Hosting

Amplify serves the files, with custom headers from a file in the repository.

- **Security headers — strong.**
- **No online services — strong.**
- **Cost and upkeep — partial.** A managed build service to configure alongside GitHub Actions, or a second deploy path.
- **Supply chain — partial.** Amplify's own build or deploy integration in place of a narrowly scoped role.

## Selection

**S3 and CloudFront.** It is the only option strong on both major criteria. GitHub Pages under the domain would keep the exception the security rule asks to remove; Amplify sends the headers too, but adds a managed build service where one scoped role and two commands do the job.

`www.manager-simulator.io` is the game's address; the bare domain redirects to it, so links to either reach the same page and the same saved run. The domain sends no mail, and says so in DNS (a null MX, SPF and DMARC that reject everything), so nobody can send mail as it. A CAA record lets only Amazon issue its certificates.

Committing obligates:
- a CloudFormation stack in `infra/` for the bucket, distribution, headers, redirect, certificate, DNS records and deploy role;
- the deploy workflow publishing the build to the bucket from `main`;
- the security rule's GitHub Pages exception removed, and the domain named as the game's address.

The copy on GitHub Pages stays up while players move over: a save lives in the browser under the address it was made on, so a run started on `github.io` is carried over by exporting it there and importing it on the domain.
