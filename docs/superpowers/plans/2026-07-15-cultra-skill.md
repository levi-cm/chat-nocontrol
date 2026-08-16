# Cultra Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `writing-skills` for RED/GREEN/REFACTOR evaluation and `verification-before-completion` before claiming success. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone personal Codex skill named `cultra` that persistently produces the user-approved 1.45 compression style without reducing technical or code quality.

**Architecture:** Install one self-contained communication skill under `/home/opsec/.codex/skills/cultra`. Keep all behavior in a concise `SKILL.md`; generate only required UI metadata in `agents/openai.yaml`. The skill has one locked style, not multiple modes, and uses conventional abbreviations plus a small symbol vocabulary while preserving every technical fact and exact token.

**Tech Stack:** Markdown skill instructions, YAML Codex UI metadata, bundled `skill-creator` initialization/validation scripts, independent subagent behavior probes.

---

## Locked design

Target style:

```text
State: main ↑10; heavy staged+unstaged user Δ. Worktree → splits dirty state. Work in place; stage exact paths only. Read plan+prereqs → focused tests → patch.
```

Non-negotiable behavior:

- One mode only. Do not add `lite`, `full`, `ultra`, numbered tiers, or runtime intensity switches.
- Persist across responses until the user says `stop cultra` or `normal mode`.
- Treat compression as a communication-layer change only. Never shorten code, skip tests, weaken assertions, omit error handling, or alter implementation quality to save tokens.
- Preserve 100% of decisions, blockers, warnings, commands, results, and next steps.
- Prefer `↑`, `↓`, `Δ`, `→`, `+`, `&`, `=`, `≠`, `✓`, and `✗` when their meaning is immediate.
- Keep readable words where heavier compression becomes cryptic. Explicitly reject forms such as `S/U`, `WT`, `∴`, `state÷`, or invented one-letter abbreviations.
- Preserve code blocks, inline code, identifiers, commands, flags, paths, URLs, quoted errors, stack traces, commit messages, and PR text exactly or in their normal required format.
- Temporarily expand security warnings, irreversible-action confirmations, and ordered procedures when compression could change meaning. Resume Cultra afterward.
- Do not require or load the existing `caveman` skill at runtime; `cultra` must work independently.

## File map

- Create `/home/opsec/.codex/skills/cultra/SKILL.md`: trigger metadata, persistence, compression grammar, exact-token guardrails, clarity escape hatch, examples, and common mistakes.
- Create `/home/opsec/.codex/skills/cultra/agents/openai.yaml`: Codex UI display name, short description, and default invocation prompt.
- Create no `README.md`, changelog, scripts, references, assets, or persistent evaluation files.
- Use temporary evaluation notes only under `/tmp/cultra-eval/`; remove them after final verification.

### Task 1: RED baseline against existing Caveman Ultra

**Files:**

- Read: `/home/opsec/.codex/skills/caveman/SKILL.md`
- Do not create `/home/opsec/.codex/skills/cultra` yet.
- Temporary evidence: `/tmp/cultra-eval/red/`

- [ ] **Step 1: Confirm clean target state**

Run:

```bash
test ! -e /home/opsec/.codex/skills/cultra
```

Expected: exit `0`. If the path exists, stop and inspect it; do not overwrite unknown user work.

- [ ] **Step 2: Run three fresh baseline probes without Cultra**

Use fresh subagents with no conversation fork. Explicitly tell each agent to use `/home/opsec/.codex/skills/caveman/SKILL.md` in `ultra` mode and not to use or infer Cultra.

Probe A — repository status:

```text
Write one coding progress update. Preserve every fact: branch main is ahead 10; there is heavy staged and unstaged user work; a worktree would split required dirty state; work in place; stage exact paths only; read the full plan and prerequisites; next run focused tests, then patch.
```

Probe B — failure diagnosis:

```text
Write one coding progress update. Preserve every fact and exact token: verify:quality ran 234 tests; one failed in src/tests/unit/vault.test.ts with "Expected: true, Received: false"; root cause is a stale query after radio-to-checkbox UI migration; patch the test only; no product change or assertion weakening.
```

Probe C — destructive warning:

```text
Warn the user that rm -rf /srv/app/data permanently deletes production data. It may run only after a verified backup and explicit user approval. Keep the command exact and make the order unambiguous.
```

- [ ] **Step 3: Record baseline failures verbatim**

