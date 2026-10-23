You are a principal software architect and senior backend engineer. Design a secure, scalable, observable, and cost-efficient system for CodeViva.

CodeViva is an AI-powered code-understanding trainer. It imports a public GitHub repository, parses important functions, creates controlled code challenges by planting realistic bugs, verifies every challenge using deterministic checks, asks the user to identify and explain the bugs, grades the review, and updates the user’s skill profile.

The design must prioritize:

1. Security
2. Correctness
3. Answer-key confidentiality
4. Tenant isolation
5. Deterministic verification
6. Reliability
7. Cost control
8. Auditability
9. Maintainability
10. Clear separation between synchronous APIs and asynchronous processing

Do not assume that the existing implementation is correct. Clearly separate implemented functionality from proposed architecture.

---

# 1. Product capabilities

The system must support:

- Account registration and login
- Email/password authentication
- TOTP-based two-factor authentication
- Session management and account recovery
- Public GitHub repository import
- Repository validation and safety scanning
- Support for Python, JavaScript, and TypeScript
- Function and method extraction with exact source locations
- Approximate call-graph construction
- Function importance ranking
- Selection of functions for a practice round
- Controlled bug planting
- Hidden answer-key generation
- Deterministic challenge verification
- AI-assisted semantic verification
- Code review with line-level flags
- User explanations for suspected bugs
- Explanation grading from 0 to 2
- Real-bug reports for non-planted issues
- Skill profiles by bug type
- Repository coverage tracking
- Round history
- Usage limits and AI-cost tracking
- Security and audit events
- Administrative monitoring

The default round contains 3 functions. The system may support rounds of 5 or 10 functions.

---

# 2. Core design principle

AI output is untrusted input.

The architecture must never assume that a model-generated:

- Function boundary
- Bug
- Line number
- Explanation
- Fix
- Verification result
- Grade
- Real-bug report

is correct without validation.

Use deterministic code wherever possible. Use AI only where semantic reasoning is necessary. Every AI output must pass strict schema validation, authorization checks, consistency checks, and safety checks.

The system must reject any challenge that cannot be verified confidently.

---

# 3. Required architecture style

Recommend a practical architecture for an early-stage hackathon product that can evolve into production.

Compare these options:

1. Modular monolith with background workers
2. Microservices
3. Serverless workflow
4. Containerized service architecture

Select one as the recommended starting architecture and explain:

- Why it fits CodeViva
- What should remain in one deployable unit
- What should be isolated immediately
- What can be extracted later
- Operational complexity
- Estimated cost and scaling characteristics
- Migration path

Prefer a modular monolith plus workers unless there is a strong reason to use microservices.

Use clear modules or services for:

- Identity and access management
- Repository import
- Repository safety scanning
- Source parsing
- Function inventory
- Call-graph analysis
- Importance ranking
- Challenge generation
- Challenge verification
- Review submission
- Grading
- Skill-profile calculation
- Usage metering
- Audit logging
- Administrative operations

---

# 4. High-level system components

Design the following components:

## Client applications

- Web frontend
- Optional administrator console

The client must never receive:

- Answer keys
- Hidden prompts
- Internal verification details that reveal the planted bug
- Provider API keys
- Private system metadata
- Unnecessary repository contents

## API layer

Responsibilities:

- Authentication
- Request validation
- Authorization
- Rate limiting
- Idempotency handling
- API versioning
- Request correlation IDs
- Synchronous read operations
- Creation of asynchronous jobs

The API must not perform long-running repository imports, parsing, challenge generation, or grading inside normal web requests.

## Relational database

Use a relational database such as PostgreSQL for:

- Users
- Sessions
- MFA configuration
- Repositories
- Repository versions
- Files and functions
- Challenges
- Answer keys
- Reviews
- Grades
- Skill profiles
- Usage records
- Audit events

Explain why relational storage is suitable.

## Object storage

Use private object storage for:

- Repository snapshots
- Source archives
- Parsed artifacts
- Challenge artifacts
- Verification reports
- Large logs or evidence

Requirements:

- Private buckets
- Server-side encryption
- Short-lived signed URLs
- Lifecycle deletion
- No public object access
- Tenant-aware object paths
- Malware and content checks before processing

## Queue and worker system

Use a queue or workflow engine for:

- Repository import
- Repository scanning
- Parsing
- Call-graph analysis
- Candidate ranking
- Challenge generation
- Challenge verification
- AI grading
- Skill-profile updates
- Cleanup

