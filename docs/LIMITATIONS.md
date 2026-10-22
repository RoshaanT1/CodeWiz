# CodeWiz: Edge Cases, Limitations, and Solutions

CodeWiz’s main challenge is that it modifies real code and uses AI to evaluate whether a developer understands it. The safest design treats repository content, model output, user input, and imported dependencies as untrusted.

---

## 1. Repository import edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| Repository does not exist | Import job fails | Validate repository existence before creating a job and show a clear error |
| Repository is private | Unauthorized access or token exposure | Support public repositories first; if private repositories are added, use short-lived OAuth tokens and never store them permanently |
| Repository is renamed or deleted during import | Inconsistent snapshot | Pin the repository to a commit SHA immediately and process only that immutable version |
| Repository changes during processing | Challenge refers to outdated code | Store branch, commit SHA, import timestamp, and snapshot hash |
| GitHub API rate limit reached | Import cannot complete | Use authenticated GitHub API access where appropriate, queue retries, show job status, and enforce per-user limits |
| GitHub is unavailable | Import job remains stuck | Use timeouts, retries with backoff, dead-letter queues, and a clear failed state |
| URL points to a non-GitHub server | SSRF risk | Allow only approved hosts and validated repository URL formats |
| URL redirects to a private IP | SSRF risk | Revalidate every redirect and block private, loopback, link-local, and cloud-metadata addresses |
| DNS changes after validation | DNS rebinding attack | Resolve and validate the address immediately before every outbound request |
| Repository has no supported source files | No challenge can be created | Explain supported languages and show an import result with zero eligible functions |
| Repository is empty | No content to analyze | Reject it with a clear reason |
| Repository is a monorepo | Processing may become expensive | Support folder selection, repository limits, and incremental analysis |
| Repository contains submodules | Missing or unsafe content | Do not fetch submodules by default; show that they were excluded |
| Nested Git repositories | Confusing source boundaries | Treat nested repositories as separate content or exclude them explicitly |
| Repository uses Git LFS | Files may be unavailable or huge | Do not fetch LFS objects by default; mark unavailable files |
| Repository contains Git hooks | Possible code execution | Never execute hooks |
| Repository has a huge history | Unnecessary storage and processing | Fetch only the selected commit or shallow clone |
| Repository has unusual branch names | Parsing or path issues | Treat branch names as data, validate them, and use commit SHA internally |
| Repository has malicious filenames | Path traversal or display issues | Normalize paths, reject traversal, safely encode display values, and never use filenames in shell commands |
| Repository has duplicate files with case differences | Conflicts on case-insensitive filesystems | Process inside a controlled Linux environment and detect case collisions |
| Repository uses invalid Unicode | Parser or display failures | Normalize safely, reject invalid encodings, and preserve a safe display representation |
| Repository contains binary files | Wasteful processing | Detect file types and exclude binaries except for explicitly supported formats |
| Repository contains generated code | Low-value challenges | Exclude known generated directories and allow configurable patterns |
| Repository contains vendored dependencies | Huge, repetitive analysis | Exclude vendor, node_modules, dist, build, coverage, and similar paths |
| Repository contains encrypted or compressed files | Cannot safely understand content | Exclude them unless explicitly supported and safely scanned |
| Repository contains secrets | Exposure to logs or AI provider | Detect and redact secrets; quarantine or exclude affected files |
| Repository contains personal data | Privacy risk | Minimize content sent to external services and provide deletion controls |
| Repository is larger than the maximum size | DoS and cost risk | Enforce file-count, file-size, total-size, depth, and processing-time limits |
| Repository contains millions of small files | Metadata exhaustion | Enforce file-count limits and stop processing after thresholds |
| Archive extraction creates a zip bomb | Storage and CPU exhaustion | Enforce compressed/uncompressed size limits, file-count limits, and safe extraction paths |
| Symlink points outside repository | Data disclosure | Reject symlinks or resolve and verify their targets inside the snapshot |
| Hard link references sensitive files | Unexpected data access | Use safe extraction and isolated storage; reject unsupported link types |
| Repository has no license | Legal uncertainty | Display a notice and define whether imported content is retained or deleted |
| Repository license prohibits processing | Legal or policy issue | Provide policy checks and document repository-content handling |

---

