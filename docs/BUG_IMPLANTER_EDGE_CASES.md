# CodeWiz — Module-Wise Bug-Implanter Edge Cases

This document focuses specifically on the **bug implantation module**: selecting a function, applying a realistic defect, generating the answer key, verifying the mutation, and serving the challenge fairly.

---

## 1. Bug-implantation pipeline

```text
Original Function
      ↓
Eligibility Check
      ↓
Bug-Type Selection
      ↓
Mutation Generation
      ↓
Patch Application
      ↓
Syntax Validation
      ↓
Diff Validation
      ↓
Semantic/Behavior Verification
      ↓
Answer-Key Validation
      ↓
Difficulty Validation
      ↓
Challenge Published
```

A challenge must be rejected if any stage produces an uncertain result.

---

# 2. Function eligibility module

Before planting a bug, the system should determine whether the selected function is safe and suitable.

| Edge case | Problem | Solution |
|---|---|---|
| Function is too short | A mutation may be obvious or impossible | Skip functions below a minimum size |
| Function is extremely long | Review becomes overwhelming | Set a maximum size or create a focused slice with enough context |
| Function contains no conditional logic | Many bug types cannot apply | Restrict the eligible bug catalogue |
| Function contains only a return statement | No meaningful challenge | Skip trivial functions |
| Function is already syntactically invalid | Baseline is unreliable | Reject the function |
| Function already contains an obvious bug | The planted bug cannot be isolated | Run baseline analysis and exclude suspicious functions |
| Function is generated code | Mutation has little educational value | Exclude generated files |
| Function is a test | User may focus on test behavior rather than application logic | Exclude tests by default |
| Function is a migration or deployment script | Mutation may be dangerous | Exclude infrastructure and migration code |
| Function contains credentials or secrets | Challenge could expose sensitive information | Scan and reject or redact |
| Function handles authentication or authorization | A mutation could create a dangerous security flaw | Exclude security-critical functions from normal challenges |
| Function contains payment or financial logic | Incorrect mutation may be unsafe | Exclude or require special review |
| Function calls unavailable external services | Behavior cannot be verified | Use mocks or skip the function |
| Function depends on global state | Mutation effects may be unclear | Require stronger verification or skip |
| Function uses reflection or dynamic dispatch | Static analysis is uncertain | Mark low confidence or exclude |
| Function is recursive | Mutation may cause infinite recursion | Apply recursion-safe transformations and strict sandbox limits |
| Function has multiple nested functions | Line ownership may be ambiguous | Store exact AST ranges and reject overlapping mutation targets |
| Function has decorators or annotations | Boundary mapping may be incorrect | Include decorators in source metadata and verify the AST |
| Function contains multiple languages or embedded templates | Parser may misinterpret code | Use language-aware parsers and skip unsupported embedded regions |
| Function is duplicated elsewhere | User may confuse the target | Show file path, symbol, and unique source context |
| Function has been selected previously | Repetition reduces learning value | Track function and bug-type history |
| Function has too little surrounding context | User cannot reasonably identify the bug | Include minimal safe context or skip it |

### Eligibility record

Store:

```json
{
  "function_id": "fn_123",
  "repository_version_id": "repo_ver_456",
  "language": "python",
  "start_line": 20,
  "end_line": 48,
  "source_hash": "sha256:...",
  "complexity_score": 7,
  "eligible_bug_types": [
    "wrong_condition",
    "missing_null_check"
  ],
  "excluded_reasons": [],
  "confidence": 0.91
}
```

---

# 3. Bug-type selection module

The bug catalogue should be language-aware and context-aware.

## Supported bug types

Start with a small catalogue:

- Wrong comparison operator
- Off-by-one boundary
- Wrong Boolean operator
- Wrong variable
- Missing null or `None` check
- Wrong return value
- Missing error handling
- Swallowed exception
- Incorrect async usage
- Mutable default argument in Python
- Incorrect collection access
- Incorrect sorting direction
- Missing validation
- Incorrect state update

Do not apply every bug type to every language.

