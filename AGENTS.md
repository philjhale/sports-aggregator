# Workflow
- Do new work in a new git worktree (not directly on main) — create a branch and git worktree add .claude/worktrees/<branch> -b <branch> before editing.
- When a piece of work is finished, create a PR without asking using the pr skill.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`philjhale/sports-aggregator`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