## 2. Authentication and account edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| Weak password | Account takeover | Enforce password length, block known breached passwords, and hash with Argon2id |
| User reuses a password | Credential-stuffing risk | Encourage unique passwords and detect suspicious login patterns |
| Brute-force login attempts | Account takeover | Apply IP, account, and device-based rate limits with progressive delays |
| MFA code is replayed | Unauthorized login | Mark successful TOTP time windows as consumed where practical and rate-limit attempts |
| Device clock is incorrect | Legitimate login failure | Allow a small TOTP clock window, such as one adjacent time step |
| User loses authenticator | Account lockout | Provide one-time recovery codes and a verified account-recovery process |
| Recovery codes are exposed | Account takeover | Hash recovery codes, show them once, allow regeneration, and revoke old codes |
| User loses email access | Recovery abuse | Use identity verification and administrative review for high-risk recovery |
| Session token is stolen | Account takeover | Use secure, HttpOnly, SameSite cookies, short session lifetimes, rotation, and revocation |
| User logs in from many locations | Suspicious activity | Track sessions, notify users, and allow session revocation |
| User changes password | Old sessions remain valid | Revoke all sessions or require explicit session preservation |
| User disables MFA | Security downgrade | Require reauthentication, current MFA, and audit the event |
| Email verification link is reused | Account manipulation | Make verification tokens single-use and short-lived |
| Account enumeration | Privacy issue | Return uniform login and registration responses |
| User deletes account during a job | Orphaned data or processing | Cancel jobs, revoke access, apply deletion workflow, and securely delete retained data |
| User creates many accounts | Abuse and AI-cost risk | Use email verification, rate limits, device signals, and abuse monitoring |
| Admin account is compromised | Full-system access | Enforce strong MFA, least privilege, separate admin identities, and monitor admin actions |

---

## 3. Authorization and tenant-isolation edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| User changes an object ID in the URL | IDOR | Enforce ownership on every request and use database RLS |
| User guesses sequential IDs | Object enumeration | Use opaque public IDs and authorization checks |
| Background job processes the wrong user’s repository | Cross-tenant leak | Include owner ID in job payloads and verify ownership before processing |
| Cache returns another user’s result | Data disclosure | Include tenant context in cache keys or do not cache sensitive data |
| Signed object URL is shared | Unauthorized source access | Use short expirations, narrow object permissions, and access logging |
| Database query forgets tenant filter | Cross-tenant data exposure | Use RLS as a second enforcement layer and test negative cases |
| Join retrieves another user’s answer key | Answer-key leak | Separate answer-key storage and restrict database roles and views |
| User changes ownership fields | Privilege escalation | Never accept owner or tenant fields from the client |
| Deleted user’s job continues | Unauthorized processing | Recheck account and authorization state in every worker |
| Admin endpoint is exposed to normal users | Privilege escalation | Separate routes, permissions, roles, and tests |
| User accesses an old challenge after deletion | Data retention issue | Define deletion semantics and enforce challenge ownership |
| Shared sample repository is modified by one user | Data corruption | Store sample repositories as immutable shared records |
| User copies another user’s review ID | Unauthorized results | Verify review ownership server-side |

---

## 4. Parser and language limitations

| Edge case | Limitation | Recommended solution |
|---|---|---|
| Syntax errors in source | AST parsing fails | Record parser errors, skip invalid files, and show partial-analysis status |
| Unsupported language version | Incorrect parsing | Pin parser versions and detect language versions where possible |
| Python decorators | Function boundaries may be ambiguous | Include decorators in metadata and preserve exact source spans |
| Nested functions | Duplicate or overlapping spans | Store parent function IDs and deterministic nesting rules |
| Anonymous functions | Difficult to name and reference | Generate stable synthetic names based on file and source location |
| JavaScript dynamic imports | Static call graph is incomplete | Label graph confidence and avoid claiming complete coverage |
| TypeScript type-only syntax | Parser mismatch | Use a TypeScript-aware parser and preserve compiler configuration when available |
| JSX or TSX | Incorrect parsing if treated as JavaScript | Detect TSX/JSX and use the correct parser mode |
| Decorators and experimental syntax | Parser failures | Read supported configuration safely without executing project code |
| Python dynamic dispatch | Call graph is approximate | Clearly label static analysis limitations |
| Reflection | Missing callers or callees | Use confidence scores and avoid overclaiming importance |
| Monkey-patching | Static graph becomes inaccurate | Record that dynamic behavior is not represented |
| Higher-order functions | Call relationships are uncertain | Use approximate edges with confidence levels |
| Generated functions | Low learning value | Exclude generated files and mark exclusion reasons |
| Functions with macros or preprocessing | Source lines differ from runtime | Analyze source-level behavior and clearly state the limitation |
| Multiple functions on one line | Line-based flagging is imprecise | Use character offsets internally and display line plus column |
| Extremely long functions | Poor user experience | Set maximum size or split into review sections while preserving context |
| File encoding is invalid | Parser failure | Detect encoding, reject unsafe content, and report the file |
| Source maps are present | Original source may differ from generated code | Prefer original source and exclude generated output |
| Duplicate symbol names | Ambiguous references | Use file path, scope, symbol, and source range as the identity |
| Partial parser recovery | Incorrect boundaries | Store parser confidence and reject low-confidence challenge candidates |
| Syntax valid but semantics unclear | AI may invent a bug | Require behavioral evidence or reject the challenge |
| No tests exist | Hard to validate behavior | Use static invariants, type checks, targeted sandbox tests, and confidence labels |
| Project needs unavailable dependencies | Execution cannot work | Avoid dependency installation; use static verification where possible |

