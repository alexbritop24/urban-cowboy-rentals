# Git Development Workflow

## Purpose

This document defines the official Git workflow for Urban Cowboy Rentals. The strategy keeps `main` deployable, makes the target release visible in branch names, and uses short-lived branches for reviewable units of work. It applies prospectively; existing branch names and historical approval records do not need to be renamed.

Sprints are planning and delivery checkpoints, not permanent integration branches. A branch should represent one coherent feature, fix, documentation change, or maintenance task that can be reviewed and merged independently.

## Branch Model

```text
main
├── feat/r1-<feature-name>
├── fix/r1-<fix-name>
├── docs/<documentation-name>
├── chore/<maintenance-name>
├── hotfix/<urgent-production-fix>
└── release/1.0  # optional and temporary
```

Git branch references are flat. Slashes make names easier to scan and group in Git hosting interfaces, but they do not create parent branches or a directory hierarchy. A branch's starting point and Pull Request base—not its name—determine its relationship to other work.

## Naming Conventions

Use lowercase kebab-case after the prefix. Keep names concise, specific, and understandable without a sprint board.

| Work type | Pattern | Examples |
| --- | --- | --- |
| Release feature | `feat/r<release>-<feature-name>` | `feat/r1-agreement-redesign`, `feat/r2-customer-profiles` |
| Release fix | `fix/r<release>-<fix-name>` | `fix/r1-production-hardening`, `fix/r2-inspection-validation` |
| Documentation | `docs/<documentation-name>` | `docs/git-workflow`, `docs/release-1-runbook` |
| Maintenance | `chore/<maintenance-name>` | `chore/dependency-audit`, `chore/ci-cache` |
| Urgent production fix | `hotfix/<urgent-production-fix>` | `hotfix/payment-recording` |
| Release stabilization | `release/<major>.<minor>` | `release/1.0`, `release/2.0` |

Release-specific documentation or maintenance may include the release in the descriptive portion, such as `docs/r1-operations-runbook` or `chore/r1-migration-validation`. Do not add a release marker when the work is repository-wide and not tied to one release.

Avoid names such as `feat/updates`, `fix/bugs`, or `sprint-3`. They do not communicate the release, business capability, or review scope.

## Why Short-Lived, Release-Aware Branches

Short-lived branches reduce merge conflicts, integration surprises, and the time a change exists without review. The `r1`, `r2`, or later marker makes release intent visible without creating a permanent release branch for every unit of work.

This model is preferred over:

- **Permanent branches for every sprint:** sprints are timeboxes, and permanent sprint branches accumulate unrelated work, unclear ownership, and difficult merge history.
- **Long-lived feature branches:** they drift from `main`, delay integration, and make review and rollback larger and riskier.
- **Context-free `feat/*` names:** a name such as `feat/forms` does not identify its target release or meaningful business scope.
- **Treating slash-separated names as hierarchy:** `feat/r1-agreement-redesign` is not a child of a `feat` or `r1` branch. It is one flat Git reference created from an explicitly selected base.

## Normal Development Workflow

The normal path is:

```text
main
→ short-lived feature, fix, documentation, or chore branch
→ implementation and validation
→ Conventional Commit
→ push
→ Pull Request into main
→ engineering review
→ merge into main
→ delete the merged branch
```

Always start ordinary work from the latest `main`. Keep the branch limited to its declared scope and synchronize with `main` when necessary. Do not combine unrelated cleanup with feature work.

### Feature Branch Lifecycle

1. Create `feat/r<release>-<feature-name>` from current `main`.
2. Implement one production-reviewable capability.
3. Add or update tests and documentation required by that capability.
4. Run the required validation.
5. Commit with a Conventional Commit such as `feat(agreement): add item snapshots`.
6. Push and open a Pull Request into `main`.
7. Address review feedback on the same branch.
8. Merge after approval and passing checks, then delete the branch.

### Fix Branch Lifecycle

Use `fix/r<release>-<fix-name>` for non-emergency defects or production hardening targeted at an upcoming release. Follow the same lifecycle as a feature branch, include regression coverage, and explain the failure mode and risk in the Pull Request.

### Documentation Branch Lifecycle

Use `docs/<documentation-name>` for documentation-only work. Documentation branches still require review and validation such as link checks, Mermaid rendering when applicable, and `git diff --check`. They are short-lived and are deleted after merge.

### Chore Branch Lifecycle

Use `chore/<maintenance-name>` for dependencies, CI, build configuration, repository maintenance, and similar work that does not directly add product behavior. Keep maintenance changes isolated from feature work so their operational impact is clear.

## Pull Request Workflow

Every change to `main`, including urgent fixes and documentation, goes through a Pull Request. Direct commits to `main` are prohibited.

A Pull Request must:

