
# Review Testing

Audit the project's test suite for substantive quality — what the tests actually verify about behavior, not just whether coverage numbers look good. Use four sources of information:

1. **Your own analysis** — read the existing tests and evaluate what they actually assert.
2. **Static analysis** — run `npx tsc -b` to check for type errors in test files. Run the test suite (`npm test`) and note any failures.
3. **Coverage data** — run the project's coverage command. For Vitest: `npm run test:coverage`. For Jest: `npm test -- --coverage`. For pytest: `pytest --cov`. **If no coverage tooling is configured at all**, report it as `⊘ SKIPPED — no coverage tooling configured` with a suggestion (`npm install -D @vitest/coverage-v8` for Vitest, `pip install pytest-cov` for Python). Don't silently pass — missing coverage tooling is itself a finding worth surfacing.
4. **CI pipeline inspection** — read the CI workflow files and confirm the same tests that pass locally also run in CI on every PR and push to main. Local green means nothing if CI is running a subset (or nothing at all).

## What to check

1. **Untested logic files** — source files with real business logic that have no corresponding tests. List them.
2. **Weak assertions** — tests that use `toBeDefined()`, `not.toBeNull()`, or regex matches when they should assert specific computed values. These tests pass even when the code is wrong.
3. **Missing edge cases** — functions that take collections but are only tested with one size. Look for missing tests at sizes 0, 1, 2, and N.
4. **Missing round-trip tests** — any encode/decode, save/load, or serialize/parse pair that isn't tested in both directions.
5. **Tests that mirror implementation** — tests where the assertion is just the function's logic copied into the test. These tests can't catch bugs because they'll be wrong in the same way.
6. **Over-mocking** — tests that mock so many dependencies that they only verify the mocks, not real behavior. Mocks should be at architectural seams (storage, network, time) only.
7. **Coverage gaps on critical paths** — core business logic (calculations, data transformations, validation) that isn't near 100% coverage.
8. **CI pipeline gaps** — see the next section.

## CI pipeline check

A test that only runs locally is a test that silently rots. Before trusting the local measurements above, open the CI configuration (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, etc.) and verify all of the following. Every item is a potential finding in its own right.

### Step zero: enumerate the gates that actually exist

Before scoring coverage or test depth, **build a gate inventory**. Real
brownfield repos almost always have more than one gate, and "all tests"
doesn't mean the same thing in each one. Open every CI workflow file
plus the deploy / pre-commit configs and list:

1. **PR gate** — what runs on every pull request? Which test command?
   Type check? Lint? Audit? Build?
2. **Deploy gate** — what runs at deploy time (Vercel build, Cloudflare
   Pages build, GitHub Actions on push-to-main)? This is often
   *stricter* than the PR gate — it may run a `test:ci` script that
   includes slow integration tests the PR gate skips.
3. **Pre-commit / pre-push hook** — what does Husky / lefthook / pre-commit
   run locally? This is often *weaker* than the PR gate.
4. **Local-only suites** — manual `npm run` scripts that nobody runs
   automatically. These are at high risk of rotting silently.

Then, for each test file in the repo, identify *which gate runs it*. A
file that exists on disk but isn't picked up by any gate is the same
problem as a missing test — sometimes worse, because someone clearly
intended it to run.

**A curated "reliable subset" gate is legitimate.** If the project has a
`test:reliable` script that the PR gate runs (a deliberately whitelisted
subset, with the broader tree gated at deploy time), don't flag that as
"running a subset." That's a real engineering pattern. The finding is
when a subset gate is *misrepresented* as the full suite — e.g., a job
called "Tests" that actually runs `test:reliable` and the team thinks it
runs `test`.

The output of this step is a paragraph or short table the user can
read and confirm — "this repo has a reliable Jest gate at PR, a wider
`test:ci` at Vercel deploy, and a local-only `test:integration` that no
gate runs." That alone is often the most useful finding the skill
produces.

