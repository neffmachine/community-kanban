
# Status

Produce a short, scannable session checkpoint. The user runs this when
they've been working for a while and want to know: *what have I done,
what's left, is anything at risk?* Aim for under 20 lines of output.

This skill is read-only. **Do not change any files.** If you spot
something that needs fixing, mention it as a finding — don't act.

## 1. What changed

Run `git status` and `git diff --stat`. Group changes into three
buckets:

- **Committed locally, not pushed** — `git log @{u}..HEAD --oneline`
  (or against `origin/main` if no upstream).
- **Staged, ready to commit** — files with green markers in `git
  status`.
- **Unstaged work in progress** — modified or new files not yet
  staged.

Show file counts per bucket, not full lists. If a bucket has only a
few files, name them; if many, summarize ("12 files across `src/lib/`
and `src/pages/`").

## 2. What's still open

This is the most useful part of the checkpoint. Scan for:

- **Test failures** — quick `npm test` (or pytest, etc.) only if the
  user has tests configured. If anything's red, flag it.
- **TODO comments added in this session** — `git diff` for new TODO /
  FIXME / XXX markers in changed files.
- **Skipped tests** — `.skip`, `xit`, `@pytest.mark.skip` introduced
  in this session (per `git diff`).
- **Feature branches with no PR** — if on a feature branch, mention
  whether a PR exists yet (you can't check GitHub without `gh`, but
  you can say "you're on `feature/X` with no PR opened from this
  session").
- **Hash-stale Fusion test results** — only if this is a Fusion
  project. (The fusion variant of this skill covers it; the generic
  variant doesn't have the context.)

Don't invent items. If nothing's open, say "Nothing flagged." Don't
manufacture a TODO list.

## 3. Anything risky uncommitted

Specifically look for:

- **Uncommitted secrets** — modified or new files that match `.env`,
  `*.key`, `credentials*`, etc. The biggest risk on a long session. If the
  SOPS secrets module is in use, also flag any stray decrypted `*.dec.env`
  file sitting on disk (it's gitignored, but shouldn't linger — re-encrypt
  with `bash scripts/secrets.sh encrypt <env>` or `... clean`).
- **Uncommitted package.json / lockfile changes** without a matching
  install confirmation — easy to forget to re-run tests after deps
  change.
- **Uncommitted work older than 2 hours** — a hint to checkpoint with
  `/jgl-commit` soon. Don't be preachy about it; one line.

## 4. Report

Short, scannable. Example:

```
Status — feature/login-form (no PR yet)

Committed, not pushed:  3 commits
  • add login form with email validation
  • fix off-by-one in expiry check
  • extract validators into lib/

Staged:                 0 files
Unstaged:               2 files
  • src/lib/auth.ts (~40 lines added)
  • src/pages/login.astro (~10 lines added)

Open:
  • 1 new TODO in src/lib/auth.ts:88 ("revisit token refresh")
  • No tests yet for the new validators in src/lib/

Risky:
  • .env modified but not staged (good — leave it that way)

Next steps you might consider:
  • Commit the staged work (/jgl-commit)
  • Add tests for the validators (/jgl-setup-testing or /jgl-review-testing)
  • Push the branch and open a PR
```

End with a 2–3 line "next steps you might consider" list. Suggestions,
not commands — the user picks.
