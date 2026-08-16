# MEDIUM – Live deployment contradicts SECURITY.md "unaudited / not deployed" policy

**File(s):**
- `SECURITY.md:3`: `> **Status:** Public beta candidate / unaudited / not deployed`
- `SECURITY.md:31-33`: "This public beta remains unaudited until the protocol implementation and its full object formats receive independent security review. That review is a blocker for publishing or claiming public-beta readiness."
- `docs/threat-model.md:3`: same "not deployed" status.
- Live site: `https://levi-cm.github.io/chat-nocontrol/` (gh-pages commit `93e0330`, "deploy: publish private preview to GitHub Pages")

**Attacker scenario:**
A user reads SECURITY.md, sees "unaudited" and "not deployed", and treats the protocol as pre-release. They then encounter the live site and assume it is a reviewed, supported release. The claim-accuracy gap causes users to over-trust an explicitly unaudited implementation, and the threat model's own assumptions ("Use unaudited implementation side channels") become exploitable on a deployed target the maintainer hasn't sanctioned as production-ready.

**Proof:**
```
$ head -5 SECURITY.md
> **Status:** Public beta candidate / unaudited / not deployed

$ gh api repos/levi-cm/chat-nocontrol/pages --jq '.source'
{"branch":"gh-pages","path":"/"}

$ git -C /tmp/audit-live log -1 --format="%H %s"
93e033092000a6e51d8a63417a0269a881e9dd03 deploy: publish private preview to GitHub Pages
```

**Mitigation:**
Either (a) complete the independent security review the SECURITY.md declares as a publishing blocker and then update the status to "deployed public beta", or (b) take the site down until the review is done. At minimum, reconcile the documentation status with the deployment reality so users are not misled about the audit posture.
