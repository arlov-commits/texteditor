# CLAUDE.md


## Git Workflow
- ALWAYS commit directly to main. Never create a branch unless explicitly told to.
- After every numbered task item, stage all changes and push directly to main.
- Bump the patch version (vX.Y → vX.Y+1) in the HTML meta/comment header with each commit.
- when version is at x.9, next bump jumps to x+1.0
- Commit message format: `vX.Y – [brief description]`
- Never open a PR. Never use `git checkout -b`.
