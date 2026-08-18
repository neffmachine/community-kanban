---
name: jgl-push
description: Push committed changes to the remote, with branch-aware safety. Use when the user says "push", "/jgl-push", "send it up", or after /jgl-commit.
---


# Push

Push committed changes to the remote. **This skill is deliberately
separate from `/jgl-commit`** so the user makes the publishing decision
explicitly — pushing can trigger CI, deploys, and visibility on
production repos.

## 1. Check what you're about to push

Run `git status` and `git log @{u}..HEAD --oneline` (or
`git log origin/main..HEAD --oneline` if no upstream is configured) to
see what commits are ahead of the remote. Show the user the list before
pushing.

If there's nothing to push (no commits ahead), say so and stop.

## 2. Check the branch — and decide whether to ask first

Run `git rev-parse --abbrev-ref HEAD` to identify the current branch.

**If on a feature branch** (anything other than `main` / `master` /
`production` / `release`): push without ceremony. `git push -u origin
<branch>` if the branch doesn't have an upstream yet, plain `git push`
otherwise.

**If on `main` / `master` / a production branch**: stop and confirm
before pushing. Show the user:

```
You're about to push <N> commit(s) to origin/main.

If this is a production app, the safer flow is a feature branch and
a pull request:

    git checkout -b <feature-branch>
    git push -u origin <feature-branch>
    (open a PR in GitHub)

Continue pushing directly to main? (yes/no)
```

Wait for explicit confirmation. **Do not push to `main`/`master` on
silence or ambiguity.** This is the load-bearing safety; treat it like a
production-deploy confirmation, not a typo check.

If the user has previously confirmed during this session that direct
pushes to `main` are fine for this repo, you can skip the prompt — but
only within the same session. Don't persist this preference; ask again
next time.

## 3. Push

```bash
git push
# or first time:
git push -u origin <branch>
```

If the project has a `.githooks/pre-push` hook (see `/jgl-setup-testing`),
`git push` runs it automatically — it re-runs the type check and unit
suite and aborts the push if either fails. Let it run; don't reach for
`--no-verify` to push past a red suite.

If the push fails with "rejected (non-fast-forward)", **do not
`--force`**. Tell the user the remote has commits they don't have
locally, suggest `git pull --rebase`, and let them decide.

## 4. Report

```
Pushed 3 commit(s) to origin/feature/login-form.
https://github.com/<owner>/<repo>/tree/feature/login-form
```

Include the GitHub URL when you can derive it from `git remote get-url
origin`. Makes it easy for the user to open the PR or check CI.

## Never

- `--force` / `--force-with-lease` unless the user explicitly asks AND
  confirms the consequences.
- `--no-verify` to skip pre-push hooks.
- Push to a branch the user didn't name. If you're unsure which branch
  is current, stop and ask — never guess.