| Edge case | Problem | Solution |
|---|---|---|
| Bug type is invalid for the language | Invalid or meaningless mutation | Maintain a language-specific compatibility matrix |
| Bug type is invalid for the function structure | Transformation cannot be applied safely | Check AST preconditions before selection |
| Same bug type appears repeatedly | Challenges become predictable | Enforce per-user and per-function diversity |
| Bug type is too easy | Poor learning value | Add difficulty thresholds and mutation scoring |
| Bug type is too subtle | User cannot reasonably find it | Require a reproducible explanation and minimum observability |
| Bug type changes security behavior | Unsafe result | Block security-sensitive mutation categories |
| Bug type requires runtime context | Static verification is difficult | Use sandbox testing or do not apply it |
| Bug type depends on a specific input | User may not know the trigger | Include enough context and store the triggering condition |
| Bug type overlaps with an existing defect | Attribution becomes ambiguous | Compare baseline and mutated behavior |
| Bug type creates multiple defects | Answer key becomes unclear | Limit the mutation to one conceptual defect |
| Bug type is intentional project behavior | False bug | Check local comments, invariants, tests, and surrounding logic |
| Bug type is already present elsewhere | Pattern may make answer obvious | Avoid repeated local patterns when possible |
| Bug type changes performance only | Hard to observe in review | Use only if measurable and explicitly supported |

### Bug-type compatibility example

| Bug type | Python | JavaScript | TypeScript |
|---|---:|---:|---:|
| Off-by-one | Yes | Yes | Yes |
| Wrong condition | Yes | Yes | Yes |
| Missing null check | Yes | Yes | Yes |
| Mutable default argument | Yes | No | No |
| Async mistake | Yes | Yes | Yes |
| Swallowed exception | Yes | Yes | Yes |
| Wrong return value | Yes | Yes | Yes |
| Type-only mutation | No | No | Yes, with caution |

---

# 4. Mutation generation module

There are two safer approaches.

## Preferred approach: AST-based mutation

Use the parser to modify syntax nodes rather than asking the model to rewrite raw code.

Examples:

```text
x < y  →  x <= y
index < length  →  index <= length
if value is None  →  if value is not None
return result  →  return fallback
a and b  →  a or b
```

## AI-assisted approach

The model may suggest a mutation, but the backend must:

1. Validate the response against a schema.
2. Confirm the target function exists.
3. Confirm the target syntax node exists.
4. Apply the mutation using server-side code.
5. Derive the final diff itself.
6. Never trust AI-provided line numbers directly.

| Edge case | Problem | Solution |
|---|---|---|
| Model returns a rewritten full file | Uncontrolled changes | Accept structured mutation instructions only |
| Model changes code outside the target function | Scope violation | Reject if the diff leaves the target span |
| Model changes formatting everywhere | Noisy diff | Reject or normalize only if semantic scope remains exact |
| Model returns invalid JSON | Pipeline failure | Retry once with schema enforcement, then quarantine |
| Model returns a valid but unsupported operation | Unsafe mutation | Use an allowlist of mutation operators |
| Model changes comments only | No actual bug | Reject |
| Model changes a string literal unintentionally | Behavior may change unpredictably | Validate AST node type and mutation category |
| Model changes an identifier that is shadowed | Unexpected semantics | Resolve scope before applying |
| Model changes a reserved keyword | Syntax error | Parse after mutation and reject |
| Model modifies indentation | Syntax or scope failure | Use AST or token-aware edits |
| Model modifies multiple functions | Multiple answer targets | Reject |
| Model changes imports | Hidden dependency behavior | Do not allow import changes in normal challenges |
| Model adds an external call | Security and verification risk | Reject new network, process, or filesystem operations |
| Model introduces an infinite loop | Resource exhaustion | Static checks and sandbox limits |
| Model introduces a secret or token | Data exposure | Scan mutated code before storage |
| Model makes a mutation that has no effect | Fake challenge | Run semantic verification |
| Model applies a bug not represented in the answer key | Incorrect grading | Generate the answer key from the actual patch |
| Same mutation is generated twice | Repetition | Deduplicate using mutation fingerprints |

---

# 5. Mutation precondition module

Every mutation operator should define preconditions.

## Example: off-by-one mutation

Valid only when:

- A comparison contains an integer boundary.
- The comparison is part of a loop or index condition.
- The changed operator remains syntactically valid.
- The target is not already using the mutated operator.
- The function has a plausible boundary condition.

Invalid when:

- The comparison is a security permission check.
- The values are floating-point values with unclear semantics.
- The comparison is part of a deliberate inclusive range.
- The mutation changes multiple control-flow branches.

## Example: missing null check

Valid only when:

- A value can plausibly be null or undefined.
- The value is dereferenced or accessed.
- The code has no existing guard.
- The mutation can be applied without introducing unrelated changes.

