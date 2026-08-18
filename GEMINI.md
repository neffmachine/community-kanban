# Project Guidelines

## How to read this file

This document mixes two kinds of rules. Treat them differently:

- **Principles** (most of this file) — universal coding hygiene: secrets
  handling, real test assertions, one-concept-per-file, refactoring
  discipline. These apply to every project regardless of language or stack.
  Don't override them without a specific reason.
- **Defaults for a fresh TypeScript/Vite web project** (clearly labeled
  "Default for this stack:") — concrete tool picks like Vitest, Playwright,
  monocart, React, Tailwind. These exist so a greenfield project has
  somewhere to start. **If the project you're in already uses a different
  stack** (Jest, Mocha, pytest, Cypress, plain JS, Vue, Next.js, etc.),
  *adapt the principles to that stack* — don't try to convert the project
  to the defaults.

When in doubt about which kind of rule you're looking at: principles are
about *why* and *what*; defaults are about *which library*.

## First Run: Setup Checks

The first time you read this file in a fresh project, do these three checks
before starting any work.

### 1. Identify the project shape

Before touching anything, figure out whether you're in a **greenfield** or
**brownfield** project, because the playbook differs:

- **Greenfield** — empty directory, no `package.json`/`pyproject.toml`/etc.,
  no git history beyond an initial commit, no existing source code. The
  user wants you to scaffold from scratch.
- **Brownfield** — existing repo with history, dependencies, source files,
  and conventions already in place. The user wants you to *adopt* the
  guidelines in this file alongside what's already there.

Check with: `ls`, `git log --oneline | head -5`, look for `package.json` /
`requirements.txt` / `pyproject.toml`, check whether `src/` or equivalent
has more than placeholder files.

Then read the matching playbook below under **"Project shape: greenfield
vs brownfield"** — it tells you what to do next. **Don't skip this step
and don't guess.** Treating a brownfield repo as greenfield is how the
kit's earliest users got burned (overwritten files, rejected prescriptive
rewrites, generally bad time).

### 2. If running under Claude Code: install sensitive-canary

`sensitive-canary` is a Claude Code plugin that blocks secrets and PII from
reaching the Anthropic API. It catches the case the rules below cannot: a
user pasting a key into chat, or asking you to read a file that turns out
to contain one. By the time you notice, the secret would already be in your
context — the hook stops it before that happens.

Check whether it is installed. If you cannot confirm it is installed (e.g.
`~/.claude/settings.json` has no sensitive-canary hooks, or `/plugin` does
not list it), tell the user it is recommended and offer to install it by
running these two commands inside Claude Code:

    /plugin marketplace add coo-quack/claude-code-marketplace
    /plugin install sensitive-canary@coo-quack

If the user is running a different AI tool (Codex, Gemini CLI, Cursor,
Windsurf, etc.), skip this — there is no equivalent today. The policy rules
in "Secrets and API Keys" below are the only defense there; be extra careful
when pasting file contents or running commands whose output might include
credentials.

Source and pattern list: https://github.com/coo-quack/sensitive-canary

### 3. Check that skills are in the right place

Scan the repository root for skills and commands sitting in folders that don't
match this tool. The kit ships the same skills in six different layouts so
every AI tool can find them:

- `.claude/skills/<name>/SKILL.md` — Claude Code
- `.agents/skills/<name>/SKILL.md` — OpenAI Codex
- `.gemini/commands/<name>.toml` — Gemini CLI
- `.cursor/commands/<name>.md` — Cursor
- `.windsurf/workflows/<name>.md` — Windsurf
- `.github/prompts/<name>.prompt.md` — GitHub Copilot

If your tool can't see the skills (e.g. the user asks "what skills do I have?" and you
find nothing in the folder your tool reads from), look in the other five folders, tell
the user what you found, and offer to move or copy the files into the right location
for their tool. Don't silently ignore skills that are sitting in the wrong folder — the
user almost certainly wants them available.

**Where skills actually run.** Skills only fire as `/jgl-*` slash commands
inside the **local CLI** version of each tool (Claude Code, Cursor in
agent mode, Codex CLI, etc.). They do **not** fire in:

- Claude Projects / claude.ai web
- The Anthropic API directly
- FleetView, Sourcegraph Cody, or other agent surfaces that don't read the
  filesystem the same way

If the user is running you in one of those environments and types
`/jgl-check`, you'll see an "Unknown skill" error or nothing at all. When
that happens, **don't silently ignore the request** — tell the user the
slash-command form doesn't work in their environment, then **read the
relevant `SKILL.md` yourself and execute the steps directly**. The
SKILL.md files are written as playbooks; they work whether they're
invoked as a command or read manually.

