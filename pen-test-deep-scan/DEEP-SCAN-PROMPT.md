# Deep-Scan Penetration Test — `encryption-web` / `chat-nocontrol`

> **Run this prompt with a fresh opencode session** (e.g.
> `opencode run pen-test-deep-scan/DEEP-SCAN-PROMPT.md`).
> It is self-contained. The executing agent must follow it top to bottom.
> **Every run creates a new numbered scan folder** under
> `pen-test-deep-scan/new/` (see §2), so re-running never overwrites prior
> scans.

## 0. Mission

Perform a **deep, exploit-oriented security scan** of the entire
`encryption-web` repository (`chat-nocontrol`): a TypeScript/React/Vite
end-to-end-encrypted web app with a custom binary protocol (`ppx*`), hybrid /
post-quantum cryptography, a PWA + service worker, IndexedDB vault, QR-based key
exchange, and recovery-word identity.

Goal: find **advanced, real-world exploitable flaws**, not lint nits. Every
finding must be reproducible from the source tree, ranked into severity groups,
and written to `${SCAN}/findings/<SEVERITY>/` (see §2 for what `${SCAN}` is).
There is **no findings quota**. Do **not** manufacture weak, speculative, or
padding findings just so the run has output. If no real exploitable issue is
found in a scope, return **zero findings** for that scope. If the whole repo
has no real issues at the depth reached, say so plainly — that is a successful
outcome, not a failure.

The scan is **adaptive**: before delegating, the runner discovers any new
features/subsystems added to the repo since the last run that this prompt does
not yet cover, and extends this run to include them (§2c). After results are
written, the runner **updates this prompt file itself** so the next run starts
from an up-to-date baseline (§10, §11).

This is a **defensive, in-repo audit on code you own**. Do **not** attack live
infrastructure, do **not** touch the GitHub Pages deployment (see
`AGENTS.md` — never publish/deploy), and do **not** exfiltrate or commit any
secrets. All work stays local in this repo.

## 1. Hard constraints

- **Never deploy** to GitHub Pages and **never push** unless the operator
  explicitly asks. Local edits / commits to a local branch only.
- **No destructive git operations** (no force-push, no `reset --hard` on shared
  refs). Use a local working branch `pen-test/deep-scan-<date>` if you commit.
- Do **not** modify `src/`, `scripts/`, or build config to "fix" things during
  the scan — this is a read-only audit. Exceptions: you may create files under
  the current scan folder `${SCAN}/` (and `/tmp/opencode/`), and you may
  **surgically edit `pen-test-deep-scan/DEEP-SCAN-PROMPT.md` itself**, but only
  as described in §10 (append/refine coverage; never delete prior content).
- **No filler findings.** Never report speculative noise, "maybe" issues
  without an exploit path, or low-value padding just to avoid an empty result.
  Absence of real findings is acceptable and should be reported clearly.
- If a verification step needs to run code, run it in `/tmp/opencode/` or via
  the repo's existing `npm` scripts (typecheck/build/tests). Do not install new
  global tooling without asking.
- Respect the **recursive subagent policy** in `~/.config/opencode/AGENTS.md`:
  max depth 3 levels below this runner, max 4 children per round, disjoint
  ownership, self-contained prompts, concise returns.

## 1a. Concise output & thinking style (Cultra) — applies to runner + all subagents

The runner and **every subagent** must write and think **very concisely**.
Density matters: this audit spans many subsystems, so compact returns keep the
parent's context usable. Apply Cultra to all prose the runner emits to the
operator and to all subagent return messages. **Never apply it to code, paths,
commands, findings files, or evidence files** — those stay exact and complete
(schema in §5 must be filled in full).

Compression order:
1. Delete greetings, filler, hedging, repeated context, articles where safe,
   and redundant conclusions.
2. Use short fragments, compact punctuation, and short synonyms.
3. Replace obvious relations with approved symbols.
4. Use conventional technical abbreviations only.
5. Re-read once. Restore every omitted fact or ambiguous word.

Pattern: `[state/result] [cause/constraint]. [next action].`

Symbol grammar:
- `→`: cause, transition, sequence, or next action
- `↑` / `↓`: increase/decrease or ahead/behind
- `Δ`: changes or diff
- `+`: combined items or addition
- `&`: and, only when grouping stays clear
- `=` / `≠`: equality, equivalence, or contrast
- `✓` / `✗`: verified pass/fail only

Prefer symbols when meaning is immediate. Do not create glyph soup.

Abbreviations — conventional forms only: `config`, `auth`, `DB`, `req`, `res`,
`fn`, `impl`, `deps`, `prereqs`, `env`, `repo`, `docs`, `ref`, `UI`, `API`,
`CI`. Never invent shorthand. Avoid single-letter compression and cryptic forms
such as `S/U` or `WT`. Keep readable words such as `staged+unstaged` and
`Worktree`.

Exact material — keep code blocks, inline code, identifiers, commands, flags,
paths, URLs, quoted errors, stack traces, numbers, test counts, commit
messages, and PR text exact or in their required normal format. Compression
affects prose only. Never shorten code, skip tests, weaken assertions, omit
error handling, or reduce implementation quality to save tokens.

Auto-clarity — temporarily use full sentences for security warnings,
destructive or irreversible actions, ambiguous ordering, or any case where
compression risks misreading. Resume Cultra afterward. If the operator asks to
clarify or repeats a question, expand the unclear part.

Output shape — lead with outcome. Prefer 1–4 compact paragraphs for progress
updates. Use lists only when they improve scanning. One word is enough only
when it preserves full meaning.