Invalid when:

- The type system guarantees non-null.
- A caller always validates the value.
- The function intentionally throws on null.
- The resulting behavior cannot be demonstrated.

## Example: wrong return value

Valid only when:

- There are multiple compatible values in scope.
- The replacement changes the function’s result.
- The returned value has a meaningful relationship to the function’s purpose.

Invalid when:

- The replacement causes an immediate type error.
- The function intentionally returns a constant.
- The return value is not used or observable.

---

# 6. Diff and scope validation module

The system should derive a patch and validate it mechanically.

| Edge case | Problem | Solution |
|---|---|---|
| Changed line is outside function | Wrong challenge target | Reject |
| Function moved due to formatting | Line mappings become unstable | Compare AST identity and source hashes |
| Multiple hunks are created | Mutation may be too broad | Restrict to one focused hunk where possible |
| Whitespace changes hide a mutation | Review becomes noisy | Normalize or reject unnecessary formatting changes |
| Comment changes accompany code changes | Answer key ambiguity | Reject unrelated comment changes |
| New file is created | Scope violation | Reject |
| Existing file is deleted | Scope violation | Reject |
| Import is added | Hidden dependency | Reject |
| Line numbers shift after mutation | Answer key becomes stale | Calculate line ranges from the final mutated source |
| CRLF changes to LF | Entire file appears changed | Normalize line endings before diffing |
| Unicode normalization changes | Large unintended diff | Preserve encoding and normalize safely |
| Patch applies to multiple locations | Ambiguous mutation | Require one exact target node |
| Target function is duplicated | Wrong occurrence changed | Use file path, AST range, and source hash |
| Original source changed during generation | Challenge mismatch | Pin repository version and verify source hash |

### Required patch checks

```text
Original source hash matches stored hash
Modified code parses
Modified function exists
Only intended function changed
Only approved syntax nodes changed
Changed lines match answer-key lines
No imports changed
No secrets introduced
No dangerous operations introduced
No unrelated formatting changed
```

---

# 7. Syntax-validation module

A mutated challenge must remain syntactically valid unless the product explicitly supports syntax-error detection.

| Edge case | Problem | Solution |
|---|---|---|
| Missing bracket | Challenge cannot run or parse | Reject |
| Incorrect indentation | Python parse failure | Reject |
| Invalid TypeScript syntax | Parser failure | Reject |
| JSX parser mismatch | False rejection | Parse using correct file mode |
| Mutation breaks a string | Invalid source | Reject |
| Mutation breaks a template literal | Parser failure | Reject |
| Mutation changes comment delimiters | Code structure changes unexpectedly | Reject |
| Parser accepts code but compiler rejects it | Runtime/build failure | Run optional type or compile checks |
| Code is syntactically valid but semantically invalid | User sees an obvious error rather than a subtle bug | Require semantic checks |
| Parser versions differ | Inconsistent results | Pin parser versions and record them |

---

# 8. Semantic verification module

Syntax validation is not enough. The system must determine whether the mutation creates a real defect.

## Verification layers

```text
Layer 1: AST validation
Layer 2: Diff validation
Layer 3: Static data-flow checks
Layer 4: Targeted test or sandbox execution
Layer 5: Independent AI review
Layer 6: Difficulty and ambiguity checks
```

| Edge case | Problem | Solution |
|---|---|---|
| Mutated output is identical for all relevant inputs | No real bug | Reject |
| Mutation changes output only for impossible inputs | Unfair challenge | Prove input reachability or reject |
| Mutation changes output only under undefined behavior | Unclear defect | Reject |
| Mutation changes performance but not output | Hard to detect | Support only with explicit performance evidence |
| Mutation changes exception type only | May be intentional | Require a documented invariant |
| Mutation affects an external API | Cannot verify reliably | Mock the boundary or reject |
| Mutation causes nondeterministic results | Unstable grading | Reject or use deterministic fixtures |
| Function depends on time | Results vary | Freeze time in sandbox or avoid |
| Function depends on randomness | Results vary | Seed randomness or avoid |
| Function depends on environment variables | Environment mismatch | Use controlled environment or static verification |
| Function accesses filesystem | Isolation and fixture issues | Use temporary read-only fixtures |
| Function accesses network | Security and availability risk | Block network and mock calls |
| Function uses database | External state unavailable | Mock database behavior or avoid execution |
| Mutation is masked by downstream logic | No observable behavior difference | Trace data flow and reject if unobservable |
| Mutation causes an error earlier than the intended defect | Wrong explanation | Verify the intended defect is the first meaningful failure |
| Existing tests do not cover the mutation | Verification gap | Generate targeted cases or use static proof |
| Tests are flaky | Unreliable challenge | Run multiple times or reject |
| Test suite is too expensive | Cost and timeout | Run only targeted tests inside limits |