- have a focused, Conventional Commit-style title;
- explain the problem, scope, implementation, and user-visible effect;
- identify database, security, compatibility, and rollout implications;
- list validation commands and results;
- disclose known risks and deferred work;
- include screenshots or preview instructions for visible UI changes;
- avoid unrelated files and generated artifacts; and
- target `main`, except for release-blocking fixes explicitly targeting a temporary release branch.

Draft Pull Requests are appropriate for early CI or design feedback, but they are not mergeable until the implementation and validation are complete.

## Required Validation Before PR Creation

Run validation proportional to the change. The current repository baseline is:

```bash
npm run lint
npm run build
git diff --check
```

When the affected foundation is present, also run:

```bash
npm run test:persistence
npm run check:domain
```

In addition:

- run relevant unit, integration, browser, and regression tests;
- validate both enabled and disabled states for affected feature flags;
- inspect `git status --short --branch` and the complete diff;
- confirm that unrelated routes and protected workflows did not change; and
- do not claim a check passed unless it was run successfully in the current branch state.

### Database Migration Validation

Migration work belongs on the feature or fix branch that requires it. Database changes must be version controlled, additive where practical, and safe when applied in order from a clean database.

Before opening a migration Pull Request:

- validate an empty-database migration path;
- validate sequential application and any repository-supported rerun behavior;
- inspect constraints, indexes, grants, RLS policies, function ownership, and fixed `search_path` settings;
- test transaction rollback and legacy compatibility;
- regenerate database types when the schema contract changes; and
- document rollout, backfill, and rollback requirements.

Never edit or squash a migration that has been applied to a shared or production database. An unapplied migration may be restructured before its Pull Request is merged when doing so removes an unsafe intermediate state. Once deployed, corrections require a new forward migration.

## Review Requirements

At least one engineer other than the author must approve a Pull Request. Security-sensitive, authorization, payment, legal-document, and database changes require review by someone qualified to evaluate that risk, such as the project Principal/Staff Engineer or designated owner.

Reviewers must verify:

- scope and acceptance criteria;
- backward compatibility and route stability;
- test quality and validation evidence;
- security, privacy, and least-privilege behavior;
- migration safety and rollback behavior when applicable; and
- that deferred work is explicit and does not hide a release blocker.

All blocking review comments and required CI checks must be resolved before merge. Authors do not self-approve their own Pull Requests.

## Merge Strategy

Use **squash merge** for ordinary feature, fix, documentation, chore, and hotfix Pull Requests. The Pull Request title becomes the Conventional Commit on `main`, keeping the mainline readable while allowing iterative branch commits during review.

Do not merge a branch with failing required checks, unresolved blocking comments, or undocumented production risk. Do not use force pushes on `main` or a shared release branch.

For a temporary `release/<major>.<minor>` branch, squash release-fix Pull Requests into the release branch. Merge the completed release branch into `main` with an explicit release merge so the stabilization boundary is visible, then tag the resulting `main` commit.

## Conventional Commits

Use the form:

```text
<type>(<optional-scope>): <imperative summary>
```

Common types are:

- `feat`: new user or business capability;
- `fix`: defect correction or production hardening;
- `docs`: documentation only;
- `chore`: maintenance with no product behavior change;
- `refactor`: internal restructuring without behavior change;
- `test`: test-only changes;
- `build` or `ci`: build and automation changes;
- `perf`: performance improvement; and
- `revert`: reversal of a prior change.

Examples:

```text
feat(agreement): add multi-item legal snapshots
fix(payments): prevent duplicate balance updates
docs(workflow): define release-aware branching
chore(deps): update Supabase client
```

Use a body for important rationale, compatibility notes, migrations, or breaking changes. Mark an intentional breaking change with `!` and a `BREAKING CHANGE:` footer; breaking changes require explicit release approval.

## Hotfix Workflow

Use `hotfix/<urgent-production-fix>` only for an urgent defect affecting production.

1. Branch from the current production commit on `main`.
2. Implement the smallest safe correction and regression test.
3. Run focused and baseline validation.
4. Open an expedited Pull Request into `main`.
5. Complete qualified engineering review; urgency does not bypass review or CI.
6. Merge, deploy, and create a patch tag when appropriate, such as `v1.0.1`.
7. Delete the hotfix branch after merge.

If a temporary release branch is active but production is still represented by `main`, the production hotfix still targets `main`. Apply an equivalent reviewed fix to the release branch only when the unreleased code is also affected.

## Optional Release Stabilization

`release/1.0` is optional, temporary, and created only when Release 1 enters final stabilization. Normal Release 1 feature development does not occur on this branch.

The stabilization path is:

