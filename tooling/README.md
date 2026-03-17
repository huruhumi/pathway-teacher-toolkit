# Tooling

This directory is the long-term home for repository-level tooling.

Planned subfolders:

- `build/` for build orchestration
- `dev/` for local multi-app startup
- `scan/` for integrated test and scan wrappers
- `i18n/` for translation merge and validation scripts
- `notebooklm/` for NotebookLM proxies and helpers

The current repository still contains legacy scripts in the root `scripts/` directory.
New tooling should prefer `tooling/` and existing scripts can move here incrementally.