---

# 9. Test-case generation edge cases

If the system generates inputs to prove the bug:

| Edge case | Problem | Solution |
|---|---|---|
| Generated input violates function preconditions | False proof | Validate preconditions before execution |
| Input contains malicious payload | Sandbox risk | Use safe serialized values and strict limits |
| Input is too large | Resource exhaustion | Set size limits |
| Input causes infinite recursion | Worker exhaustion | Enforce execution time and recursion limits |
| Input produces nondeterministic output | Unstable evidence | Seed randomness and freeze time |
| Input triggers an unrelated existing bug | Wrong attribution | Compare original and mutated versions on the same input |
| No distinguishing input is found | Bug may not be observable | Reject or mark unverified |
| Generated input leaks source or secrets in logs | Privacy risk | Redact or hash inputs in logs |
| Input depends on external data | Reproducibility failure | Mock external dependencies |
| Input exposes a production-side effect | Safety risk | Use mocks and block network/filesystem writes |

The strongest verification pattern is:

```text
Run original function with input X
Run mutated function with input X
Compare result, exception, state, or invariant
Confirm the difference is caused by the intended mutation
```

---

# 10. Answer-key generation module

The answer key must be generated from the final patch, not copied blindly from the model.

Required fields:

```json
{
  "bug_type": "off_by_one",
  "target_file": "src/parser.py",
  "function_id": "fn_123",
  "changed_lines": [31],
  "changed_columns": [[12, 13]],
  "original_expression": "i < len(items)",
  "mutated_expression": "i <= len(items)",
  "why_it_is_wrong": "The inclusive boundary allows i to equal len(items), causing an out-of-range access.",
  "triggering_condition": "The loop reaches i == len(items).",
  "expected_fix": "Use the exclusive upper-bound comparison.",
  "evidence": {
    "verification_type": "targeted_execution",
    "input_reference": "fixture_789",
    "original_result": "completed",
    "mutated_result": "IndexError"
  }
}
```

| Edge case | Problem | Solution |
|---|---|---|
| Answer key points to original line numbers after edits | Wrong grading | Calculate lines after mutation |
| Explanation describes a different bug | Inconsistent grading | Validate explanation against diff and bug type |
| Fix does not restore original behavior | Bad feedback | Test the proposed fix where practical |
| Answer key includes too much source | Source exposure | Store full data privately but return minimal feedback |
| Answer key is accidentally included in API response | Challenge compromise | Use server-only schemas and response tests |
| Answer key is present in logs | Internal leak | Redact answer-key content |
| Multiple valid fixes exist | Strict grading may be unfair | Accept equivalent fixes and grade causal understanding |
| Bug has multiple triggering conditions | Incomplete explanation | Store representative conditions and required concept |
| Answer key is too vague | AI grading inconsistency | Require exact line, mechanism, impact, and fix |
| Key is generated before final patch | Mismatch | Generate it after patch application and validation |

---

# 11. Difficulty calibration module

A valid bug can still be a poor challenge.

## Difficulty factors

- Size of function
- Amount of surrounding context
- Number of changed tokens
- Visibility of the defect
- Required domain knowledge
- Number of possible interpretations
- Triggering-input complexity
- Number of callers
- Availability of type information
- Whether the defect is local or cross-function

| Edge case | Problem | Solution |
|---|---|---|
| Bug is visible instantly | Too easy | Increase context or use a less obvious valid mutation |
| Bug requires unrelated files | Unfair | Include necessary context or reject |
| Bug requires framework knowledge | Inaccessible | Add framework-aware metadata or avoid |
| Bug is ambiguous | Multiple reasonable answers | Reject or require human review |
| Bug is too difficult for the user level | Frustration | Use difficulty tiers |
| Function has too many possible defects | User cannot isolate target | Limit mutation scope and provide exact function context |
| Mutation is easy because of formatting | Not measuring understanding | Normalize presentation and avoid cosmetic clues |
| Bug pattern repeats | Memorization | Randomize operators and avoid duplicate mutations |
| Changed code looks suspicious visually | User may spot formatting rather than understand behavior | Keep formatting unchanged |