---

## 5. Call-graph and ranking edge cases

| Edge case | Limitation | Recommended solution |
|---|---|---|
| Function is never statically called | It may still be an entry point | Consider exports, routes, CLI handlers, and framework conventions |
| Framework calls functions indirectly | Callers are not visible | Add framework-specific heuristics and mark confidence |
| Database access is hidden behind helpers | Importance is underestimated | Propagate effects through known call edges |
| Network access is abstracted | Risk signals are missed | Maintain configurable API and library patterns |
| Recursive functions | Caller count may be misleading | Add recursion and complexity signals |
| Utility function has many callers | May be too trivial for a challenge | Exclude trivial functions and balance category selection |
| Large function has many branches | Challenge may be overwhelming | Use complexity thresholds and smaller review slices |
| Function contains no safe bug opportunity | AI may force a bad mutation | Skip the function and select another |
| Same function is selected repeatedly | Poor coverage | Track prior selections and enforce no-repeat windows |
| Important function has secrets | Challenge could expose sensitive data | Redact or exclude it |
| Test function appears important | Low training value | Exclude tests by default |
| Generated function ranks highly | Misleading challenge | Exclude generated content |
| Dynamic language makes ranking uncertain | Importance score is approximate | Display rationale and confidence, not false precision |

---

## 6. Bug-planting edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| AI changes the wrong line | Incorrect grading | Validate diff against the answer key and reject mismatches |
| AI changes multiple unrelated lines | Challenge ambiguity | Restrict diff scope and enforce maximum changed lines |
| Bug does not change behavior | Unfair challenge | Run targeted behavior checks or independent semantic verification |
| Bug changes behavior only on rare input | User may reasonably miss it | Require a reproducible triggering condition in the answer key |
| Bug is too obvious | Low training value | Use difficulty rules and reject trivial mutations |
| Bug is impossible to detect from the visible function | Unfair challenge | Include required context or skip the mutation |
| Bug depends on external services | Verification is unreliable | Use mocks, static invariants, or avoid that mutation |
| Bug causes syntax error | Broken challenge | Parse modified code before publishing |
| Bug changes function boundaries | Review becomes confusing | Compare AST boundaries before and after mutation |
| AI invents a bug type | Inconsistent grading | Restrict bug types to a controlled catalogue |
| Wrong variable mutation changes nothing | False challenge | Run semantic checks and compare relevant data flow |
| Off-by-one bug is language-specific | Incorrect transformation | Use language-aware transformation rules |
| Mutable default argument is not valid in JavaScript | Wrong catalogue application | Map bug types to supported languages |
| Async bug requires runtime timing | Static validation is difficult | Use controlled sandbox tests or label as lower-confidence |
| Null-check bug is impossible because of a type guarantee | False challenge | Inspect type annotations and known guards |
| Error-swallowing mutation is intentional | False positive | Check local error-handling intent and require evidence |
| Bug is masked by another bug | Multiple explanations | Reject challenges with overlapping defects |
| Original code already contains the same bug | User may be penalized unfairly | Compare baseline behavior and exclude pre-existing target defects |
| Mutation exposes a secret | Data leakage | Scan before and after mutation and reject |
| Mutation creates unsafe code execution | Security risk | Block dangerous syntax and never run outside an isolated sandbox |
| Mutation removes authentication logic | Excessive impact | Prohibit security-critical transformations |
| Mutation changes license or metadata | Scope violation | Restrict changes to the selected function |
| AI output contains extra prose | Parser failure | Require structured output and reject unknown fields |
| AI produces incorrect line numbers | Grading mismatch | Derive line mappings from the actual diff rather than trusting the model |
| Two model passes disagree | Uncertain challenge | Reject or send to human review |
| Challenge generation is repeated | Cost and duplicate risk | Use idempotency keys and deterministic challenge IDs |
| Challenge is generated from an outdated repository version | Invalid review | Store and verify the repository commit SHA |
| Model copies prompt-injection instructions from source | Security risk | Clearly delimit source as data and validate output independently |
| AI suggests a fix that introduces a second bug | Misleading feedback | Validate proposed fixes separately and label them as suggestions |