Examples:

> Status: `main ↑10; heavy staged+unstaged user Δ. Worktree → splits dirty
> state. Work in place; stage exact paths only. Read plan+prereqs → focused
> tests → patch.`
>
> Proof: `Unit: 234/234 ✓. Playwright: 1 WebKit timeout; isolated rerun 1/1 ✓
> → contention flake. No code/test weakening.`
>
> Destructive: `**Warning:** rm -rf /srv/app/data permanently deletes
> production data. Run only after verifying a usable backup, then receiving
> explicit user approval.`

Common mistakes:
- Too loose: `main ahead 10; staged and unstaged user changes...`
- Too cryptic: `main↑10 | Δuser:S/U | WT⇒state÷ ∴ inplace...`
- Target: `main ↑10; staged+unstaged user Δ. Worktree → splits dirty state.`

## 2. Initialize scan folder & recon (do this first, ~1 round)

### 2a. Create the next scan folder (auto-increment)

Before anything else, work out which scan folder to use so each run is isolated.

1. List existing folders matching `pen-test-deep-scan/new/scan-*` (use
   `glob`/`ls`). If none exist, this is the first run.
2. From the matching names `scan-<N>`, take the **highest** `<N>`. The next scan
   is `<N>+1`. If none exist, start at `1`.
   - Parse only the numeric suffix. Ignore any non-`scan-<integer>` entries.
   - Do **not** reuse or overwrite an existing scan folder; always create a new
     one.
3. Let `SCAN = pen-test-deep-scan/new/scan-<N+1>`. **All output paths in the
   rest of this prompt use `${SCAN}` as shorthand for this exact folder.**
   Substitute it everywhere you see `${SCAN}`.
4. Create the scaffold:
   ```
   ${SCAN}/
     SUMMARY.md          (leave empty for now — written in §7)
     evidence/
     pocs/
     findings/
       CRITICAL/  HIGH/  MEDIUM/  LOW/  INFO/
   ```
5. Print the chosen `${SCAN}` path to the operator so it's clear which folder
   this run owns.

### 2b. Recon — build a shared map for subagents

1. Read these for context (parallel reads):
   - `README.md`, `SECURITY.md`, `docs/security-architecture.md`,
     `docs/threat-model.md`, `docs/protocol-v1.md`, `docs/protocol-v2.md`,
     `docs/protocol-qr-message-v1.md`, `AGENTS.md`, `package.json`.
2. Inventory the tree into subsystem buckets (use `find`/`glob`):
   - **C1 Crypto core**: `src/crypto/**`, `src/workers/**`, `src/protocol/**`
     (binary/encoding layer)
   - **C2 Protocol logic**: `src/protocol/ppx*` (framing, manifests, inner/outer,
     armor, checksums, base37/45/64url, bytes)
   - **A1 App/UI/state**: `src/app/**`, `src/components/**`, `src/flows/**`,
     `src/i18n/**`, `index.html`
   - **A2 Persistence/runtime**: `src/storage/**`, `src/sw/**`,
     `src/diagnostics/**`, PWA manifest, `vite.config.ts`
   - **S1 Supply chain/build/CI**: `package.json`, `package-lock.json`,
     `scripts/**`, `.github/**`, `eslint.config.js`, `tsconfig*.json`,
     `playwright.config.ts`, `vitest.config.ts`, `.npmrc`, `fixtures/`,
     `docs/deployed-releases.json`, `docs/independent-security-review*.json`
   - **S2 Tests/spec-drift**: `src/tests/**` (property/fuzz/e2e/release),
     `docs/**` vs implementation (spec-vs-code mismatches)
3. Count files per bucket; note entry points and trust boundaries.
4. Write the map to `${SCAN}/evidence/00-recon.md`
   (subsystem → file list → entry points → trust boundaries → lines of code).

### 2c. Discover uncovered features (adaptive coverage)

This prompt was written against a snapshot of the repo. Features added since
must not silently slip past the scan. Detect them now, before delegating.

1. Read the **coverage baseline** ledger at the end of this prompt (§11). It
   lists every subsystem/file-glob this prompt currently knows how to scan,
   plus the commit SHA it was last verified against.
2. Diff the live tree (from §2b) against the ledger: list any **directory,
   file, or subsystem** that exists in `src/`, `scripts/`, `.github/`, `docs/`,
   `public/`, or top-level config — but is **not** referenced by the §2b
   buckets, the §3 delegation tables, or the §4 checklist.
   - A new file *inside* an already-covered glob (e.g. a new file under
     `src/crypto/**`) is **in-scope automatically** — note it but no action
     needed.
   - A **new top-level subsystem / new directory / new entry point / new CI
     workflow / new top-level config** (e.g. a new `src/realtime/` dir, a new
     worker, a new `src/blockchain/`, a new `.github/workflows/x.yml`) is an
     **uncovered feature** that needs explicit handling.
   - Also detect **removed** subsystems (ledger references a path that no
     longer exists) so §10 can prune the ledger — but never delete prior
     checklist history; mark as `removed@<sha>`.
3. For each uncovered feature:
   - Read its entry points and a couple of representative files to infer what
     it does and its exploit surface.
   - Decide coverage: assign to the best-fitting existing Round-1/2 child, or
     flag for a dedicated child in §3 (respecting the ≤4/round cap — push
     overflow to the next round or to Round 3).
   - Draft the new §4 checklist items that apply to it (so subagents get
     exploit guidance).