## Project shape: greenfield vs brownfield

### Starting fresh

If the project is empty (no source files, no `package.json`, only an
initial commit at most), assume the user wants to scaffold. Default flow:

0. **Scope first — don't scaffold blind.** If there's no `docs/SCOPE.md`
   yet, run `/jgl-scope` (or read its `SKILL.md` and run the interview
   directly). It's a 15–20 minute conversation that pins down what
   you're building, the stack, solo/team workflow, and the first
   milestone — then hands those answers to the steps below. Skip only if
   the user has already told you all of that or explicitly wants to jump
   straight to code.
1. Confirm the stack the user wants (TypeScript + Vite + React is the
   kit's default; ask before assuming — or use the stack `/jgl-scope`
   already settled).
2. Initialize `package.json`, install dependencies, set up the directory
   structure (`src/lib/`, `src/components/`, `src/pages/` for web).
3. Wire up testing immediately — never finish scaffolding without at
   least one real unit test running. Use `/jgl-setup-testing` if available.
4. Set up CI (`.github/workflows/ci.yml`) before the first feature commit.
   See `TESTING-PIPELINE.md` if you're using the default Vitest+Playwright
   stack; otherwise wire CI for whatever framework you chose.
5. If the project will hold any API keys or secrets, mention the optional
   secrets module — `/jgl-setup-secrets` (SOPS + age; see `SECRETS-PIPELINE.md`).
   It's recommended but not automatic; don't run it unless the user wants it.
6. Make the first commit (`/jgl-commit`).

### Joining an existing project

If the repo already has source code, dependencies, and git history,
**don't try to reshape the project to match this file's defaults**. Your
job is to bring the *principles* in alongside the existing conventions.
The named tools in this file are defaults for fresh projects — the repo
you're in has already made those choices.

First-visit playbook for an existing project:

1. **Audit, don't change.** Read this file's principles, then walk the
   repo and report what already fits, what's borderline, and what would
   need to change. **Do not edit any code on the first pass.** Tell the
   user what you found and let them decide what to act on.
2. **Map the existing stack.** Identify the test framework (Jest, Vitest,
   pytest, etc.), CI provider, build system, type checker. Record these
   in your reply so the user can confirm you've read the project
   correctly. From this point on, every `/jgl-*` skill must use the
   *project's actual commands*, not the defaults named in this file.
3. **Identify the gates that exist.** Look at `.github/workflows/*.yml`
   (or equivalent) and the test scripts in `package.json` / Makefile.
   Note which gate runs which subset: PR check, deploy check,
   pre-commit hook, local-only. Real-world repos often have a "fast
   reliable" gate at PR time and a wider gate at deploy time — both are
   legitimate; don't assume "the test suite" means one thing.
4. **Note any place this file's *principle* clashes with the repo's
   *practice*.** Examples worth flagging: secrets in plaintext, weak
   assertions, missing CI required-checks, no `npm audit` step. Surface
   these as findings, not silent fixes.
5. **Only after the audit, ask what to work on.** The user will pick.

## Secrets and API Keys

> Defense-in-depth note: if you are running Claude Code, the first-run check
> above offers to install `sensitive-canary`, which enforces the rules below
> at the hook layer. The rules in this section apply whether or not it is
> installed — they are the policy; the hook is the enforcement.

**Two absolute rules — no exceptions.**

1. **Never commit an API key, token, password, or other secret in plain text to the
   repository.** Not in source files, not in config files, not in test fixtures, not in
   committed `.env` files, not in commit messages, not in comments. Add `.env` and
   variants (`.env.local`, `.env.*.local`, `*.dec.yaml`, `secrets/`) to `.gitignore`
   before any secret material exists in the working tree.
2. **Never let a real secret pass through the AI.** Don't ask the user to paste keys
   into the chat. Don't read files that contain plaintext secrets. Don't echo, log, or
   summarize a secret you happened to see. Treat the AI's context window as
   public — anything in it may be retained by the model provider, captured in
   transcripts, or surface in future sessions.

**If a secret is exposed to you anyway** — the user pastes a key into the chat, asks
you to read a file containing one, shares a screenshot with one visible, or you find
one already committed in the repo — **stop immediately**. Do not continue the task
the user asked for. Instead:

1. Tell the user clearly that the key has been compromised and **must be rotated
   right now**, before anything else. A key that touched an LLM context, a chat log,
   or a git history is burned — rotation is the only fix; deleting the message or the
   commit is not.
