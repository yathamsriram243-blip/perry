# Security Policy

## Scope

This policy covers security issues in the Perry source code, packaging, and
repository-controlled release assets. No live service is designated as an
authorized testing target by this policy. Do not test systems or services
unless you own them or have separate, explicit authorization to do so.

Reports should describe a concrete security impact in Perry. Examples include
an exploitable vulnerability in Perry code or a security-relevant weakness in
how Perry integrates with a dependency.

The following are out of scope:

- Vulnerabilities solely in third-party software or services, unless the
  report demonstrates a distinct security impact caused by Perry.
- Third-party infrastructure, accounts, or data, including GitHub and systems
  not operated by the Perry maintainers.
- Denial-of-service or resource-exhaustion testing, social engineering,
  physical attacks, spam, and automated scanner output without a demonstrated
  security impact.
- Speculative hardening suggestions or issues that do not affect security.

## How to report

Please disclose suspected vulnerabilities privately and include:

- Affected file, component, version, or commit, if known.
- A concise description of the issue and its security impact.
- Reproduction steps and a minimal proof of concept that avoids accessing real
  user data or causing harm.
- Any relevant environment details and suggested remediation, if available.

If GitHub private vulnerability reporting is enabled for this repository, use
the repository's **Security** tab and select **Report a vulnerability** to
submit an advisory privately. If that option is not available, do not post
vulnerability details, exploit code, or sensitive data in a public issue or
discussion. Instead, open a public issue containing only a request for a
private reporting channel, without describing the vulnerability; wait for
maintainers to provide a safe private route before sending details.

## Safe-harbor expectations

Research must be conducted in good faith, limited to Perry code or assets in
scope, and use the least intrusive method needed to demonstrate the issue.
Stop testing and report promptly if you encounter data that is not yours,
affect another person's account or service, or risk disrupting availability.
Do not access, alter, retain, or disclose another person's data; do not use an
issue to establish persistence, pivot to other systems, or continue testing
after confirming the vulnerability.

This policy does not authorize testing third-party systems and is not legal
advice or a guarantee of legal protection. Applicable law and any separate
authorization still apply.

## Triage and recognition

Maintainers will assess reports as capacity allows and may ask for additional
details through the private channel. A report is eligible for recognition when
maintainers confirm a reproducible, in-scope security issue with a security
impact that was not already known. Recognition is non-monetary: **no cash,
payment, or other monetary reward is offered**.

Each researcher with a confirmed eligible report receives the Perry security
contribution badge as non-monetary recognition; **no cash, payment, or other
monetary reward is offered**. Download the
[badge image](assets/perry-security-researcher.svg) from this repository to
use it. Researchers may also be listed in the public
[Hall of Fame](HALL_OF_FAME.md), but only after they explicitly opt in through
the private report and confirm the name or handle to display. No name, handle,
or identifying detail will be published without that opt-in. Recognition does
not require public attribution; researchers may receive the badge without a
Hall of Fame listing.

Maintainers determine report validity and recognition eligibility. This
program does not promise a response or resolution time.