4. Write the result to `${SCAN}/evidence/02-features-discovered.md`:
   - Table of uncovered features: `path` | inferred purpose | assigned child |
     proposed §4 checklist items.
   - If none found, write: "No uncovered features; tree matches coverage
     baseline (§11) at commit `<sha>`."
5. Carry these assignments forward into §3 this run, and carry the proposed
   §4 additions into §10 (where the prompt is updated for the next run).

## 3. Delegation strategy (recursive subagents, **sequential**)

The project is **not small** (232+ TS/TSX files). Split by **disjoint
subsystem ownership** so subagents don't duplicate work. **Run subagents one
at a time — sequentially, not in parallel.** Each child must finish and return
before the next child starts. This keeps the run simple to follow, avoids
context contention, and lets each child's findings inform the next child's
focus. Max 4 children per round; collect concise findings; synthesize; then
run a second round if needed. Any **uncovered features** found in §2c are
folded into the rounds below: assign each to the best-fitting existing child,
or if none fits, add a dedicated child (respecting the ≤4/round cap — push
overflow to the next round or to Round 3). Note any ad-hoc children added this
run in `${SCAN}/evidence/02-features-discovered.md`.

> Do **not** launch multiple subagent `task` calls in one message. Issue a
> single `task` call, wait for its return, write a one-line Cultra status, then
> issue the next. The only parallelism allowed is **file reads** inside the
> runner's own recon (§2b) and inside each individual subagent.

Each subagent prompt **must** be self-contained and include:
- its exact subsystem scope (file globs),
- the exploit checklist relevant to that subsystem (from §4),
- the finding schema (§5) and output path
  `${SCAN}/findings/<SEVERITY>/<ID>-<slug>.md`,
- instruction to **read code, not guess**, cite `file:line`,
- instruction to write **very concise** return messages per the Cultra style
  (§1a): return only a compact list (ID, severity, title, `file:line`,
  one-line exploit summary) plus paths written — not full prose. The finding
  **files** themselves stay full and exact per §5; only the **return message**
  is compressed,
- instruction that **zero findings is valid** when no real issue is found; do
  **not** pad with speculative LOW/INFO items just to produce output,
- instruction **not** to revert or touch files outside its scope (it may only
  write under `${SCAN}/findings/` and `${SCAN}/pocs/`),
- instruction to flag anything needing deeper verification for the parent.

### 3a. Subagent model routing table (orchestrator chooses per task)

Use the table below to choose the **model for each child**. The orchestrator
decides case-by-case; do **not** hard-code one model for the whole run. This
prompt is **recall-first, not cheapest-first**: prefer the model more likely to
find a real issue when there is doubt. It is acceptable to spend roughly
**1.3× more tokens / cost** than the minimum-cost routing if that improves odds
of finding a real vulnerability or false-negative-prone exploit chain.
Escalate early when the task is cross-cutting, long-horizon, ambiguous, or
needs stronger synthesis / severity judgment. Use the **exact configured model
IDs** below. Do **not** use older Kimi variants for this prompt; prefer
`kimi-k2.7-code` or `kimi-k2.6`.

| Model ID | Capability / best-fit task shape | Strengths | Weaknesses |
|----------|----------------------------------|-----------|------------|
| `deepseek-v4-pro` | Default high-value lane for most serious scan work: parent/orchestrator, final synthesis, uncovered-feature triage, cross-cutting exploit validation, high-risk verification, round-3 PoC judgment, and many non-trivial workers | Strong reasoning; good repo-wide synthesis; better at severity ranking and connecting exploit chains across subsystems; very strong **price-per-task** value on Artificial Analysis despite higher token rates | Still not ideal when 1M-context statekeeping dominates or when a coding-focused second opinion is useful |
| `deepseek-v3.2` | Cheap fallback worker for truly narrow, disposable first-pass scans: leaf crypto files, parser passes, tests, storage, service worker, CI/script reads | Very low raw token price; good for bounded first-pass triage | On Artificial Analysis, **price per task** is worse than `deepseek-v4-pro`; lower intelligence; do not trust alone for subtle exploit chains or final severity calls |
| `deepseek-v3.2-thinking` | Cheap-ish fallback for bounded tasks that need extra reasoning but still do not justify stronger lanes | Better reasoning than plain `deepseek-v3.2`; good if parent wants a low-cost second pass on a narrow scope | Raw token price is low, but thinking-token usage raises realized spend; still weaker value than `deepseek-v4-pro` on task-cost basis |
| `glm-5.2` | Long-horizon or messy tasks with large context: runner fallback, cross-round synthesis, prompt-update work, cases with many docs + code + evidence files in play | Very strong long-context stability; good at sustained multi-step repo work; reliable when parent must keep many constraints in view | Highest task-cost lane here; overkill for routine leaf scans; use selectively |
| `kimi-k2.7-code` | Coding-focused second-opinion lane for app / flow / UI / state tasks, mixed code+docs review, spec drift, medium-width cross-file reasoning | Good coding focus; AA token-use is materially lower than `kimi-k2.6`; useful when task spans UI flows, state, and documentation together | Still worse **price per task** than `deepseek-v4-pro`; do not spend it on narrow parser-only or single-file checks |
| `kimi-k2.6` | Backup / secondary pass when `kimi-k2.7-code` is unavailable or when a second opinion helps on docs↔impl drift or UI/state logic | Strong broad reasoning; slightly higher AA intelligence than `kimi-k2.7-code` | Much worse token efficiency than `kimi-k2.7-code`; worse **price per task** than `deepseek-v4-pro`; avoid by default |