Define:

- Queue names
- Job payloads
- Retry policy
- Dead-letter queues
- Visibility timeout
- Idempotency keys
- Job state transitions
- Cancellation behavior
- Maximum job duration
- Per-user concurrency limits

## AI gateway

Create one internal AI gateway instead of calling providers from business modules.

The AI gateway must provide:

- Provider abstraction
- Model selection
- Structured output validation
- Token and cost accounting
- Timeouts
- Retries
- Circuit breakers
- Request quotas
- Prompt versioning
- Model version tracking
- Redaction
- Safety filtering
- Fallback behavior
- Audit metadata without storing sensitive content unnecessarily

---

# 5. Trust boundaries

Describe all trust boundaries, including:

1. Browser to API
2. API to database
3. API to object storage
4. API to queue
5. Worker to GitHub
6. Worker to repository content
7. Worker to parser
8. Worker to AI provider
9. AI provider to application
10. Application to sandbox
11. User content to grading pipeline
12. Administrator to administrative APIs

For every boundary, specify:

- What data crosses it
- Authentication method
- Authorization requirement
- Validation requirement
- Encryption requirement
- Logging requirement
- Failure behavior

Treat all repository content as hostile, including:

- Source code
- Comments
- README files
- Filenames
- Package manifests
- Git metadata
- Configuration files
- Issue text
- Documentation
- Test fixtures
- Generated files

---

# 6. End-to-end workflows

Design detailed sequence flows for the following.

## A. User registration and MFA

Include:

- Registration
- Email verification
- Password hashing
- Login
- TOTP enrollment
- Recovery codes
- Session creation
- Session revocation
- Failed-attempt handling
- Account lockout or progressive delays
- Device and session management

## B. Repository import

Flow:

1. User submits a repository URL.
2. API validates the URL and authorization.
3. System creates an idempotent import job.
4. Worker fetches the permitted GitHub repository.
5. System pins a commit SHA.
6. Repository size and file limits are enforced.
7. Files are scanned and filtered.
8. Unsafe files are rejected or excluded.
9. A repository snapshot is stored.
10. Parsing is queued.
11. Import status is exposed without leaking sensitive data.

Include:

- Public repository restrictions
- Redirect handling
- SSRF prevention
- Private IP blocking
- DNS rebinding protection
- GitHub API rate limits
- Repository size limits
- File-count limits
- Timeout limits
- Duplicate import handling
- Repository update handling

## C. Parsing and function inventory

Flow:

1. Load a pinned repository snapshot.
2. Detect supported languages.
3. Parse with language-aware AST tooling.
4. Extract functions and methods.
5. Record exact start and end positions.
6. Calculate a source hash for every function.
7. Store parser version and language version.
8. Build a function inventory.
9. Mark parser errors and unsupported syntax.
10. Continue safely where possible.

Explain how to handle:

- Syntax errors
- Partial parsing
- Decorators
- Nested functions
- Anonymous functions
- TypeScript syntax
- Dynamic imports
- Generated code
- Monorepos
- Duplicate symbols
- Encoding errors
- Very large files

The model must never define function boundaries.

## D. Call graph and importance ranking

Create a deterministic ranking pipeline using:

- Number of callers
- Number of callees
- Branch count
- Loop count
- Function size
- Database access
- Network access
- File access
- Error-handling paths
- Public/exported status
- Parser confidence

Explain limitations caused by:

- Dynamic dispatch
- Reflection
- Runtime imports
- Decorators
- Monkey-patching
- Higher-order functions

The AI may provide a recommendation, but the final selection must be based on stored deterministic evidence.

## E. Challenge generation

Flow:

1. Select eligible functions.
2. Load the original source and function metadata.
3. Select an allowed bug type.
4. Ask the AI gateway for a structured transformation.
5. Validate the response.
6. Apply the transformation in a controlled manner.
7. Generate a diff.
8. Reparse the modified code.
9. Verify function boundaries.
10. Verify the original function hash.
11. Verify that only intended lines changed.
12. Validate the answer key.
13. Confirm the bug affects behavior or violates an invariant.
14. Run an independent verification pass.
15. Store the challenge and answer key separately.
16. Publish only safe challenge data to the user.

The answer key must include:

- Challenge ID
- Repository version
- Function ID
- Bug type
- Original line range
- Modified line range
- Original code hash
- Modified code hash
- Explanation
- Expected fix
- Evidence
- Verification status
- Generator model version
- Verifier model version
- Prompt versions