### Suggested levels

```text
Beginner:
- Local condition
- One changed token
- Clear input/output relationship

Intermediate:
- Data-flow issue
- Missing guard
- Error-handling path

Advanced:
- Async behavior
- State mutation
- Caller/callee interaction
- Framework-specific behavior
```

---

# 12. Language-specific edge cases

## Python

| Edge case | Solution |
|---|---|
| Mutable default argument | Apply only to functions with mutable defaults and explain persistent state |
| `None` versus falsey values | Distinguish `is None` from truthiness |
| Exception hierarchy | Do not replace a specific exception with a broad one without verifying impact |
| Generator laziness | Verify execution timing and consumption behavior |
| Context managers | Avoid mutations that leave resources unclosed |
| Decorators | Preserve decorator boundaries |
| Async coroutine not awaited | Use async-aware static checks or controlled execution |
| Mutable global state | Avoid nondeterministic mutation |
| `try/except` swallowing errors | Confirm the exception is meaningful and should not be hidden |
| List slicing boundaries | Generate inputs that distinguish inclusive and exclusive ranges |
| Duck typing | Avoid relying only on type annotations |

## JavaScript

| Edge case | Solution |
|---|---|
| `==` versus `===` | Verify coercion behavior with controlled values |
| `undefined` versus `null` | Test both explicitly |
| Truthy empty arrays and objects | Use language-aware test inputs |
| Promise not awaited | Verify ordering and error propagation |
| `map` versus `forEach` | Confirm return-value behavior |
| Mutable object references | Check aliasing and state changes |
| `this` binding | Avoid mutations where execution context is unavailable |
| Event-loop timing | Use deterministic mocks |
| Optional chaining | Verify nullish behavior |
| `NaN` comparisons | Include numeric edge cases |
| Closure capture | Test loop-variable behavior carefully |

## TypeScript

| Edge case | Solution |
|---|---|
| Type-only guarantees | Do not claim runtime safety from types alone |
| Non-null assertion `!` | Verify runtime values |
| Union narrowing | Check whether the guard is valid |
| `any` values | Treat as uncertain and require runtime evidence |
| Compiler configuration | Record relevant strictness settings |
| Enum behavior | Verify generated runtime representation |
| Generic constraints | Avoid mutations that only affect compile-time types unless supported |
| Optional properties | Test undefined behavior explicitly |
| TSX parsing | Use the correct parser mode |

---

# 13. State and side-effect edge cases

| Edge case | Problem | Solution |
|---|---|---|
| Function mutates global state | Repeated tests interfere | Reset state for every run |
| Function mutates input objects | Original and mutated runs share state | Deep-copy inputs where safe |
| Function writes files | Persistent side effects | Use temporary isolated directories |
| Function sends network requests | Data exfiltration | Block network and mock calls |
| Function uses a database | State leaks between tests | Use transaction rollback or mocks |
| Function reads current time | Non-repeatable result | Freeze time |
| Function uses random numbers | Different results | Seed randomness |
| Function relies on process environment | Different worker behavior | Provide a fixed environment |
| Function uses threads | Race conditions | Avoid or enforce strict limits |
| Function uses subprocesses | Code execution risk | Block subprocesses unless explicitly sandboxed |
| Function caches values globally | Test order affects outcome | Reset module state between runs |
| Function uses singleton services | Cross-test contamination | Reinitialize dependencies |
| Function causes an infinite loop | Worker exhaustion | Hard timeout and process termination |

---

# 14. Safety-sensitive mutation edge cases

Some functions should not be mutated automatically.

Exclude or separately review functions involving:

- Authentication
- Authorization
- Password reset
- MFA
- Encryption
- Key management
- Payment processing
- Financial calculations
- Medical decisions
- Data deletion
- Infrastructure provisioning
- Deployment
- Access-control policy
- File upload validation
- Security monitoring
- Audit-log integrity

| Edge case | Problem | Solution |
|---|---|---|
| Mutation disables authorization | Could teach or introduce a serious vulnerability | Block |
| Mutation weakens password validation | Security harm | Block |
| Mutation changes encryption parameters | Dangerous and misleading | Block |
| Mutation deletes data | Destructive behavior | Block |
| Mutation changes payment amount | Financial risk | Block |
| Mutation modifies audit logging | Evidence integrity risk | Block |
| Mutation creates an exploitable endpoint | Unsafe code | Block |
| Security function is educationally important | Cannot use normal mutation | Create a separate reviewed security-training mode with safe fixtures |