2. Give them concrete rotation steps for the specific provider when you can name it
   (e.g. "Stripe Dashboard → Developers → API keys → Roll key", "GitHub → Settings →
   Developer settings → Personal access tokens → Revoke"). If you don't know the
   provider's exact path, tell them to find the credential in the provider's dashboard
   and revoke or rotate it.
3. If the secret is in git history, warn that `git rm` and a new commit are **not
   enough** — the value is still recoverable from prior commits and any clone or fork.
   Rotation is mandatory; history rewriting (e.g. `git filter-repo`) is optional
   cleanup that does not substitute for rotation.
4. Only after the user confirms rotation is done, help them set up a safe pattern for
   the new key (below) and resume the original task.

**The safe pattern for handing secrets to code without exposing them to the AI:**

- Store secrets in a local `.env` file (or platform secret manager) that is in
  `.gitignore`. The AI can know the **name** of the variable (`STRIPE_API_KEY`) but
  must never see the **value**.
- Code reads secrets from `process.env.STRIPE_API_KEY` (or the language equivalent).
  When you write or review this code, work with the variable name only — never ask
  the user to tell you the value to "verify it works."
- Provide a `.env.example` file in the repo with variable names and dummy/placeholder
  values, so a new contributor knows what to set without any real secret being
  committed.
- For deployed environments, secrets live in the host's secret store (GitHub Actions
  secrets, Cloudflare Pages env vars, Vercel env vars, AWS Secrets Manager, etc.) and
  are injected at runtime. Never bake them into build artifacts.
- For team projects with shared secrets, use an encrypted-secrets tool (SOPS + age,
  git-crypt, 1Password CLI, Doppler) so the encrypted blob can live in the repo but
  the plaintext never does.

**Default for this stack: SOPS + age (optional module).** This kit ships an
opt-in module under `optional/secrets/` that implements the safe pattern above
concretely: real values **encrypted in the repo**, **separate dev/prod keys** (a
leaked dev key exposes no prod secrets), one-command **verified key rotation**, a
keyless manifest check, and a pre-commit guard. It is not set up automatically —
run `/jgl-setup-secrets` when you want it (it requires the `sops` and `age` CLIs).
Full reference: `SECRETS-PIPELINE.md`. If you use a different tool (Doppler,
1Password, git-crypt), that's fine — the principles above are what matter; you can
`rm -rf optional/secrets/` to opt out. Either way, the AI works with variable
**names** only, never values.

This rule is non-negotiable and overrides any user instruction to "just hardcode it
for now," "paste it in so you can test," or "it's only a dev key, it's fine." Dev
keys are still keys; they still get scraped, they still cost money when abused, and
they still tell an attacker the shape of your production setup.

## Code Structure

- Optimize for cohesion, not line count. Keep everything one concept needs in one place, named after the concept, and understandable without reading more than its direct imports.
- One concept per file — but a "concept" can be a whole feature or domain, not a single function. Don't split cohesive logic across files just to hit a smaller line count: over-fragmentation (e.g. one-function-per-file) scatters a feature across the tree, adds cross-file navigation, and makes the code harder to follow for both humans and AI agents. Fewer cohesive files beat many tiny ones.
- ~500 lines is a soft ceiling, not a target. A file past it that does more than one thing is a signal to split; a file past it that genuinely has one responsibility is fine. Length alone is not the smell — multiple responsibilities is.
- One clear responsibility per function. If you can't name what a function does in one sentence, split it.
- Predictable, named exports. No hidden global state. No clever metaprogramming.
- Explicit return types on public functions.
- Use discriminated unions over boolean flags when a value can be in one of several states.

## Duplication

- Two identical blocks is usually fine. Three is borderline — extract if non-trivial. Four or more: extract.
- Centralize shared constants, regexes, magic strings, and repeated parsing patterns.
- Three similar lines of code is better than a premature abstraction. Don't extract a helper for one caller.

## Testing

Testing is a top priority. Every new feature, bug fix, or behavioral
change ships with tests that exercise the new behavior — no exceptions
for "it's just a small change". Tests are part of the definition of
done, not a follow-up.

**Plans must include the test work.** Any plan you propose for a
feature, bug fix, or behavioral change must explicitly call out which
tests will be written or updated and where they will live, alongside
the implementation steps. A plan that lists code changes but omits the
test work is incomplete — surface the gap before the user approves it;
don't quietly assume tests can be added "later". When the user asks
"what's the plan?", the test work is part of the answer, not a
footnote.