---

## 7. Challenge-verification edge cases

| Edge case | Limitation | Recommended solution |
|---|---|---|
| Parser says code is valid but behavior is unchanged | Static validation is insufficient | Use targeted tests, invariants, mutation analysis, or independent analysis |
| Behavior changes because of unrelated formatting | False positive | Compare AST and semantic changes, not only text diff |
| Model claims behavior changed without evidence | Untrusted assertion | Require reproducible evidence |
| No reliable test input exists | Hard to prove mutation | Use static proof where possible; otherwise reject or mark low confidence |
| Challenge verification times out | Job remains uncertain | Mark as failed or pending review, never publish as verified |
| First verifier says valid, second says invalid | Inconsistent result | Reject by default and record the disagreement |
| Answer key line is outside function | Invalid grading target | Enforce source-span containment |
| User flags a nearby line | Line-level precision is limited | Use configurable line tolerance only if the exact relationship is proven; record exact and accepted lines |
| File changes after challenge creation | Review mismatch | Pin immutable repository version and verify the version at submission |
| Challenge data is cached in browser storage | Answer-key or source exposure | Do not include the key; limit sensitive client persistence |
| User inspects network responses | Any returned secret is exposed | Keep keys entirely server-side |
| User manipulates frontend score | Incorrect result display | Recalculate every score on the server |
| Challenge is served twice | Duplicate practice or replay | Allow intentional replay only with explicit versioning and audit history |

---

## 8. Review and grading edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| User flags every line | False alarms and gaming | Penalize false alarms and track precision |
| User flags no lines | Missed bugs | Record misses without treating the submission as invalid |
| User flags a correct bug but explanation is poor | Partial understanding | Separate catch score from explanation score |
| User explanation contains prompt injection | Model manipulation | Treat explanation as untrusted user data and delimit it |
| User submits empty explanation | Incomplete review | Allow it if desired, but score it as zero and record it |
| User submits huge explanation | Cost and abuse | Enforce length and token limits |
| User submits HTML or JavaScript | XSS risk | Escape output and sanitize rendered content |
| User submits duplicate flags | Score inflation | Deduplicate by line and review ID |
| User submits invalid line number | Tampering | Validate against the challenge source map |
| User submits after deadline | Policy ambiguity | Define deadlines and reject or label late submissions |
| User refreshes during submission | Duplicate request | Use idempotency keys |
| Network disconnects after submission | User retries and duplicates | Return a stable submission ID and support status lookup |
| User edits review after grading | Score inconsistency | Freeze submitted reviews and create a new version for reattempts |
| AI grader times out | User blocked | Queue retry and show pending status |
| AI grader gives a different score after retry | Non-determinism | Store model/version/prompt and support grading versioning |
| AI grading is biased | Fairness issue | Use rubric-based scoring, calibration sets, human review, and deterministic catch scoring |
| Explanation uses different terminology | AI may mark it wrong | Grade concepts and evidence, not exact wording |
| User identifies a valid alternative fix | Overly strict grading | Accept semantically equivalent explanations |
| User reports a pre-existing bug | Challenge confusion | Compare against the original baseline and label it separately |
| User reports an intentional design choice | False positive | Require evidence and display “possible” status |
| User shares answer externally | Cannot fully prevent cheating | Focus on learning analytics, randomized challenges, and immutable challenge versions |
| User uses another AI to answer | Product cannot detect perfectly | Use explanation consistency, follow-up questions, timing signals, and optional supervised modes |
| User memorizes challenge answers | Reduced learning value | Generate multiple verified variants and avoid repeats |
| User flags a line in context but not exact target | Precision issue | Support related-line evidence with explicit rules and separate scoring |

---

## 9. Real-bug detection edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| Reported issue is actually a style preference | False positive | Require a concrete failure condition or violated invariant |
| Reported issue depends on unseen code | Insufficient context | Inspect limited callers and callees, or mark uncertain |
| AI confirms an incorrect bug | Misleading feedback | Require tool-backed evidence and label unverified results |
| Bug is valid only under unusual inputs | Difficulty proving it | Store a triggering input or explicit assumption |
| Existing guard prevents the issue | False positive | Check callers, guards, validation, and control flow |
| Report involves external service behavior | Verification unavailable | Mark as “possible” and explain evidence limitations |
| User reports vulnerability in imported code | Security concern | Keep report scoped, protect details, and consider responsible disclosure guidance |
| User asks for whole-repository analysis | Cost and scope abuse | Limit reports to reviewed functions |
| Real bug overlaps planted bug | Grading ambiguity | Record both separately and avoid double-counting |
| Report contains secrets | Sensitive data exposure | Detect and redact secrets before storage or AI processing |