Routing heuristics:
- Do **not** use `deepseek-v4-flash` for this prompt.
- Optimize on **price per task / expected findings**, not raw token price.
- Default bias: start on `deepseek-v4-pro` unless scope is truly narrow,
  leaf-like, and cheap-first triage is acceptable.
- Start bounded workers on `deepseek-v3.2` **only** when scope is truly narrow
  and leaf-like, result is disposable first-pass triage, and missed subtlety is
  acceptable because the parent plans escalation if anything looks suspicious.
- Use `deepseek-v3.2-thinking` when the task is still bounded but the exploit
  path is subtle enough that extra reasoning may pay off, but `deepseek-v4-pro`
  still wins when the task matters enough to justify better recall.
- Use `deepseek-v4-pro` by default for findings that may be `HIGH` /
  `CRITICAL`, for cross-cutting exploitability, subtle source→impact chains, or
  when the parent must arbitrate severity.
- Use `glm-5.2` when context width / long-horizon statekeeping is main problem,
  and also when the parent suspects a false negative due to too much moving
  context, not just as a last resort.
- Use `kimi-k2.7-code` for UI/state/spec-drift style tasks that are wider than a
  leaf-code audit and where a coding-focused second opinion is worth modestly
  more spend.
- Use `kimi-k2.6` only as a fallback or second-opinion lane.
- Record the chosen model per child in `${SCAN}/evidence/01-subagent-returns.md`
  so later review can explain why a given lane was used.

### 3b. Artificial Analysis task-cost table + spend policy (verified 2026-07-16)

Use this table as the **primary spend guide**. It is better than raw token
price because it factors **token efficiency**. Artificial Analysis cost/task is
a proxy benchmark, not a guarantee for this exact pentest workload, but it is a
far better routing signal than USD / 1M tokens alone. If live Artificial
Analysis or provider pages drift, update this prompt in §10/§11.

| Model ID | AA Intelligence Index | AA Cost / Task | AA Output Tokens / Task | Confidence | Spend guidance |
|----------|------------------------|----------------|--------------------------|------------|----------------|
| `deepseek-v4-pro` | 44.27 | $0.0448 | ~37k | direct | Best default value lane in this prompt: high recall + very low task cost |
| `deepseek-v3.2` | 32.04 | ~$0.12 | ~15.35k | mixed: direct tokens + AA snippet cost | Use only for narrow cheap triage when lower intelligence is acceptable |
| `kimi-k2.7-code` | 41.95 | ≈$0.15–$0.18 | ~17.72k | inferred from AA token-use + same Kimi pricing family + AA comparison snippets | Best Kimi lane; token-efficient vs `kimi-k2.6`; good coding-focused second opinion |
| `kimi-k2.6` | 44.22 | ~$0.31 | ~38.14k | mixed: direct tokens + AA article cost | Fallback only; near-`deepseek-v4-pro` intelligence at far worse task cost |
| `glm-5.2` | 51.09 | $0.4683 | ~43k | direct | Use only when 1M-context / long-horizon statekeeping is worth large extra spend |

Primary spend policy:
- Optimize for **issue-finding per task-dollar**, not raw token price.
- `deepseek-v4-pro` is default because Artificial Analysis shows it is both
  stronger and cheaper **per task** than `deepseek-v3.2`, `kimi-k2.6`, and
  usually `kimi-k2.7-code`.
- `deepseek-v3.2` looks cheap per token but is **worse value per completed
  task** than `deepseek-v4-pro`; use it only for disposable triage.
- Prefer `kimi-k2.7-code` over `kimi-k2.6` when you want Kimi-family behavior:
  AA shows much better token efficiency at similar raw pricing.
- Reserve `glm-5.2` for giant-context / long-horizon synthesis, prompt-update
  work, or suspected false negatives caused by context overload.
- If two lanes seem equally likely to find the issue, choose lower **AA
  cost/task**, not lower token price.
- If stronger lane is materially more likely to find a real issue and stays
  near the **1.3×** budget, choose stronger lane.

Secondary raw-pricing reference (CometAPI snapshot, verified 2026-07-16):

| Model ID | Input USD / 1M | Output USD / 1M | Note |
|----------|-----------------|-----------------|------|
| `deepseek-v3.2` | $0.216 | $0.3456 | cheapest raw token lane |
| `deepseek-v3.2-thinking` | $0.216* | $0.3456* | `*` thinking raises realized spend via extra tokens |
| `deepseek-v4-pro` | $0.416 | $0.832 | higher token rate, much better AA task-cost value |
| `kimi-k2.6` | $0.760 | $3.20 | same raw Kimi pricing as K2.7 |
| `kimi-k2.7-code` | $0.760 | $3.20 | better Kimi token efficiency than K2.6 |
| `glm-5.2` | ~$1.12 | ~$3.528 | most expensive raw lane here |

### Round 1 — sequential deep scans (4 children, one at a time)

Run these **in order, one subagent at a time**. After each child returns, emit a
one-line Cultra status (`child ✓/✗ → N findings → next: <child>`), then launch
the next. No parallel `task` calls.

| Child | Scope | Exploit focus |
|-------|-------|---------------|
| `crypto-core` | `src/crypto/**`, `src/workers/**` | §4.1, §4.2 |
| `protocol-binary` | `src/protocol/**`, `fixtures/**` | §4.2, §4.3 |
| `app-ui-state` | `src/app/**`, `src/components/**`, `src/flows/**`, `src/i18n/**`, `index.html` | §4.3, §4.4, §4.5 |
| `supply-chain-build` | `scripts/**`, `.github/**`, `package.json`, `package-lock.json`, configs, `docs/deployed-releases.json`, review evidence | §4.6, §4.7 |