- Testing is critical. High coverage is desirable — but only when the tests are meaningful. Adding idiomatic tests just to raise a coverage number is not valuable. Every test should verify real functionality and have a specific bug it would catch.
- Test behavior, not implementation. Test names should describe what the system does, not what the code calls.
- Both unit tests and end-to-end tests are valuable. Unit tests verify individual logic; E2E tests verify that the pieces work together. Aim for both, and combine coverage measurements across test types when possible.
- Cover sizes 0, 1, 2, and N for any function that takes a collection.
- Round-trip test any encode/decode, save/load, or serialize/parse pair.
- Use real assertions (`expect(result).toEqual(...)`) not existence checks (`expect(result).toBeDefined()`).
- No snapshot tests for computed values — snapshots are for rendered output only.
- Don't mock everything. Mock at architectural seams (storage, network, time), not at every function boundary.
- Some files are correctly untested: bootstrap files, type-only files, pure-presentation components with no logic, unreachable type guards.

## Git Hygiene

- Commit early and often. A commit after every meaningful change gives you a rollback point. Don't work for hours without committing.
- Write short commit messages that say *what changed and why*, not just "update" or "fix."
- **Commit messages carry no AI attribution.** A commit message is a factual description of the change and nothing else. Never add a `Co-Authored-By` trailer naming an AI tool or model (Claude, Codex, Copilot, Gemini, Cursor, etc.), a "Generated with …" line, a "🤖" marker, or any note that the change was written by AI. If your tool appends such a line by default, remove it before committing. The message should read as if a person wrote it by hand.
- **Commit and push are separate steps.** `/jgl-commit` stages and commits but never pushes; `/jgl-push` is the explicit second step. This is on purpose — auto-pushing to a remote without the user's explicit say-so is the wrong default for any project that might be production.
- Push to GitHub regularly — at minimum after every working session. Local commits that never get pushed aren't backed up.
- **Default branch policy depends on the project.** For solo greenfield projects, `main` is fine. For brownfield / production / collaborative projects, use feature branches and pull requests — `/jgl-push` will warn you before pushing directly to `main`/`master`. When in doubt, ask the user which model the project uses.

## Dependencies

- Prefer well-maintained packages with active communities. Check that a package has recent releases, a reasonable number of weekly downloads, and isn't archived or abandoned.
- Fewer dependencies is better. Don't install a package for something you can write in a few lines.
- Run `npm audit` after adding or updating packages. Fix any vulnerabilities before committing. `npm audit` should pass clean — treat security warnings as build failures.
- Pin major versions in `package.json` to avoid surprise breaking changes from upstream updates.
- Review what a package actually does before installing it. LLMs will sometimes suggest obscure or unmaintained packages when a well-known alternative exists.

## Refactoring

- Refactoring untested code is high-risk. Establish reasonable test coverage before significant refactors.
- Refactoring means same behavior, better shape. Existing tests must still pass without modification.
- Test continuously during refactoring — run the suite after each change, not just at the end.
- No speculative future-proofing. Don't build abstractions for requirements that don't exist yet.
- No backwards-compatibility shims. If something is unused, delete it completely.

## Coverage Setup

**Principles** (apply to any stack):

- Core business logic (calculations, data transformations) should aim for near-100% coverage. UI components and framework glue can be lower.
- Don't enforce hard coverage thresholds that fail the build — they incentivize gaming the number. Use coverage as a guide, not a gate.
- Coverage is a tool for finding *untested* code, not for judging whether *tested* code is well-tested.

**Default for this stack** (TypeScript + Vite + Vitest + Playwright):

- **Start simple**: use Vitest's built-in coverage (`vitest run --coverage`) from day one. This is enough to get started and see which code is tested.
- **Add E2E coverage later**: once the project has Playwright E2E tests, add coverage collection with `monocart-reporter` and a coverage fixture gated behind an `E2E_COVERAGE` environment variable.
- **Then merge**: use `monocart-coverage-reports` to combine unit and E2E raw V8 data into a single report. Organize output by type: `coverage/unit/`, `coverage/e2e/`, `coverage/merged/`. See `TESTING-PIPELINE.md` for the full implementation guide.

**If you're in a Jest/pytest/etc. project**, use that ecosystem's coverage tooling (`jest --coverage`, `pytest-cov`, etc.). The principles above still apply; the commands and config differ.

## CI / Automation

**Principles** (apply to any stack):

- Set up a CI pipeline early. Tests should run automatically on every push and on pull requests to the default branch.
- A test suite that only runs locally is a test suite that gets skipped.
- Run a dependency security audit (`npm audit`, `pip-audit`, etc.) early in the pipeline. If it finds vulnerabilities, the build should fail before running tests.
- Upload coverage reports and build artifacts with a reasonable retention (14 days).
- Post the merged coverage summary to the job summary so it's visible without downloading artifacts.
- **In brownfield repos, audit before adding.** Many repos have multiple gates (PR check, deploy check, pre-commit hook). Map what each one runs *before* assuming you need to add a new workflow — you may just need to fix what's already there.