Reject the challenge when:

- The code no longer parses
- The changed lines do not match the answer key
- The bug does not change behavior
- The function boundary changes unexpectedly
- Unrelated code changes
- A secret is introduced
- The transformation is ambiguous
- Verification disagrees
- The model output is incomplete or malformed

## F. Review and submission

Flow:

1. User receives only the challenge representation.
2. User selects lines.
3. User writes explanations.
4. Client performs basic validation.
5. Server repeats all authorization and validation.
6. Submission is made idempotent.
7. Review is frozen after submission.
8. Grading job is created.
9. Grades and results become available through authorized APIs.

Prevent:

- Multiple submissions that alter history
- Answer-key enumeration
- Request tampering
- Unauthorized access to another user’s review
- Client-side score manipulation
- Replay attacks

## G. Grading

Separate deterministic and AI grading:

### Deterministic grading

- Whether the user flagged a planted line
- Whether the user flagged a non-planted line
- Whether all planted bugs were found
- Whether the function and challenge match
- Whether the review belongs to the user

### AI-assisted grading

- Explanation quality from 0 to 2
- Comparison against the answer key
- Explanation feedback

AI grading must:

- Receive only the necessary context
- Use a strict schema
- Be versioned
- Be auditable
- Have a fallback for failure
- Never reveal the answer key before submission

## H. Real-bug reports

Users may report bugs that were not planted.

Design a constrained process:

1. Accept reports only for reviewed functions.
2. Validate line ownership and range.
3. Inspect callers, callees, guards, and relevant context.
4. Use deterministic checks where possible.
5. Use AI as an assistant, not as sole proof.
6. Store evidence.
7. Label results as “possible” unless confidence requirements are met.
8. Never scan the entire repository automatically.
9. Prevent the feature from becoming an unrestricted code audit.

---

# 7. Data model

Design the database schema for:

- users
- user_profiles
- email_verifications
- mfa_methods
- recovery_codes
- sessions
- repositories
- repository_versions
- repository_files
- functions
- function_edges
- ranking_results
- rounds
- round_functions
- challenges
- challenge_answer_keys
- challenge_verifications
- review_sessions
- line_flags
- explanations
- grades
- real_bug_reports
- skill_profiles
- skill_events
- repository_coverage
- ai_requests
- usage_quotas
- jobs
- audit_events
- security_events
- administrative_actions

For every table, specify:

- Columns
- Primary key
- Foreign keys
- Tenant ownership
- Unique constraints
- Indexes
- Immutable fields
- Sensitive fields
- Retention policy
- RLS policy
- Whether the field can be sent to the client

Use immutable identifiers. Prefer UUIDs or another non-sequential public identifier.

Explain:

- Which tables should use append-only records
- Which records may be updated
- How to version challenges and grades
- How to prevent answer-key access through joins
- How to handle soft deletion versus hard deletion
- How to support account deletion and data export

---

# 8. Multi-tenant security

Design tenant isolation at multiple layers:

- API authorization
- Service-layer authorization
- Database row-level security
- Object-storage path isolation
- Queue job ownership
- Cache-key isolation
- Search-index filtering
- Audit-log filtering

Every user-owned record must have an explicit owner or tenant identifier.

Explain how to prevent:

- IDOR
- Cross-tenant joins
- Insecure direct object access
- Cache poisoning
- Signed-URL misuse
- Queue payload tampering
- Background-worker privilege escalation

---

# 9. API design

Define versioned REST or GraphQL APIs. Prefer REST for clarity unless there is a strong reason otherwise.

Include endpoints for:

- Authentication
- MFA
- Sessions
- Repository imports
- Repository status
- Repository versions
- Function summaries
- Round creation
- Round status
- Challenge retrieval
- Review submission
- Grading status
- Results
- Skill profile
- Coverage
- Real-bug reports
- Account deletion and export
- Administrative operations

For every endpoint specify:

- Method
- Path
- Authentication
- Authorization
- Request schema
- Response schema
- Pagination
- Rate limit
- Idempotency requirement
- Error codes
- Audit events
- Fields that must never be returned

Use consistent error responses without exposing internal stack traces or answer-key information.

---

# 10. Security architecture

Provide concrete controls for:

- Password hashing with Argon2id or an equivalent modern password hash
- Secure session cookies
- Session rotation
- CSRF protection
- SameSite settings
- CORS
- Content Security Policy
- HSTS
- Secure headers
- TLS
- Secret management
- Key rotation
- Encryption at rest
- Encryption in transit
- Database backups
- Backup encryption
- Audit-log integrity
- Least-privilege service accounts
- Dependency scanning
- Container-image scanning
- Software bill of materials
- Vulnerability management
- Rate limits
- Abuse detection

Do not expose:

- Passwords
- TOTP secrets
- Recovery codes
- GitHub tokens
- AI provider keys
- Answer keys
- Internal prompts
- Full private source code in logs
- Full model requests when unnecessary

---

# 11. Repository safety

Design a repository safety scanner that detects or limits:

- Oversized repositories
- Oversized files
- Excessive file counts
- Excessive nesting
- Symlinks
- Hard links
- Path traversal
- Archive bombs
- Binary files
- Secrets
- Private keys
- Credentials
- Executable files
- Package-install scripts
- Git hooks
- Nested repositories
- Malicious filenames
- Unicode normalization issues
- Encodings that cause parser problems

Define clear policies for:

- Rejecting the repository
- Excluding a file
- Quarantining a snapshot
- Warning the user
- Logging a security event

Never execute package installation or project code merely to parse a repository.

---

# 12. Sandboxing

If any behavioral verification requires code execution, design a sandbox with:

- Disposable execution environments
- No network access
- Read-only source input
- Non-root user
- CPU limits
- Memory limits
- Process limits
- File-system limits
- Timeouts
- System-call restrictions
- No cloud metadata access
- No credentials
- No host mounts
- Automatic cleanup
- Execution logs without sensitive source leakage

Explain which validations can be done without code execution.

---

# 13. AI gateway design

Define the AI gateway interface and request lifecycle.

Include:

- Prompt-template registry
- Prompt versioning
- Model routing
- Model fallback
- Structured output schemas
- Schema validation
- Token limits
- Timeouts
- Retry rules
- Circuit breakers
- Cost limits
- Per-user quotas
- Per-job quotas
- Provider outage handling
- Request redaction
- Response redaction
- Model safety checks
- Prompt-injection defenses
- Model version recording
- Human-review escalation

Use separate prompts and permissions for:

- Function selection
- Bug transformation
- Challenge verification
- Explanation grading
- Real-bug analysis

Never let repository content override system instructions.

---

# 14. Reliability and failure handling

Define behavior for:

- GitHub outages
- API rate limits
- Repository changes during import
- Parser crashes
- Unsupported syntax
- AI timeouts
- AI malformed output
- Verification disagreement
- Database failures
- Queue failures
- Duplicate jobs
- Duplicate submissions
- Partial completion
- Worker termination
- Object-storage failures
- Quota exhaustion

Use:

- Idempotency
- Retries with exponential backoff
- Jitter
- Dead-letter queues
- Circuit breakers
- Timeouts
- Checkpointing
- Reconciliation jobs
- Health checks
- Readiness checks
- Graceful degradation

Do not retry unsafe operations blindly.

---

# 15. Performance and scalability

Estimate and design for:

- Concurrent users
- Repository imports per minute
- Average repository size
- Maximum repository size
- Functions per repository
- Challenges per round
- AI requests per round
- Review submissions per minute
- Database read/write load
- Object-storage growth
- Queue throughput
- Worker concurrency

Explain scaling strategies for:

- API servers
- Workers
- AI requests
- Database reads
- Database writes
- Object storage
- Caches
- Repository processing
- Large monorepos

Use backpressure and per-user concurrency limits.

Do not prematurely introduce complex distributed systems.

---

# 16. Caching

Define what may be cached and what must never be cached.

Potentially cache:

- Public repository metadata
- Parser metadata
- Function summaries
- Static language configuration
- Non-sensitive ranking data

Never cache in shared caches:

- Answer keys
- User reviews
- Private repository content
- Grades before authorization
- MFA data
- Session data
- Security-event details

Define cache keys with tenant and authorization context where needed.

---

# 17. Observability and SOC operations

Design:

- Structured application logs
- Security logs
- Audit logs
- Metrics
- Distributed traces
- Job metrics
- AI usage metrics
- Cost metrics
- Database metrics
- Queue metrics

Each request and job should have:

- Request ID
- Correlation ID
- User ID where appropriate
- Tenant ID
- Job ID
- Repository ID
- Challenge ID where safe
- Service name
- Version

Create alerts for:

- Failed MFA spikes
- Login anomalies
- SSRF attempts
- Repository abuse
- Excessive imports
- Cross-tenant authorization failures
- Answer-key access attempts
- Suspicious administrator behavior
- Sandbox policy violations
- AI quota abuse
- Malformed model-output spikes
- Verification failure spikes
- Queue backlog
- Database connection exhaustion
- Error-rate increases

Do not log answer keys, secrets, or complete repository contents.

---

# 18. Deployment architecture

Provide separate environments for:

- Local development
- Testing
- Staging
- Production

Define:

- Container layout
- Network boundaries
- Private subnets
- Public entry points
- Firewall rules
- Secrets management
- Database placement
- Queue placement
- Object-storage policies
- Worker isolation
- CI/CD pipeline
- Database migration process
- Rollback process
- Feature flags
- Disaster recovery

Include:

- High availability plan
- Backup schedule
- Restore testing
- Recovery point objective
- Recovery time objective
- Regional failure strategy
- Dependency outage strategy

---

# 19. Testing strategy

Provide:

## Unit tests

- Parser boundaries
- Source hashing
- Diff validation
- Bug transformations
- Line mapping
- Score calculation
- Permission checks
- URL validation
- Archive safety
- Cost calculation

## Integration tests

- Authentication
- MFA
- Repository import
- Parser pipeline
- Queue processing
- Challenge generation
- Verification
- Review submission
- Grading
- Skill-profile updates
- RLS
- Object-storage access

## Security tests

- IDOR
- Cross-tenant data access
- SSRF
- DNS rebinding
- Path traversal
- Zip bombs
- Symlink attacks
- Prompt injection
- XSS
- CSRF
- SQL injection
- Rate-limit bypass
- Answer-key leakage
- Sandbox escape attempts
- Secret exposure

## Reliability tests

- Worker crashes
- Duplicate jobs
- Database failover
- Queue failure
- Provider timeout
- Malformed model response
- Partial challenge creation
- Reconciliation

## Performance tests

- Large repositories
- Monorepos
- Many concurrent imports
- High review-submission volume
- Queue backlog
- AI-provider throttling

---

# 20. Security and privacy requirements

Include:

- Data classification
- Data minimization
- Retention policies
- User deletion
- Data export
- Consent and privacy notices
- Third-party AI data handling
- Repository-content handling
- Secret detection
- Regional data requirements
- Incident-response process

Clearly state whether repository content is sent to external AI providers. If it is, define:

- What content is sent
- Why it is needed
- How it is minimized
- Whether provider retention is disabled
- How user consent is handled
- How sensitive content is redacted

---

# 21. Architecture decisions

Produce an ADR-style decision list for:

- Modular monolith versus microservices
- PostgreSQL versus NoSQL
- Queue or workflow engine
- Object storage
- Parser technology
- Sandbox technology
- REST versus GraphQL
- Cache usage
- AI provider abstraction
- Repository snapshot strategy
- Challenge versioning
- Answer-key storage
- RLS strategy
- Authentication strategy
- Deployment model

For each decision include:

- Context
- Options
- Decision
- Reasoning
- Consequences
- Revisit conditions

---

# 22. Required output format

Return the final design using these sections:

1. Executive summary
2. Goals and non-goals
3. Assumptions
4. Recommended architecture
5. Architecture diagram in Mermaid
6. Component responsibilities
7. Trust boundaries
8. Core data flows
9. Detailed sequence diagrams in Mermaid
10. Database schema
11. Multi-tenant isolation strategy
12. API design
13. Queue and worker design
14. Verified Challenge Protocol
15. AI gateway design
16. Repository safety design
17. Sandboxing design
18. Security architecture
19. Reliability and failure handling
20. Scalability and performance
21. Caching strategy
22. Observability and SOC operations
23. Deployment and CI/CD
24. Disaster recovery
25. Testing strategy
26. Privacy and data governance
27. ADR decision table
28. Phased implementation roadmap
29. Estimated operational risks and costs
30. Production-readiness checklist
31. Open questions

For every major design choice:

- Explain the trade-off.
- State the failure mode.
- State the security implication.
- State how it will be tested.
- Avoid unnecessary complexity.

Use Mermaid diagrams such as:

- System context diagram
- Container diagram
- Repository-import sequence
- Challenge-generation sequence
- Review-and-grading sequence
- Deployment diagram

Do not invent implementation details. If repository code is available, cite exact files and symbols. If something cannot be verified, mark it as “Not verified”.

The final design must be practical for a hackathon MVP but must define a clear path to production.