### Round 2 — sequential deep scans (4 children, one at a time)

Same rule: one at a time, in order, status line between each. Do not start
Round 2 until every Round 1 child has returned and you've logged its findings.

| Child | Scope | Exploit focus |
|-------|-------|---------------|
| `persistence-sw` | `src/storage/**`, `src/sw/**`, `src/diagnostics/**`, PWA/manifest, `vite.config.ts` | §4.4, §4.5, §4.6 |
| `tests-coverage-gaps` | `src/tests/**` (property/fuzz/e2e/release) | §4.8 |
| `spec-drift` | `docs/**` vs `src/**` implementation | §4.9 |
| `cross-cutting-logic` | identity/recovery (`src/crypto/identity.ts`, `recovery-words.ts`, `vault.ts`), QR exchange (`qr-text.ts`, `src/protocol/ppxq*`, `src/components/qr/**`), flows cross-references | §4.2, §4.3, §4.5 |

### Round 3 — sequential verification & PoC (only if findings warrant, ≤4 children, one at a time)

Spawn targeted children, **one at a time**, to **confirm** borderline findings:
write a minimal PoC or a focused test under `/tmp/opencode/` (or
`${SCAN}/pocs/`) that demonstrates the exploit, or that disproves a false
positive. Promote/demote severities based on demonstrated impact. Keep PoCs
local and non-harmful.

> If you reach the 3-level depth limit, finish verification locally in the
> runner. Do not over-delegate — synthesize once the answer is clear.

## 4. Advanced exploit checklist (tailored to this project)

Use this as the search space. A finding is only valid if you can show **a
concrete path from source to impact**.

### 4.1 Cryptographic core
- **KEM/hybrid misuse**: nonce/IV reuse, encapsulate/decapsulate state confusion,
  weak shared-secret derivation, missing HKDF context-binding / domain
  separation, KEM ciphertext malleability, PQC downgrade to classic-only.
- **AEAD misuse**: AES-GCM/ChaCha20-Poly1305 nonce reuse, tag truncation,
  reusing (key,nonce) across messages, decryption-before-auth of plaintext,
  length oracle via early error differences.
- **Symmetric/asymmetric primitives**: ECB mode, deterministic IVs, CTR without
  counter uniqueness, RSA without OAEP, DH groups, weak RNG
  (`Math.random`, non-constant CSPRNG seeding).
- **Constant-time / side channels**: secret-dependent branches/array indexing
  in `src/crypto/**` (password compare, tag check, wordlist lookup), timing
  differences in checksum/length validation.
- **Key lifecycle**: keys held in JS `string`/`Array` (not zeroized), missing
  `zeroize.ts` use, keys persisted to `localStorage`/IndexedDB unencrypted,
  recovery words logged/serialized unsafely, key derivation iterations too low
  (PBKDF2/Argon2/scrypt), salt reuse.
- **Randomness**: `crypto.getRandomValues` misuse, modulo bias on small ranges,
  shuffle bias, predictable IDs.
- **Provider abstraction**: `provider.ts`/`default-provider.ts`/`noble-provider.ts`
  /`webcrypto.ts` — downgrades, missing algorithm checks, mismatched output
  lengths, untested provider swaps.

### 4.2 Protocol & binary parsing (`src/protocol/**`)
- **Framing**: length-field integer overflow, truncation, negative lengths,
  unchecked `DataView`/`Uint8Array` offsets → OOB read/write, slice aliasing.
- **Manifest/header confusion** (`ppxf-header`, `ppxf-manifest`): version
  downgrade, algorithm negotiation bypass, ignored fields, duplicate entries,
  path traversal in filenames, zip-slip / overlapping segments, decompression
  bombs (text-compression, `ppxf`).
- **Checksums** (`checksum.ts`): used as integrity/MAC (forgery), non-CRC32C
  collision assumptions, checksum-or-MAC confusion, early-accept then parse.
- **Encoding** (`base37/45/64url`, `bytes`, `text`): case/whitespace
  canonicalization bugs, char-range acceptance too lax, surrogate-pair handling,
  base45 of QR payloads with size limits, concatenation ambiguity.
- **Inner/outer split** (`ppxq/inner/outer`, `ppxt/inner/outer`, `ppxr`, `ppxv`):
  header leakage of metadata in outer layer, unauthenticated plaintext in
  outer envelope, replay across sessions, ordering/sequence bypass.
- **Armor** (`ppxt-armor`): injection via delimiters, MIME-style header spoofing,
  trailing-data acceptance, CRLF injection.
- **Replay/rewind**: missing nonces/timestamps/counters, same ciphertext
  accepted twice, cross-protocol message confusion (`ppxq` vs `ppxt` vs `ppxf`).

### 4.3 Web / DOM / UI
- **XSS**: `dangerouslySetInnerHTML`, `innerHTML`, template literals into DOM,
  unescaped user-controlled fields (contact names, message bodies, filenames,
  QR text, i18n interpolation), `href`/`src` with `javascript:`,
  `data:`/`blob:` mishandling, SVG/img event handlers.
- **DOMPurify / sanitization bypass**: missing sanitize, sanitizer config too
  permissive, mutation XSS, sanitize-then-dirty re-render.
- **postMessage / BroadcastChannel**: missing origin check, `*` target,
  structured-clone of untrusted data, cross-frame command injection.
- **Open redirect / deep link**: route params driving redirects/loads without
  allowlist.
