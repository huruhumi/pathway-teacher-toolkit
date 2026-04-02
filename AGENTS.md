# Project System Instructions

## Automated Verification / Testing Policy

When performing automated verification or browser-based testing (e.g., using browser subagent):

- If the agent fails to locate or reproduce the error/bug **3 times in a row**, **immediately stop** the automated attempt.
- Present the user with a choice:
  1. Switch to **manual verification** — generate a clear checklist of steps for the user to test by hand.
  2. Continue with **automated verification** — the agent will retry with a different strategy.
- Do NOT keep retrying blindly beyond the 3-attempt limit.

## Browser Authentication Policy

All apps in this monorepo require Supabase auth login. Data syncs to Supabase cloud — **do NOT bypass auth** (e.g. `VITE_DEV_BYPASS_AUTH`) as it will break cloud sync.

When using the browser subagent for verification:

- If the browser is stuck on the **Sign In / login screen**, **immediately stop** the browser subagent.
- **Ask the user to manually log in** in their own browser, then continue verification by asking the user to confirm what they see, or by re-launching the browser subagent after the user has logged in.
- Do NOT attempt to automate login, create auth bypass env vars, or modify auth gate code to skip login.