---

## 10. AI-specific edge cases

| Edge case | Limitation | Recommended solution |
|---|---|---|
| Model hallucinates a function | Incorrect challenge | Validate against the function inventory |
| Model hallucinates line numbers | Wrong grading | Derive line mappings from actual source and diff |
| Model follows instructions inside code comments | Prompt injection | Delimit repository content as untrusted data and use deterministic validation |
| Model returns malformed JSON | Job failure | Use schema validation, limited retries, and dead-letter handling |
| Model returns valid JSON with unsafe values | Security risk | Apply semantic validation and allowlists |
| Model becomes unavailable | Core feature stops | Use provider fallback, cached non-AI operations, and clear degraded states |
| Model returns inconsistent results | Unfair grading | Pin model versions and use deterministic grading for binary outcomes |
| Model gives overly confident result | User misled | Require confidence and evidence fields; reject unsupported certainty |
| Model exposes hidden prompt | Information leakage | Never return raw model responses to users |
| Model receives secrets | Third-party exposure | Scan and redact before model calls |
| Model receives too much repository context | High cost and leakage | Send only minimal function and relevant context |
| Model context window is exceeded | Truncated analysis | Limit function size and use structured context selection |
| Model output is biased by code style | Uneven grading | Calibrate with diverse examples and use concept-based rubrics |
| Model provider stores prompts | Privacy risk | Use no-retention settings where available and disclose provider handling |
| Provider changes model behavior | Score drift | Pin model versions and keep grading versions |
| Retry produces a different answer | Inconsistent result | Store first valid result or use deterministic adjudication |
| Prompt injection in user explanation | Grader manipulation | Treat explanation as quoted data and enforce rubric-only grading |
| AI-generated fix is unsafe | Misleading recommendation | Validate fixes and label them as suggestions, not authoritative patches |
| AI uses external tools unexpectedly | Data exposure | Restrict tools, network, and credentials |
| AI vendor quota is exhausted | Job failures | Track quotas, reserve capacity, and stop gracefully |

---

## 11. Security edge cases

| Edge case | Risk | Recommended solution |
|---|---|---|
| SSRF through repository URL | Internal network access | Host allowlist, redirect checks, IP blocking, DNS validation |
| Path traversal in repository paths | File disclosure | Canonicalize and verify every path stays inside the snapshot |
| Zip slip | Arbitrary file write | Safe extraction with normalized paths |
| Zip bomb | Resource exhaustion | Compression-ratio and expanded-size limits |
| Malicious package manifest | Code execution | Never install dependencies or run lifecycle scripts |
| Command injection through filename | Server compromise | Avoid shell commands; use argument arrays and strict validation |
| XSS in repository metadata | Browser compromise | Escape all displayed values |
| XSS in AI feedback | Browser compromise | Render feedback as text or sanitized Markdown |
| SQL injection | Database compromise | Parameterized queries and ORM safety checks |
| CSRF on state-changing endpoints | Unauthorized actions | SameSite cookies plus CSRF tokens |
| CORS allows arbitrary origins | Credential theft | Explicit origin allowlist |
| Answer key in frontend bundle | Challenge compromise | Keep key in server-only data paths |
| Answer key in API error | Challenge compromise | Use generic errors |
| Answer key in logs | Internal leakage | Redact and restrict log access |
| Secrets in source sent to AI | Credential exposure | Secret scanning and redaction |
| Secrets in object storage | Long-term exposure | Encryption, private access, retention controls |
| Insecure administrator actions | Privilege abuse | Separate admin roles, MFA, approvals, audit records |
| Worker has excessive permissions | Blast radius | Separate service accounts and least privilege |
| Compromised queue message | Unauthorized job | Sign or authenticate messages and verify ownership |
| Cache poisoning | Data disclosure | Authorization-aware keys and no sensitive shared caching |
| Dependency vulnerability | Supply-chain risk | Lockfiles, scanning, SBOM, update process |
| Container escape | Host compromise | Rootless containers, restricted syscalls, isolated runtime |
| Sandbox escape | Infrastructure compromise | Strong isolation, no network, no credentials, disposable environments |
| Log injection | Monitoring evasion | Structured logging and escaping control characters |
| Timing differences in login | Account enumeration | Uniform responses and controlled timing |
| Token in URL | Browser/history leakage | Use secure headers and POST bodies for sensitive operations |
| Backup contains answer keys | Long-term exposure | Encrypt backups and restrict restoration access |