Create `/tmp/cultra-eval/red/` and copy each raw response into `a.txt`, `b.txt`, and `c.txt`. Record which 1.45 requirements are missing: expected gaps include insufficient `Δ`/arrow use, excess prose, overly cryptic abbreviation, lost facts, or unclear safety ordering.

Expected RED: at least one safe-status probe misses the locked 1.45 contract. If all probes already match, add a fourth realistic progress prompt that distinguishes Caveman Ultra from the approved target before proceeding.

### Task 2: Scaffold the standalone skill

**Files:**

- Create: `/home/opsec/.codex/skills/cultra/SKILL.md`
- Create: `/home/opsec/.codex/skills/cultra/agents/openai.yaml`

- [ ] **Step 1: Initialize with bundled tooling**

Run:

```bash
python /home/opsec/.codex/skills/.system/skill-creator/scripts/init_skill.py cultra \
  --path /home/opsec/.codex/skills \
  --interface display_name=Cultra \
  --interface short_description='Dense, lossless technical communication' \
  --interface default_prompt='Use $cultra for dense, lossless technical communication.'
```

Expected: `Skill initialized successfully` and exactly two generated files: `SKILL.md` plus `agents/openai.yaml`.

- [ ] **Step 2: Inspect generated files before editing**

Run:

```bash
find /home/opsec/.codex/skills/cultra -maxdepth 3 -type f -print
sed -n '1,240p' /home/opsec/.codex/skills/cultra/SKILL.md
sed -n '1,120p' /home/opsec/.codex/skills/cultra/agents/openai.yaml
```

Expected: no resource directories, placeholder files, or unexpected metadata.

### Task 3: Write the minimal GREEN skill

**Files:**

- Modify: `/home/opsec/.codex/skills/cultra/SKILL.md`

- [ ] **Step 1: Replace the template with the complete skill contract**

Write these sections in imperative form:

1. Frontmatter:

```yaml
---
name: cultra
description: Use when the user invokes $cultra, asks for Cultra mode, wants stronger-than-caveman compression, or requests extremely terse symbol-heavy technical communication.
---
```

2. `# Cultra`: define it as the locked 1.45 density style and state the core rule: all technical substance stays; only communication overhead disappears.
3. `## Persistence`: activate for every response until `stop cultra` or `normal mode`; state that there are no intensity levels.
4. `## Compression order`: apply these transformations in order:
   - delete greetings, filler, hedging, repeated context, and redundant conclusions;
   - use short fragments and compact punctuation;
   - replace obvious relations with the approved symbols;
   - use only conventional technical abbreviations;
   - re-read the result and restore any omitted fact or ambiguous word.
5. `## Symbol grammar`: define the following exact meanings:

```text
→  cause, transition, sequence, or next action
↑/↓  increase/decrease, ahead/behind
Δ  changes or diff
+  combined items or addition
&  and, only when grouping stays clear
=/≠  equality, equivalence, or contrast
✓/✗  verified pass/fail
```

6. `## Abbreviations`: allow conventional forms such as `config`, `auth`, `DB`, `req`, `res`, `fn`, `impl`, `deps`, `prereqs`, `env`, `repo`, `docs`, `ref`, `UI`, `API`, and `CI`. Forbid invented shorthand, single-letter compression, `S/U`, and `WT`.
7. `## Exact material`: require unchanged code, identifiers, commands, flags, paths, URLs, quoted errors, stack traces, numbers, test counts, commit messages, and PR text. State explicitly: never degrade code or test quality for shorter prose.
8. `## Auto-clarity`: temporarily use full sentences for security warnings, destructive actions, irreversible changes, ambiguous ordering, or any case where symbols risk misreading; resume Cultra after the risky section.
9. `## Output shape`: prefer one to four compact paragraphs for progress updates, lead with outcome, and use lists only when they improve scanning.
10. `## Examples`: include the locked target plus one technical proof example and one uncompressed destructive warning.
11. `## Common mistakes`: show these three variants:

```text
Too loose: State: main ahead 10; heavy staged and unstaged user changes...
Too cryptic: main↑10 | Δuser:S/U | WT⇒state÷ ∴ inplace...
Target: State: main ↑10; heavy staged+unstaged user Δ. Worktree → splits dirty state...
```

Expected: the file is self-contained, contains no runtime dependency on `caveman`, and stays below 500 words if possible.

- [ ] **Step 2: Check the instruction file mechanically**

Run:

```bash
wc -w /home/opsec/.codex/skills/cultra/SKILL.md
rg -n 'TODO|TBD|PLACEHOLDER|S/U|\bWT\b|state÷|∴' /home/opsec/.codex/skills/cultra/SKILL.md
```