1. **A workflow exists that runs tests.** If there is no CI at all, that's the first finding — everything else is moot until CI is in place.
2. **It runs on the right triggers.** At minimum: every PR and every push to `main` (or the project's default branch). A test workflow gated only on `workflow_dispatch`, tags, or a nightly schedule is not protecting day-to-day development.
3. **It runs the entire suite, not a curated subset.** Compare the test command in CI (`npm test`, `pytest`, etc.) against what you run locally. Watch for `--testPathPattern`, `-k <expr>`, `testMatch` overrides, hand-maintained file lists, or `paths:` filters on the workflow that exclude directories containing tests.
4. **Test discovery matches the filesystem.** Count test files on disk (`find . -name '*.test.*'` or equivalent) and compare to what the CI run reports. A mismatch means tests are being silently skipped — often because a new test landed in a directory the runner config doesn't pick up.
5. **Zero-test files are failures, not passes.** Test runners sometimes report a file that failed to import as "0 tests" alongside passing files. If that doesn't fail the build, a broken import can hide an entire test file. Look at a recent CI run and investigate every file that reports 0 tests.
6. **The test step can actually fail the build.** Scan the CI config for `|| true`, `continue-on-error: true`, `exit 0`, or `if: always()` on dependent steps that let the job proceed past failures. Any of these can turn a red test into a green build.
7. **Tests run after their prerequisites.** If the project generates files at build time (products.json, protobuf stubs, generated types, schema files) and tests import them, confirm the test step runs **after** those generation steps. Out-of-order steps produce `MODULE_NOT_FOUND` / `ImportError` failures that can be masked as "0 tests" reports.
8. **Required status checks are enforced.** A CI workflow that isn't listed as a required check in the branch protection rules cannot block a broken PR from merging. Check Settings → Branches (or `gh api repos/:owner/:repo/branches/main/protection`) and confirm the test workflow is required.
9. **Multi-workflow coverage is complete.** If the project has split pipelines (fast unit tests on every PR, slower E2E nightly), make a coverage matrix: for each test file, which workflow runs it on which trigger. Every test file must run in at least one workflow that can fail the build on a cadence that matters (not just nightly on main).

Red flags to grep for explicitly:
- `it.only`, `describe.only`, `.skip`, `xit`, `xdescribe` — focused or muted tests committed to the repo
- `continue-on-error`, `|| true`, `exit 0` in CI config files
- `paths:` filters that exclude test directories
- Sudden drops in test count between recent CI runs

**Report CI gaps as first-class findings**, on equal footing with missing tests. A missing test that nobody knows about is worse than a missing test you know about, and a broken CI pipeline makes every passing test suspect.

## What NOT to do

- Don't write tests. Just report and plan.
- Don't suggest testing bootstrap files, type-only files, pure-presentation components, or framework glue with no logic.
- Don't chase coverage percentage as a goal. Focus on whether the important code is meaningfully tested.

## Testing threshold

Not every codebase needs more tests right now. Use this threshold to decide:

- **No action needed** if: all files with business logic have test files, assertions check real values, edge cases are covered for critical paths, coverage on core logic is 80%+, **and the full test suite runs in CI on every PR and push to main with no silent skips**. Say so and stop.
- **Improvement recommended** if any of these are true:
  - Source files with real logic have zero test coverage
  - Core business logic (calculations, validation, data transformations) is below 80% coverage
  - Existing tests rely primarily on weak assertions (`toBeDefined`, `toBeTruthy`, regex matches)
  - No round-trip tests exist for encode/decode or save/load pairs
  - A recent feature or bug fix shipped without any tests
  - **CI does not run the full test suite on every PR** (no CI at all, manual-only workflow, nightly-only, `paths:` filters excluding test directories, or a test command that runs only a subset of files)
  - **CI runs the tests but cannot fail the build** on a failure (`continue-on-error`, `|| true`, unmasked `0 tests` reports from failed imports)
  - **The test workflow is not a required check on the main branch**, so broken tests can't block a merge

## Testing plan

If the threshold is met, end with a prioritized plan:

1. **Do first** — highest value, easiest to add: **fix CI gaps (missing workflow, subset runs, soft failures, zero-test reports, branch protection)**, then add tests for untested business logic files, replacing weak assertions with real value checks, and basic edge cases. CI fixes come first because they make every subsequent improvement trustworthy.
2. **Do second** — medium effort: round-trip tests, contract tests for plugin-style interfaces, E2E tests for critical user flows.
3. **Skip for now** — things that look like gaps but aren't worth the effort, with a one-line explanation. Examples: DOM side-effect code, framework bootstrap, unreachable type guards.

For each item, list the file that needs testing, what behavior should be tested, and what kind of test (unit or E2E). For CI items, list the specific workflow file and the specific change. Keep it concrete — "add tests for `calculateTotal()` in `lib/pricing.ts` covering zero items, single item, discount applied, and tax calculation" not "improve test coverage for the pricing module."

**Important**: this skill pairs with `/jgl-review-code`. Run `/jgl-review-testing` first to build a safety net, then use `/jgl-review-code` to plan structural refactors with confidence.

## Iterating across multiple passes

On a codebase that starts with no tests or only a few, plan for **2–3
passes** of this skill in a single working session — not one big run.
Each pass adds tests for the most important gap, then you re-run the
skill to find the next gap. Coverage on real logic climbs steadily and
the user doesn't have to absorb a 50-item plan in one sitting.

When running pass 2+:

1. **Ask the user (or check) what changed since the prior pass.** Open
   with: "What was built since the last review?" or grep `git log` for
   recent test additions. This avoids re-reporting findings that the
   previous pass already produced and addressed.
2. **Skip the bulk-discovery work the prior pass already did** —
   you don't need to enumerate every untested file again if the prior
   pass produced a list. Focus on what's *new* since then: new source
   files, new tests, new CI changes.
3. **Compare coverage to the prior pass when you have it.** A bare
   number is less useful than "core logic moved from 30% to 62%, and
   here's what still has zero coverage."
4. **Recommend stopping when the threshold is met**, not when the user
   has run out of energy. If "no action needed" applies, say so plainly
   — don't manufacture findings to justify the iteration.