---

## 12. Privacy and data-retention edge cases

| Edge case | Limitation | Recommended solution |
|---|---|---|
| User imports code containing personal data | Privacy exposure | Minimize data, scan for sensitive content, and provide deletion |
| Source is sent to an AI provider | Third-party processing | Disclose it, minimize payloads, use no-retention settings, and support opt-out where possible |
| User requests account deletion during retention period | Conflicting obligations | Define deletion and legal-retention policies clearly |
| Audit logs contain user source | Sensitive logs | Store references and hashes instead of full source |
| Backups retain deleted data | Deletion is delayed | Define backup expiry and document the delay |
| Shared sample repository is deleted | Other users affected | Keep system-owned samples separate from user-owned data |
| User exports data containing answer keys | Security issue | Export user-owned history without hidden answer keys unless policy allows it |
| Repository owner requests deletion | Imported copy remains | Track source repository and provide deletion request handling |
| Data is stored in another country | Regulatory concern | Choose regional storage and document subprocessors |
| AI provider changes data policy | Privacy drift | Review provider contracts and monitor policy changes |

---

## 13. Availability and operational edge cases

| Edge case | Limitation | Recommended solution |
|---|---|---|
| Queue backlog grows | Users wait too long | Autoscale workers, enforce quotas, and show estimated status |
| One user consumes all workers | Starvation | Per-user concurrency limits and fair scheduling |
| AI provider is slow | Jobs time out | Timeouts, circuit breakers, fallback provider, and pending status |
| Database connection pool exhausted | API outage | Pool limits, timeouts, read replicas where needed, and monitoring |
| Object storage is unavailable | Processing fails | Retry safe operations and keep job state durable |
| Worker crashes mid-job | Incomplete state | Heartbeats, leases, idempotency, and reconciliation |
| Deployment occurs during processing | Job interruption | Graceful shutdown and durable queue messages |
| Schema migration fails | Application outage | Backward-compatible migrations and rollback plans |
| Clock differences across services | Incorrect expiry or TOTP | NTP synchronization and server-side time |
| Metrics pipeline fails | Reduced visibility | Keep application operation independent from metrics delivery |
| Logs become too large | Storage cost and performance | Sampling, retention policies, and redaction |
| AI costs unexpectedly increase | Financial risk | Per-user budgets, per-job limits, alerts, and emergency disable switches |
| GitHub changes API behavior | Import failures | Versioned clients, contract tests, and feature flags |
| Security incident occurs | Evidence may be lost | Immutable audit logs, incident runbooks, and retention controls |

---

## 14. Scalability limitations

| Limitation | Cause | Solution |
|---|---|---|
| Large repositories take too long | Parsing and scanning cost | Shallow immutable snapshots, parallel parsing, folder selection, and limits |
| Call-graph construction is expensive | Static analysis complexity | Analyze only eligible files, cache parser artifacts, and use incremental processing |
| AI calls dominate cost | One or more calls per function | Batch safely where possible, use smaller models for classification, cache verified artifacts |
| PostgreSQL becomes write-heavy | Logs, grades, and events | Partition append-only tables, batch writes, and archive old data |
| Object storage grows rapidly | Source snapshots and artifacts | Deduplicate by content hash and apply lifecycle policies |
| Grading latency increases | Queue backlog or provider latency | Separate grading workers and use deterministic grading immediately |
| Search across repositories is slow | Large source corpus | Avoid full-text search initially; add a dedicated index only when needed |
| Monorepos exceed limits | Too many files/functions | Allow folder selection and incremental analysis |
| Many simultaneous rounds | AI and worker contention | Per-user and global quotas, priority queues, and autoscaling |
| Shared parser cache becomes unsafe | Tenant-sensitive data | Cache only immutable public artifacts with safe keys |

---

## 15. Product and learning limitations