Expected: word count below `500`. `rg` may match only the explicitly labeled negative examples; no placeholder or accidental use elsewhere.

### Task 4: Verify UI metadata

**Files:**

- Verify or modify: `/home/opsec/.codex/skills/cultra/agents/openai.yaml`

- [ ] **Step 1: Lock the generated UI metadata**

Ensure exact content:

```yaml
interface:
  display_name: "Cultra"
  short_description: "Dense, lossless technical communication"
  default_prompt: "Use $cultra for dense, lossless technical communication."
```

Do not add icons, brand colors, dependencies, or policy overrides.

- [ ] **Step 2: Confirm metadata constraints**

Check that all strings are quoted, `short_description` is 25–64 characters, and `default_prompt` explicitly contains `$cultra`.

### Task 5: GREEN forward-tests and REFACTOR

**Files:**

- Read: `/home/opsec/.codex/skills/cultra/SKILL.md`
- Modify only if a probe exposes a real contract gap: `/home/opsec/.codex/skills/cultra/SKILL.md`
- Temporary evidence: `/tmp/cultra-eval/green/`

- [ ] **Step 1: Re-run the same probes with Cultra**

Use new fresh subagents with no conversation fork. Tell each agent: `Use $cultra at /home/opsec/.codex/skills/cultra/SKILL.md`, followed by the unchanged Probe A, B, or C prompt from Task 1. Do not reveal the expected output or earlier diagnosis.

- [ ] **Step 2: Apply the acceptance rubric**

Probe A must:

- preserve all seven seeded facts;
- use `↑10`, `Δ`, and at least one `→` naturally;
- retain `staged+unstaged`, `Worktree`, and `exact paths` rather than cryptic one-letter forms;
- fit the approved 1.45 density rather than Tier 1 looseness or Tier 2 glyph density.

Probe B must:

- preserve `234`, `src/tests/unit/vault.test.ts`, and `"Expected: true, Received: false"` exactly;
- preserve root cause, test-only patch scope, and no-weakening constraint;
- compress surrounding prose without rewriting the quoted error or path.

Probe C must:

- preserve `rm -rf /srv/app/data` exactly;
- explicitly say deletion is permanent and affects production data;
- make `verified backup → explicit approval → command` ordering unambiguous;
- prefer safety clarity over the normal compression target.

- [ ] **Step 3: Compare GREEN with RED**

For safe Probes A and B, Cultra output should be shorter than the corresponding Caveman Ultra baseline or materially closer to the approved symbol/abbreviation grammar. All probes must retain 100% of seeded facts and exact tokens.

- [ ] **Step 4: Refactor only from observed failures**

If a GREEN response is too loose, add one precise rule or example addressing the observed gap. If it becomes glyph soup, strengthen the ban on invented/single-letter shorthand. If facts disappear, strengthen the final fact-preservation pass. Re-run only affected probes, then all three once after the final edit.

Expected: all three probes pass without leaking expected answers into the subagent prompts.

### Task 6: Final validation and handoff

**Files:**

- Verify: `/home/opsec/.codex/skills/cultra/SKILL.md`
- Verify: `/home/opsec/.codex/skills/cultra/agents/openai.yaml`

- [ ] **Step 1: Run bundled structural validation**

Run:

```bash
python /home/opsec/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/opsec/.codex/skills/cultra
```

Expected: `Skill is valid!`

- [ ] **Step 2: Audit final scope**

Run:

```bash
find /home/opsec/.codex/skills/cultra -maxdepth 3 -type f -print
rg -n 'lite|full|ultra|extreme|tier|level' /home/opsec/.codex/skills/cultra/SKILL.md
rg -n 'code|test|command|path|error|security|irreversible' /home/opsec/.codex/skills/cultra/SKILL.md
```

Expected: exactly `SKILL.md` and `agents/openai.yaml`. Mode words may appear only in historical comparison text such as `stronger-than-caveman`; no selectable levels exist. Quality and exact-token guardrails are present.

- [ ] **Step 3: Remove temporary evidence**

Run:

```bash
rm -rf /tmp/cultra-eval
```

Expected: temporary probe files removed; installed skill remains intact.

- [ ] **Step 4: Report completion without publishing**

Report created files, validation output, GREEN probe result, and the exact invocation `$cultra`. Do not commit, push, publish, or modify the existing `caveman` skill unless the user separately requests it.
