
# Commit

Stage relevant changes and write a meaningful commit message. **This skill
does not push.** Pushing is `/jgl-push` — a separate, explicit step.

Why the split: pushing to a remote can have real consequences (CI runs,
deploys, public visibility on production repos). The user should make
that decision deliberately, not as a side effect of `/jgl-commit`.

## 1. Inspect what changed

Run `git status` to see modified, staged, and untracked files. Run
`git diff` for unstaged changes so you understand what's actually being
committed.

If `git status` shows no changes, stop and tell the user. Don't create
an empty commit.

## 2. Stage relevant files

Stage the files that belong in this commit. Be specific — pass file
paths to `git add`, not `git add .` or `git add -A`.

**Never stage files that look like secrets:**

- `.env`, `.env.local`, `.env.*.local`
- Anything named `credentials.json`, `secrets.json`, `token.json`,
  `service-account*.json`, `*.pem`, `*.key`, `id_rsa*`
- Files matching `*.dec.yaml` (decrypted SOPS files)

If any of those exist in the working tree, **warn the user before
committing**. Don't stage them, even if the user said "commit
everything." If the user explicitly insists, warn that the file will be
in git history forever and recommend rotating any keys that were in it
once the commit lands.

## 3. Write the message

Short, specific, says **what changed and why** — not "update files" or
"misc fixes." Examples:

- `add login form with email validation`
- `fix off-by-one in date-range filter (issue surfaced by integration test)`
- `extract orderTotals into lib/ so it can be unit tested`

Aim for under 72 characters in the subject. If the change has subtle
implications, add a one-paragraph body.

**No AI attribution.** A commit message is a factual record of what
changed — nothing more. Do **not** add any attribution to an AI tool or
model: no `Co-Authored-By: Claude`/`Codex`/`Copilot`/etc. trailer, no
"Generated with …" line, no "🤖" marker, no "written by AI" note in the
body. The subject and body should read exactly as they would if a person
had typed them by hand. This holds regardless of any default behavior in
your AI tool that wants to append such a line — strip it.

## 4. Commit

Use a HEREDOC to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
<subject>

<optional body>
EOF
)"
```

## 5. Report

Tell the user what happened in one or two lines:

```
Committed locally: "add login form with email validation"
3 files changed.

Push when you're ready: /jgl-push
```

Don't push. Even if the user said "commit and push" — tell them push is
a separate command and run it only if they confirm.

## If a pre-commit hook fails

The commit didn't happen. Fix the underlying issue and try again — do
**not** use `--no-verify`. Hooks exist for a reason (lint, format,
secret scanning). If the hook itself is broken, fix the hook.