| Limitation | Effect | Solution |
|---|---|---|
| Finding a planted bug does not prove full code understanding | Skill score may be incomplete | Combine line detection, explanation quality, follow-up questions, and repeated rounds |
| Users can use another AI | Assessment integrity is reduced | Add optional supervised mode, time limits, randomized variants, and explanation consistency checks |
| Static analysis misses runtime behavior | Incomplete function ranking | Use confidence scores and optional sandbox verification |
| AI grading can be subjective | Scores may vary | Use deterministic catch scoring, rubric-based grading, calibration, and versioned evaluators |
| Bug catalogue is limited | Repetitive challenges | Expand gradually with language-specific transformations |
| Challenge may not reflect production bugs | Training transfer is limited | Use real project context and track bug categories from actual code |
| Users may learn the mutation patterns | Challenges become predictable | Randomize transformations and avoid repeat patterns |
| Some code is too complex for a short round | Poor experience | Offer difficulty levels and context expansion |
| A correct explanation may use different terminology | Unfair grade | Score concepts, causal reasoning, and evidence instead of keywords |
| Skill profile can be noisy with few rounds | Misleading recommendations | Show confidence intervals or minimum sample counts |
| Repository coverage does not equal understanding | Misinterpreted metric | Label it as exposure/coverage, not mastery |
| Some bugs are design disagreements | False grading | Restrict challenges to objective defects and documented invariants |
| Code without tests is hard to verify | Challenge rejection | Use static checks and reject low-confidence mutations |
| Imported code may be obsolete | Training relevance decreases | Show commit date and let users refresh snapshots |
| Users may not own the repository | Legal or ethical issue | Start with public repositories and clear terms of use |
| Users may submit intentionally vulnerable code | Security risk | Never deploy or execute imported code outside isolation |
| Code style differs across repositories | Grading complexity | Use semantics and localized context rather than style rules |

---

## 16. Browser and frontend edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| Code contains HTML-like text | XSS | Render code as escaped text with safe syntax highlighting |
| AI feedback contains Markdown links | Phishing or XSS | Sanitize Markdown and restrict link protocols |
| Very large function freezes browser | Poor UX | Virtualize code rendering and enforce display limits |
| User loses network while reviewing | Lost work | Local draft storage without answer keys and server-side autosave |
| Local draft contains sensitive code | Shared-device exposure | Encrypt where feasible and allow clearing drafts |
| Browser back button exposes stale challenge | Information leakage | Use short-lived authorized data and avoid key data in history |
| Multiple tabs submit the same review | Duplicate results | Idempotency and review locking |
| Client clock is wrong | Deadline errors | Use server time |
| Accessibility tools cannot select code lines | Exclusion | Keyboard-accessible line selection and semantic labels |
| Mobile screen cannot display long code | Usability problem | Responsive code viewer and function segmentation |
| Syntax highlighting library has a vulnerability | XSS or supply chain | Pin, scan, sanitize, and prefer safe rendering |
| Browser extension reads source | Cannot fully prevent | Explain client-side exposure and minimize displayed content |

---

## 17. API and integration edge cases

| Edge case | Risk or limitation | Recommended solution |
|---|---|---|
| Client retries POST request | Duplicate import or submission | Require idempotency keys |
| Client sends unknown fields | Validation confusion | Reject or ignore explicitly according to API policy |
| Invalid pagination cursor | API error | Validate cursor and return a stable error |
| User requests excessive page size | DoS | Enforce maximum page size |
| API version changes | Client breakage | Version APIs and maintain compatibility windows |
| Job status is polled too frequently | Load amplification | Rate-limit polling and support backoff or server-sent updates |
| Client receives partial result | Misinterprets status | Use explicit state machine statuses |
| Error reveals parser internals | Information leakage | Use safe external messages and internal diagnostic IDs |
| Webhook is forged | Unauthorized updates | Verify signatures, timestamps, and replay protection |
| Webhook arrives out of order | Incorrect state | Use event versions and idempotent handlers |
| Third-party API returns malformed data | Worker failure | Validate external responses and handle schema changes |

---

## 18. Data-consistency edge cases

| Edge case | Risk | Recommended solution |
|---|---|---|
| Repository version is deleted while challenge exists | Broken review | Retain immutable challenge artifact until review retention expires |
| Challenge is published before verification completes | Unverified content reaches user | Publish only after a successful state transition |
| Grade is written twice | Incorrect score | Use unique constraints and idempotent grade jobs |
| Skill profile update partially fails | Incorrect progress | Use append-only skill events and recompute projections |
| Review submission succeeds but response is lost | Duplicate submission | Stable submission ID and status lookup |
| User starts two rounds against same function | Conflicting history | Permit with separate versions or enforce a cooldown |
| Source hash changes unexpectedly | Integrity failure | Mark challenge invalid and stop grading |
| Database and object storage disagree | Missing artifact | Use state machine, checksums, and reconciliation jobs |
| Job state says complete but artifact is missing | Broken UI | Verify artifact existence before marking complete |
| Delete operation races with processing | Data resurrection | Use tombstones, cancellation, and final deletion checks |
| Skill score is updated before grading is finalized | Premature progress | Update only from immutable final grade events |

