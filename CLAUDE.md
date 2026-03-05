# Project System Instructions

## Automated Verification / Testing Policy

When performing automated verification or browser-based testing (e.g., using browser subagent):

- If the agent fails to locate or reproduce the error/bug **3 times in a row**, **immediately stop** the automated attempt.
- Present the user with a choice:
  1. Switch to **manual verification** — generate a clear checklist of steps for the user to test by hand.
  2. Continue with **automated verification** — the agent will retry with a different strategy.
- Do NOT keep retrying blindly beyond the 3-attempt limit.