- **State & logic**: prototype pollution via `JSON.parse` + merge, mutable
  shared state, race conditions in async encrypt/decrypt flows, TOCTOU on
  storage reads, cancellation bugs leaking partial plaintext.

### 4.4 Persistence & service worker
- **Storage exposure**: secrets in `localStorage`/`sessionStorage`, unencrypted
  IndexedDB vault (`vault.ts`), keys recoverable from disk, missing expiry,
  cross-origin accessible data, `Cache-Control` on sensitive responses.
- **Service worker** (`src/sw/**`): scope hijack, cache poisoning of JS/HTML
  (serves attacker code on next load), update/activation race, intercepting
  cross-origin requests, silent update path (see recent PWA commits) abused to
  push code without user action.
- **Diagnostics** (`src/diagnostics/**`): logging of plaintext/keys/headers,
  stack traces with secrets, exported bundles.
- **PWA/manifest**: `start_url`/`scope` manipulation, manifest served from
  attacker origin, install spoofing.

### 4.5 Identity, recovery & QR exchange
- **Recovery words** (`recovery-words.ts`, `identity.ts`): wordlist lookup
  timing, entropy mapping bias, checksum bypass on mnemonic, weak BIP-39-style
  entropy, missing zeroization, words shown/logged, copy-to-clipboard retention.
- **QR exchange** (`qr-text.ts`, `ppxq*`, `src/components/qr/**`): QR payload
  forgery, MITM swap of public key during QR exchange, missing binding of
  identity to exchanged key, replay of an old QR, oversized/crafted QR DoS,
  camera/decoded-data injection.
- **Identity binding**: trust-on-first-use without verification, missing
  fingerprint display/compare, silent rotation of keys.

### 4.6 Build, CI & supply chain
- **Dependency integrity**: `package-lock.json` vs `package.json` drift,
  unresolved specifiers, missing integrity hashes, `npm` vs `pnpm`/`yarn`
  lockfile confusion, `overrides`/`resolutions` hiding vulns.
- **Approved-dependency gate**: `scripts/approved-dependencies.json` /
  `check-dependencies.ts` bypass, unapproved crypto provider, pin bypass.
- **Build reproducibility & SBOM**: `build-sbom.ts`, `check-reproducibility.ts`,
  `verify-release.ts` — can a build pass while differing from the reviewed one?
  Non-deterministic emits, untracked env, dev-only code shipped to prod.
- **Release gates**: `check-release-prerequisites.ts`,
  `independent-review-evidence.ts`, `independent-security-review*.json` —
  can the gate be satisfied with a self-forged review file? (cf. OPEN-001:
  public exposure bypassing the release gate.)
- **Secrets in repo**: tokens, private keys, `.env`, build artifacts checked in,
  `output/`/`dist/`/`coverage/` containing sensitive data, `.npmrc` with tokens.
- **CI workflows** (`.github/**`): `pull_request_target` usage, shell injection
  in action steps, untrusted PR triggering privileged steps, secrets exposure,
  `permissions:` overly broad, tag/branch protection gaps.

### 4.7 Config & tooling
- **Vite/esbuild**: `define` injecting secrets, `server` exposed in prod build,
  `fs.allow` widening, source map exposure of server paths, dynamic import of
  user-controlled path.
- **TypeScript/eslint**: `// @ts-ignore`/`as any`/`@ts-expect-error` hiding real
  type confusion at trust boundaries (esp. `unknown`→cast in protocol parsing).
- **Test/tooling scripts**: `scripts/**` TS files with shell injection
  (`exec`/`child_process`), path traversal, `require` of user input, dev-server
  exposed to network.

### 4.8 Test/coverage gaps as exploit indicators
- **Property/fuzz tests** (`src/tests/property/**`): which invariants are *not*
  asserted (e.g. no round-trip on malformed input, no nonce-uniqueness
  assertion, no large-payload/quota test)? Gaps hint at untested attack vectors.
- **Release tests** (`src/tests/release/**`): can a release pass with a drifted
  golden vector? Are golden vectors self-generated by the same code under test?
- **E2E** (`src/tests/e2e/**`): missing negative paths (tampered ciphertext,
  swapped QR, downgrade).
- Do tests ever assert constant-time? If not, flag as Info→Medium.

### 4.9 Spec-vs-code drift
- Compare `docs/security-architecture.md`, `docs/threat-model.md`,
  `docs/protocol-v1/v2.md` against implementation. Mismatches are real
  vulnerabilities (e.g. doc claims "outer envelope reveals nothing" but code
  leaks sender/length; doc claims "MAC before parse" but code parses first).