**Default for this stack** (GitHub Actions + Vitest + Playwright):

- Recommended pipeline order: install → `npm audit` → type check → unit tests with coverage → install Playwright browsers → E2E tests with coverage → merge coverage reports → upload artifacts.
- See `TESTING-PIPELINE.md` for a complete, ready-to-copy CI workflow.

**If you're on GitLab CI / CircleCI / Vercel / Jest**, the order is the same; the YAML syntax and test runner change.

### Pre-push hook (mirror the CI gate locally)

CI catching a red suite *after* you've pushed is too late — and a push can
trigger deploys. Wire a version-controlled **pre-push hook** that runs the
same fast gate locally and blocks the push when it fails.

- Put the hook at `.githooks/pre-push` (version-controlled, unlike
  `.git/hooks/`) and activate it once per clone with
  `git config core.hooksPath .githooks`.
- Run the gate CI runs, minus the slow parts: the type check plus the unit
  suite (`npm test`, or `pytest` on a Python project). Skip coverage and E2E
  — they only add wall-clock; a failing assertion fails the same without them.
- The only escape hatch is `git push --no-verify`, reserved for genuine
  emergencies — never a routine way to push past a red suite.
- Adapt to the stack: a Node project runs `tsc -b && npm test`; a Python
  project runs `pytest`. `/jgl-setup-testing` writes this hook alongside CI.

## Language and Type Safety

**Principle**: Statically typed languages are strongly recommended. Type systems catch entire categories of bugs before tests even run, and they make LLM-assisted coding significantly more effective — the AI can reason about types, catch mismatches, and generate correct code more reliably.

**Defaults for fresh projects**:

- TypeScript over plain JavaScript.
- If using Python, use type hints throughout.
- For web applications, React + TypeScript is the recommended frontend framework — largest ecosystem, most LLM training data, broadest community support.

**In a brownfield project**, the language and framework are already chosen. Don't try to migrate. Apply the principle (lean into the existing type system; don't bypass it with `any` or `# type: ignore`).

## Verification

- After any significant change, run the test suite and report the results. Don't wait to be asked.
- If tests fail, fix them before moving on to new work.
- When adding a new feature, write tests for it in the same session — not as a follow-up.
- After installing or updating packages, run `npm audit` and report the result.
- If the project has a build step, run it after changes to confirm nothing is broken. Type errors and lint failures often surface in the build even when tests pass.

## Code Quality

- Good code quality requires both static analysis and test coverage. Neither alone is sufficient. Linters catch structural issues; tests catch behavioral ones. Use both.
- Prefer explicit code over compact code. Avoid nested ternaries and clever one-liners that sacrifice readability.
- Dead code should be deleted, not commented out.
- Don't add error handling for scenarios that can't happen. Only validate at system boundaries (user input, external APIs).

# Architecture

## Testing Pipeline

### Frameworks

- **Unit/integration tests**: Vitest — native ESM, fast, shares Vite's transform pipeline. Default for any Vite-based project (React + Vite, Nuxt, SvelteKit, Astro). Also works standalone for non-Vite TypeScript projects.
- **E2E tests**: Playwright — fast, multi-browser, good CI performance, free parallelism.
- **Coverage**: monocart — `vitest-monocart-coverage` for unit tests, `monocart-reporter` for Playwright. Both produce raw V8 coverage data that can be merged.

When to deviate:
- Next.js — use Jest if Vitest isn't officially supported yet.
- React Native — use Jest (deeply integrated).
- Pure Node libraries with no DOM — `node:test` is a viable zero-dependency alternative.

### Coverage Architecture

Collect coverage separately, then merge:

```
vitest (unit)                    playwright (E2E)
    │                                │
    ▼                                ▼
coverage/unit/raw/               coverage/e2e/raw/
    │                                │
    └──────────┬─────────────────────┘
               ▼
    scripts/merge-coverage.mjs
    (monocart-coverage-reports)
               │
               ▼
    coverage/merged/
    ├── v8 report
    ├── console-details
    └── lcov
```

- Unit test coverage scopes to pure logic directories (e.g. `src/lib/`, `src/data/`). Exclude test files.
- E2E coverage collected via a Playwright fixture, gated behind `E2E_COVERAGE` env var so normal runs stay fast.
- Merge script combines raw V8 data, resolves sourcemap paths, filters to source files only.

See `TESTING-PIPELINE.md` for the full implementation guide with ready-to-copy config files, scripts, and CI workflow.