---

# 15. Duplicate and replay edge cases

| Edge case | Problem | Solution |
|---|---|---|
| Same function and same bug type selected again | Repetitive challenge | Store mutation fingerprint |
| Same user receives identical challenge | Answer memorization | Generate controlled variants |
| Different users receive identical challenge | Sharing answers | Use challenge variants while preserving verification |
| User refreshes challenge | Duplicate history | Preserve challenge ID and state |
| User starts several rounds concurrently | Conflicting coverage | Allow with explicit round IDs or limit concurrent rounds |
| Challenge is replayed after repository refresh | Source mismatch | Tie challenge to immutable repository version |
| User submits an old challenge | Stale grading | Validate challenge status and version |
| Mutation fingerprint collides | False duplicate | Include repository version, function hash, bug type, and patch hash |

Example mutation fingerprint:

```text
SHA-256(
  repository_commit_sha +
  function_source_hash +
  bug_type +
  normalized_original_expression +
  normalized_mutated_expression
)
```

---

# 16. Failure and recovery cases

| Failure | Required behavior |
|---|---|
| AI request times out | Retry safely, then mark generation as failed or pending review |
| Parser crashes | Isolate the file, record the error, and continue if safe |
| Diff validation fails | Reject the challenge |
| Semantic verifier disagrees | Reject or quarantine |
| Object storage fails | Do not mark challenge ready |
| Database transaction fails | Roll back challenge publication |
| Worker crashes after mutation | Resume using job idempotency or clean up temporary artifacts |
| User deletes account during generation | Cancel job and remove access |
| Repository snapshot is unavailable | Mark challenge invalid and do not serve it |
| Model provider is unavailable | Use fallback or temporarily disable generation |
| Verification takes too long | Enforce a maximum duration and reject uncertain challenges |
| Answer key cannot be stored securely | Do not publish the challenge |
| Challenge was published due to a state bug | Immediately revoke it and invalidate related results |

---

# 17. Minimum acceptance criteria for one planted bug

A mutation is publishable only when all criteria pass:

```text
[ ] Target function was eligible
[ ] Bug type is valid for the language
[ ] Original source hash matches
[ ] Mutation uses an approved operator
[ ] Only the intended function changed
[ ] No import or dependency changed
[ ] Modified code parses
[ ] Function boundaries remain valid
[ ] The mutation changes behavior or violates a verified invariant
[ ] A reproducible trigger or proof exists
[ ] The answer key matches the actual diff
[ ] The proposed fix is valid or clearly labeled
[ ] No secret was introduced or exposed
[ ] No dangerous operation was introduced
[ ] Difficulty is appropriate
[ ] Independent verification passed
[ ] Challenge has an immutable version
[ ] User-facing response excludes the answer key
```

---

# 18. Recommended bug-implanter design

```text
BugCatalogue
  ├── language compatibility
  ├── preconditions
  ├── AST transformation
  ├── expected defect class
  ├── verification strategy
  ├── difficulty rules
  ├── safety restrictions
  └── answer-key template

MutationPlanner
  ├── selects eligible function
  ├── selects allowed bug type
  ├── checks history and duplicates
  └── creates mutation plan

MutationApplier
  ├── applies AST/token edit
  ├── generates final source
  └── calculates actual diff

MutationValidator
  ├── syntax validation
  ├── scope validation
  ├── AST validation
  ├── secret scan
  └── dangerous-operation scan

BehaviorVerifier
  ├── static checks
  ├── targeted fixtures
  ├── sandbox execution
  └── invariant comparison

AnswerKeyBuilder
  ├── reads actual diff
  ├── identifies target lines
  ├── stores explanation and fix
  └── records evidence

ChallengeGate
  ├── evaluates all checks
  ├── rejects uncertain mutations
  ├── stores immutable artifacts
  └── publishes safe challenge data only
```

---

# 19. Most important product limitation

The bug implanter cannot guarantee that every code mutation represents a meaningful real-world bug, especially when the code depends on:

- External services
- Dynamic language behavior
- Runtime configuration
- Hidden framework behavior
- Database state
- Time
- Randomness
- Concurrency
- Unavailable dependencies
- Implicit business rules

The correct product behavior is:

```text
Verified mutation → publish
Uncertain mutation → quarantine
Invalid mutation → reject
```

Never convert uncertainty into a confident challenge.