- Documented threat-model assumptions violated by code (e.g. "device is
  uncompromised" but SW allows cross-origin cache).

## 5. Finding schema (every finding file)

Write one Markdown file per finding at
`${SCAN}/findings/<SEVERITY>/<ID>-<slug>.md`.

```markdown
# <ID>: <title>

- **Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
- **Category:** crypto | protocol | web/dom | persistence/sw | identity/qr |
  supply-chain | config | spec-drift | test-gap
- **Subsystem:** <e.g. src/protocol/ppxf-manifest.ts>
- **Locations:** `path/to/file.ts:123`, `path/other.ts:45`
- **Exploitability:** Confirmed | Likely | Theoretical — with reasoning
- **Impact:** <confidentiality / integrity / availability / key recovery /
  RCE-equiv / auth bypass / downgrade — concrete effect>

## Summary
<2–4 sentences: what is wrong and why it matters for an E2EE app.>

## Vulnerability detail
<Exact code path. Quote the minimal snippet. Explain the misuse.>

## Exploit scenario
<Step-by-step attacker path to impact. Name assumptions.>

## Proof of concept
<Link to ${SCAN}/pocs/<ID>.{ts,md,sh} if built, or inline minimal repro.
 Must be non-harmful and local-only.>

## Remediation
<Concrete, minimal fix. Prefer existing repo patterns/utilities.>

## Verification of fix
<How the operator can confirm the fix (command/test to run).>

## References
<OWASP/CWE/MITRE/protocol doc refs if relevant.>
```

IDs: `<SEVERITY-NNN>` zero-padded per severity, e.g. `CRIT-001`, `HIGH-001`.

## 6. Severity rubric (rank into these groups)

- **CRITICAL** — recoverable secret / plaintext without user interaction, key
  forgery, auth bypass on the E2EE layer, or RCE-equivalent via SW/build
  poisoning of deployed code. Exploit is confirmed or near-trivial.
- **HIGH** — plaintext/secret exposure or integrity break requiring limited
  user interaction or a plausible MITM; downgrade attacks; storage of secrets
  at rest unencrypted; release-gate bypass enabling unaudited deployment.
- **MEDIUM** — exploitable under specific conditions, side-channel with real
  signal, parsing bug causing DoS or info leak on crafted input, XSS in
  non-critical UI, spec-drift weakening a documented guarantee.
- **LOW** — defense-in-depth gap, info leak with low value, weak hardening,
  timing differences hard to exploit, test/coverage gap that masks a higher
  class.
- **INFO** — best-practice observations, documentation accuracy issues, things
  worth tracking but not exploitable.

Calibrate against the **prior audits** now archived under
`pen-test-deep-scan/old/` (`old/pen-test/OPEN-ISSUES.md`,
`old/pen-test-1/findings/`) to avoid re-reporting already-fixed items, **but
still re-verify** — note status (regressed / still-open / mitigated / new) in
each finding. Also check the most recent prior scan in
`pen-test-deep-scan/new/scan-<N>` (if any) for regressions.

## 7. Synthesis & deliverables (runner does this last)

1. Read every finding file the subagents wrote. **De-duplicate** and **merge**
   overlapping findings from different children (cross-link IDs).
2. **Verify the top findings yourself**: open the cited `file:line`, confirm
   the bug is real and the exploit path holds. Demote any false positive and
   delete its file (or move to `${SCAN}/findings/INFO/` with a
   "FALSE-POSITIVE" note).
   - If, after verification, a child produced no real issue, keep it at **zero
     findings**. Do **not** replace missing findings with filler observations.
3. Run `npm run typecheck` and `npm run lint` (if available) only to confirm
   the tree is unchanged by the audit — **not** to validate findings.
4. Write `${SCAN}/SUMMARY.md`:
   - Audit metadata (date, scope, commit SHA, runner model, `${SCAN}` path).
   - Counts per severity (table).
   - Top 10 findings with one-line impact + `file:line`.
   - Subsystem heat map (which area had the most findings).
   - Cross-cutting themes (e.g. "MAC-after-parse pattern recurs in
     ppxf/ppxt").
   - Spec-drift summary.
   - Recommended fix priority order.
   - What was **not** tested and why (out-of-scope / depth limit).
   - If no real exploitable issues were confirmed, say that plainly near the
     top of the summary and final report. That is a valid successful result.
5. Write `${SCAN}/evidence/01-subagent-returns.md` aggregating the concise
   returns from each child (audit trail). Keep each child's entry Cultra-compact.
6. Print a final Cultra-compact report to the operator (per §1a): counts per
   severity, the `${SCAN}` path, path to `SUMMARY.md`, and the single most
   urgent finding — e.g. `scan-3 ✓ → CRIT 2 / HIGH 5 / MED 9 / LOW 12 / INFO 7.
   Top: CRIT-001 nonce reuse @ src/crypto/hybrid.ts:88. SUMMARY → ${SCAN}/SUMMARY.md.`

## 8. Output layout

```
pen-test-deep-scan/
  DEEP-SCAN-PROMPT.md            (this file)
  old/                           (archived prior pen-tests — read-only)
    pen-test/OPEN-ISSUES.md
    pen-test-1/findings/{CRITICAL,HIGH,MEDIUM,LOW,INFO}/
  new/                           (one folder per run, auto-incremented)
    scan-1/
      SUMMARY.md                 (runner writes — ranked overview)
      evidence/
        00-recon.md              (runner writes)
        01-subagent-returns.md   (runner writes)
      findings/
        CRITICAL/ HIGH/ MEDIUM/ LOW/ INFO/   (one .md per finding)
      pocs/                      (optional local PoCs)
    scan-2/
      ...
```

The runner only writes inside `${SCAN}` (the `scan-<N+1>` it created in §2a).
`old/` and any earlier `scan-*` folders are **read-only** reference.

## 9. Stop conditions

- All §3 rounds complete (or justified early-stop once synthesis is clear).
- Every confirmed finding has a file in the right severity folder.
- `${SCAN}/SUMMARY.md` written and final report printed.
- **Prompt self-update complete** (§10): coverage ledger (§11) refreshed and
  any new features added to §2b/§3/§4.
- **Do not commit or push.** Leave the working tree dirty with findings only
  under `${SCAN}/` and the updated `DEEP-SCAN-PROMPT.md`; tell the operator
  what to review and how to commit if they choose.

## 10. Self-update this prompt (after synthesis, before finishing)

Once findings are written and `SUMMARY.md` exists, make this prompt aware of
anything new so the next run starts from an up-to-date baseline. **Only edit
`pen-test-deep-scan/DEEP-SCAN-PROMPT.md`. Use surgical `edit` operations —
never rewrite or overwrite the whole file, and never delete prior checklist
items or findings history.**

Steps:

1. Re-read §11 (coverage baseline) and `${SCAN}/evidence/02-features-discovered.md`.
2. For each **uncovered feature** confirmed this run:
   - **§2b**: if it is a whole new subsystem, add a recon bucket (e.g.
     `**XN New-subsystem**: `path/**` (one-line description)`).
   - **§3**: if it warrants its own child, add a row to the Round-1 or Round-2
     table (`| \`new-feature\` | \`path/**\` | §4.N |`). If it was folded into
     an existing child, no table change needed.
   - **§4**: add the exploit items you drafted in §2c. Add a new `### 4.N
     <feature>` subsection if the surface is distinct, or append bullets to
     the closest existing subsection. Prefix each added block with an HTML
     comment provenance tag: `<!-- added by scan-<N> @ <short-sha> -->`.
3. For any **removed** subsystem (ledger path no longer exists), do **not**
   delete the row — append ` (removed@<short-sha>)` to its "Last verified"
   cell so history is preserved.
4. Refresh the §11 baseline lines:
   - `Baseline commit:` → current `git rev-parse HEAD` short SHA.
   - `Baseline date:` → today's date.
   - `Last scan:` → `${SCAN}` (the scan folder this run created).
5. Update the §11 coverage table: add rows for newly covered subsystems, and
   update the `Last verified` column for every subsystem actually scanned this
   run (set to `scan-<N> @ <short-sha>`).
6. Append a short changelog entry to `${SCAN}/evidence/03-prompt-updates.md`:
   every edit made to the prompt (section, what was added/changed, why, the
   exact `oldString`→`newString` summary). This is the audit trail for the
   self-mutation.
7. If **nothing new** was found, still refresh the `Last scan` / `Last
   verified` lines in §11 so the next run knows the baseline was re-confirmed
   at this commit, and write "No prompt changes needed; baseline re-confirmed"
   to `03-prompt-updates.md`.

Editing rules (strict):

- Use the `edit` tool with precise, unique `oldString`/`newString`. Never
  `write` the whole prompt file.
- Preserve all existing content, ordering, and Markdown structure.
- Only append or refine — never remove prior §4 items, §3 rows, or §2b buckets
  (mark removed ones, don't delete).
- After editing, re-read the prompt once to confirm it is still valid Markdown
  and the section numbering is intact.

## 11. Coverage baseline (living ledger — maintained by the runner)

> The runner reads this at the start of every run (§2c) and updates it at the
> end (§10). The first run finds this pre-seeded with the subsystems known when
> the prompt was created.

- **Baseline commit:** `328a20f` (set by scan-1)
- **Baseline date:** `2026-07-16`
- **Last scan:** `pen-test-deep-scan/new/scan-1`
- **Prompt version:** 1

| Subsystem | File globs | Covered by (§3 child + §4) | First scan | Last verified |
|-----------|-----------|----------------------------|------------|---------------|
| Crypto core | `src/crypto/**`, `src/workers/**` | `crypto-core` + §4.1 | scan-1 | scan-1 @ 328a20f |
| Protocol / binary | `src/protocol/**`, `fixtures/**` | `protocol-binary` + §4.2 | scan-1 | scan-1 @ 328a20f |
| App / UI / state | `src/app/**`, `src/components/**`, `src/flows/**`, `src/i18n/**`, `index.html` | `app-ui-state` + §4.3, §4.4, §4.5 | scan-1 | scan-1 @ 328a20f |
| Supply chain / build / CI | `package.json`, `package-lock.json`, `scripts/**`, `.github/**`, configs, `docs/deployed-releases.json`, `docs/independent-security-review*.json` | `supply-chain-build` + §4.6, §4.7 | scan-1 | scan-1 @ 328a20f |
| Persistence / service worker | `src/storage/**`, `src/sw/**`, `src/diagnostics/**`, PWA manifest, `vite.config.ts` | `persistence-sw` + §4.4, §4.5, §4.6 | scan-1 | scan-1 @ 328a20f |
| Tests / coverage gaps | `src/tests/**` | `tests-coverage-gaps` + §4.8 | scan-1 | scan-1 @ 328a20f |
| Spec vs code drift | `docs/**` vs `src/**` | `spec-drift` + §4.9 | scan-1 | scan-1 @ 328a20f |
| Cross-cutting identity/QR | `src/crypto/identity.ts`, `recovery-words.ts`, `vault.ts`, `qr-text.ts`, `src/protocol/ppxq*`, `src/components/qr/**` | `cross-cutting-logic` + §4.2, §4.3, §4.5 | scan-1 | scan-1 @ 328a20f |

_New subsystems discovered by future runs are appended here by §10._

---

**Operator note:** To launch, run
`opencode run pen-test-deep-scan/DEEP-SCAN-PROMPT.md`
(or paste this file's contents into a fresh session). Each run auto-creates the
next `pen-test-deep-scan/new/scan-<N>` folder, discovers any new repo features
not yet covered by the prompt, scans everything via subagents, writes ranked
findings, and then **updates this prompt file itself** so the next run covers
the new features from the start. Re-running is safe; prior scans and prior
prompt content are never overwritten. Expected runtime: several rounds of
subagent delegation. Review `${SCAN}/SUMMARY.md` first, then drill into
`${SCAN}/findings/<SEVERITY>/`, then check `${SCAN}/evidence/02-features-discovered.md`
and `03-prompt-updates.md` to see what the run learned.