```text
main
→ create release/1.0
→ create focused release-blocking fix branches from release/1.0
→ Pull Requests into release/1.0
→ regression and production-readiness validation
→ Pull Request and merge release/1.0 into main
→ tag main as v1.0.0
→ delete release/1.0
```

Only release-blocking fixes, release notes, version metadata, and stabilization changes belong on a release branch. New features continue to wait for the next appropriate release-aware feature branch. Keep the stabilization period short and avoid allowing `main` and the release branch to diverge unnecessarily.

## Semantic Version Tags

Create release tags only after the approved release is present on `main` and production-readiness checks pass. Use annotated semantic-version tags:

```text
vMAJOR.MINOR.PATCH
```

- `MAJOR`: incompatible product or API changes;
- `MINOR`: backward-compatible capabilities; and
- `PATCH`: backward-compatible fixes.

Release 1 is expected to use `v1.0.0`; production fixes may use `v1.0.1`, `v1.0.2`, and so on. The tag must point to the exact reviewed `main` commit selected for release.

## Release 2 and Later

Continue the same model without permanent release branches:

```text
feat/r2-customer-profiles
feat/r2-inventory-units
fix/r2-inspection-validation
release/2.0       # temporary, only if stabilization needs it
v2.0.0            # release tag

feat/r3-maintenance-workflow
fix/r3-reporting-corrections
release/3.0       # temporary, only if needed
v3.0.0            # release tag
```

Use the product release identifier in feature and fix branch names. Semantic-version tags remain the authoritative identifiers for shipped versions.

## Branch Deletion Rules

- Delete merged feature, fix, documentation, chore, and hotfix branches locally and remotely.
- Delete a temporary release branch after it is merged into `main` and the release tag is verified.
- Never delete `main`.
- Do not delete an unmerged branch without confirming that its work is obsolete or safely preserved.
- Do not reuse a deleted branch name for unrelated work.
- Tags preserve released history; branches are not release archives.

## Keeping `main` Deployable

- Protect `main` from direct pushes and force pushes.
- Require Pull Requests, qualified review, and passing CI.
- Merge small, complete, backward-compatible increments.
- Keep unfinished behavior behind disabled, server-authoritative feature flags.
- Do not merge migrations that create an insecure intermediate state.
- Preserve existing routes and legacy compatibility unless an approved release explicitly changes them.
- Keep secrets, local environment files, build output, and temporary artifacts out of Git.
- Revert or fix a broken mainline immediately; do not leave `main` knowingly undeployable.

## Command Examples

### Complete Feature Workflow

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/r1-agreement-redesign

# Implement the scoped change.
git status --short --branch
npm run lint
npm run build
npm run test:persistence
npm run check:domain
git diff --check

git add <reviewed-files>
git commit -m "feat(agreement): redesign release 1 agreement workflow"
git push -u origin feat/r1-agreement-redesign
gh pr create --base main --head feat/r1-agreement-redesign \
  --title "feat(agreement): redesign release 1 agreement workflow"

# After review and required checks pass:
gh pr merge --squash --delete-branch
git switch main
git pull --ff-only origin main
git branch -d feat/r1-agreement-redesign
```

Use the same sequence with `fix/r1-...`, `docs/...`, or `chore/...` as appropriate.

### Release Stabilization Workflow

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c release/1.0
git push -u origin release/1.0

# Create a release-blocking fix from the temporary release branch.
git switch release/1.0
git switch -c fix/r1-production-hardening

# Implement, validate, commit, and push the fix.
git add <reviewed-files>
git commit -m "fix(release): resolve release 1 production blocker"
git push -u origin fix/r1-production-hardening
gh pr create --base release/1.0 --head fix/r1-production-hardening \
  --title "fix(release): resolve release 1 production blocker"

# After all release fixes and regression checks pass, open the release PR.
git switch release/1.0
git pull --ff-only origin release/1.0
gh pr create --base main --head release/1.0 \
  --title "chore(release): prepare v1.0.0"

# After release review and required checks pass, merge with an explicit
# merge commit so the stabilization boundary remains visible.
gh pr merge --merge

# Tag the resulting main commit.
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "Urban Cowboy Rentals v1.0.0"
git push origin v1.0.0

# Delete the temporary release branch after merge and tag verification.
git push origin --delete release/1.0
git branch -d release/1.0
```

The commands above are examples for an authorized workflow. Creating, pushing, merging, tagging, or deleting branches still requires the appropriate repository permissions and completed review.

## Recommended Remaining Release 1 Branches

- `feat/r1-agreement-redesign`
- `feat/r1-invoice-redesign`
- `feat/r1-document-workflow`
- `feat/r1-approval-workflow`
- `fix/r1-production-hardening`

Create each branch only when its scoped work is ready to begin, and delete it after merge. Do not create `release/1.0` until the project formally enters final release stabilization.