---

## 19. Recommended state machines

### Repository import

```text
CREATED
  -> VALIDATING
  -> FETCHING
  -> SNAPSHOT_CREATED
  -> SCANNING
  -> PARSING
  -> ANALYZING
  -> READY
```

Failure states:

```text
FAILED_VALIDATION
FAILED_FETCH
REJECTED_SECURITY
FAILED_PARSING
CANCELLED
EXPIRED
```

### Challenge

```text
DRAFT
  -> GENERATING
  -> DIFF_CREATED
  -> PARSING_CHECK
  -> ANSWER_KEY_CHECK
  -> BEHAVIOR_CHECK
  -> INDEPENDENT_VERIFICATION
  -> VERIFIED
  -> PUBLISHED
```

Failure states:

```text
REJECTED
VERIFICATION_CONFLICT
TIMEOUT
QUARANTINED
```

### Review

```text
OPEN
  -> DRAFT
  -> SUBMITTED
  -> GRADING
  -> GRADED
  -> FINALIZED
```

Failure states:

```text
EXPIRED
CANCELLED
GRADING_FAILED
```

Do not allow invalid state transitions from the client.

---

## 20. Best default policies

For the first production-capable version:

1. Support public GitHub repositories only.
2. Support one pinned commit per import.
3. Do not install dependencies.
4. Do not execute repository code unless sandboxing is fully implemented.
5. Use static parsing and controlled transformations first.
6. Allow only a small, language-specific bug catalogue.
7. Keep answer keys in a server-only database schema or separate encrypted store.
8. Use deterministic line-based catch scoring.
9. Use AI only for explanations and semantic verification.
10. Reject uncertain challenges instead of showing questionable ones.
11. Limit repository size and processing time.
12. Exclude generated code, dependencies, binaries, tests, and configuration secrets.
13. Use PostgreSQL with RLS.
14. Use background workers for all expensive tasks.
15. Add idempotency to imports, challenge generation, submissions, and grading.
16. Log security events without logging source or answer keys.
17. Version parser, prompt, model, bug transformation, and grading rules.
18. Keep an immutable audit trail for challenge and score decisions.
19. Show confidence and limitations to users.
20. Never describe repository coverage as proof of mastery.

---

## 21. MVP limitations that should be disclosed to users

CodeWiz should clearly state:

- Static analysis cannot fully understand dynamic language behavior.
- Call-graph results are approximate.
- Some repositories cannot be analyzed because of unsupported syntax or size.
- AI-generated explanations and feedback may be imperfect.
- Only verified challenges are shown, but verification is not a mathematical proof in every case.
- A user’s score measures performance on selected challenges, not complete programming ability.
- Repository coverage measures reviewed code, not total understanding.
- Real-bug reports may be labeled “possible” when complete evidence is unavailable.
- Imported code is analyzed at a specific commit and may differ from the current repository.
- External AI processing, if used, must be disclosed.
- Some dependencies, runtime behavior, and external services may not be available for verification.

---

## 22. Priority order for solving limitations

### Critical before launch

- Tenant isolation
- Answer-key protection
- SSRF protection
- Repository size and archive limits
- No unsafe code execution
- Secure authentication and MFA
- Deterministic diff and line validation
- AI output schema validation
- Rate limiting
- Audit logging
- Idempotent jobs and submissions
- Secret redaction

### High priority

- Immutable repository snapshots
- Parser confidence scoring
- Challenge versioning
- Queue dead-letter handling
- Provider timeout and fallback behavior
- Sandbox implementation
- Data deletion
- Backup and restore testing
- Security monitoring

### Medium priority

- Incremental parsing
- Better dynamic-language analysis
- More bug categories
- Human review for ambiguous challenges
- Advanced cheating detection
- Job-focused rounds
- Advanced coverage analytics

### Later improvements

- Private repository support
- More languages
- Runtime instrumentation
- Organization accounts
- Team dashboards
- Custom bug catalogues
- Enterprise SSO
- Regional processing
- Advanced adaptive learning

---

## 23. Final design rule

When CodeWiz cannot confidently prove that a challenge is valid, it should not serve that challenge.

A rejected or delayed challenge is better than:

- A false bug
- An incorrect answer key
- An unfair grade
- A leaked repository
- An exposed secret
- A compromised worker
- A misleading skill profile
