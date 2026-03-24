# Project Directives for AI Engineering Assistants

If you are an AI software engineer modifying this codebase, you **must** adhere to the following architectural guidelines. These rules govern the backend topology within `Verimus`. 

## 1. Directory Structure & File Naming
The backend architecture enforces a rigorous, scalable encapsulation model:

- **Class Files**: Strict `UpperCamelCase` (PascalCase). Example: `RemoteFSProvider.ts`, `PeerNode.ts`.
- **Component Parent Directories**: Strict `snake_case`. Example: `remote_fs_provider`, `peer_node`. Each class **must** live encapsulated in its own matched parent directory.
- **Unit Tests Placement**: Unit tests belong inside a `test/` subdirectory strictly inside the parent component's folder. Do **not** create a global `/tests/` directory for unit isolation.
    - Example: `storage_providers/remote_fs_provider/test/RemoteFSProvider.test.ts`
- **Unit Test Files**: Append `.test.ts`, matching the `UpperCamelCase` naming of its corresponding class.

## 2. Integration & Global Testing
- **Integration Tests**: Any scripts modeling complex overarching user-journeys spanning multiple classes must be housed under `test/integration/`. 
- **Tests command**: Execute tests uniformly by running `npm test`.

## 3. Strict Typing Practices
Do **not** use `as any` casting unless actively monkey-patching poorly defined external dependency types (e.g., overriding `ringnet` connections). 

- Define interface mappings within `types/index.d.ts`. 
- Avoid loose `JSON.parse` returns. Strictly type properties appropriately.
- If overriding external implicit implementations, leverage `// @ts-ignore` as opposed to `(item as any)` casting where possible. Do not burn excessive compute cycles fighting complex nested TypeScript generics from loosely-typed external libraries; securely leverage isolated pragmas rather than infinitely struggling with TS inference constraints.

## 4. Frontend Exclusivity 
The `ui/` directory holds the React/Vite front-end app executing decoupled states. Do **not** mix backend dependencies into the `ui/` layer.

## 5. Storage and Providers
All external state adapters belong strictly in the `storage_providers/` root directory. When implementing a physical data adapter, use and implement the encapsulated `base_provider` integrations.

*Please honor these parameters when contributing to the codebase.*

## 6. Task Completion & Git Practices
When writing code and managing commits, adhere to the following best practices for code health and tracking. Because AI agents operate autonomously, adhere strictly to these operational guardrails:

- **Component Isolation**: Attempt to keep a single change (commit) isolated to a single component. Only change multiple components at once if the specific task requires it. Keep changes as small and concise as possible without sacrificing readability or code health. Do not group unrelated refactoring or "helpful" fixes into a feature commit.
- **Size Limits**: If a change reaches **600 lines of code or more**, strongly consider splitting it into two smaller, isolated changes. However, if splitting causes confusion, dead branches, or negatively impacts code health, it is acceptable to keep it as a single, large change.
- **Test Coverage**: Every explicit change must include updates to the corresponding unit or integration tests. If current coverage is inadequate, you must add new test cases. Run tests recursively (`npm test`) and fix any bugs until the entire suite passes fully.
- **Syntax Validation**: Before committing, agents **must** run `npx tsc --noEmit` and confirm exactly `0` compilation errors to proactively ensure typing bounds have not been broken.
- **Commit Formatting**: After validation, wrap the change in a single git commit. The commit message must summarize the intent and include a **hash tag** referencing the specific broader design or task breakdown (e.g., `#PeerOpsAndMarketConfigs`). Do not autonomously push to the remote repository.
- **Stacking & Context Tracking**: It is fully permitted and encouraged to stack commits locally on top of one another to incrementally build out larger task breakdowns and designs. To prevent agents from losing their train of thought during massive stacked workloads, progressively check off and maintain robust markdown artifact checklists. Store these artifacts cleanly inside `./docs/agents/` (e.g., `./docs/agents/clementine_breakdown.md`), creating the directory inherently if it does not already exist.
- **Information Leakage**: It is CRITICAL that no changes made include any sensitive or secret information. If a file is required in code or referenced in a markdown (MD) file, it must be referenced **RELATIVELY** (e.g., via relative paths). NEVER include the absolute path or root directory structures of the current working environment to prevent information leakage through the github record.
    - **Log Scrubbing:** When copying terminal outputs, test failures, or stack traces into tracking artifacts or commit messages, you MUST actively scrub and truncate them to relative paths. Do not blindly paste untouched terminal logs.
    - **Validation Checks:** Before running `git commit`, proactively review your diff specifically looking for system root indicators (e.g., `/Users/`, `/home/`, `C:/`) to decisively trap accidental leakage.
- **Infinite Loop Breakage**: If an agent attempts an implementation fix (to pass tests or syntax validation) and fails **three consecutive times** with identical or highly similar errors, the agent MUST explicitly pause. Do not blindly loop or burn computational cycles. Instead, document the blockage securely in the `./docs/agents/` stacked artifact, fundamentally alter the conceptual strategy, or flag the human user for directional intervention.
- **Documentation Parity**: Whenever a significant backend component, endpoint, or logical block is drafted or updated, agents must preemptively update `README.md` and any API endpoint documentation to mirror the newly shaped code perfectly before concluding the task.
- **Tool Priority Directives**: When refactoring or replacing code, agents must prioritize natively integrated IDE modification tools (e.g., direct file replacement payloads) over constructing complicated, string-blind terminal scripts (like `sed` or `awk` pipelines), which frequently corrupt precise file formatting.
- **Hermetic Test Environments**: Avoid generating physical artifacts, data folders, or persistent logs inside the project's root folder during test executions. Tests must either utilize purely in-memory structures (e.g., `MongoMemoryServer`) or, if file-system interaction is unavoidable, map directories explicitly to ephemeral, OS-managed temporary paths (e.g., `fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-'))`) to ensure testing environments remain unconditionally isolated and clean.
- **TypeScript & Import Conventions**: Prefer `import { ... } from '...'` or `import ... from '...'` syntax heavily over explicit `require()` calls. All imports must be positioned at the very top of the file, strictly separated into two distinct groups: global network/node_module imports first, followed by a single blank line, and then local project imports. Both groups must be sorted alphabetically within their respective blocks. A strict **double newline** must separate the final import statement from the actual implementation logic. Always aggressively prune and remove any dead or unused imports when modifying files.
- **Look Before You Leap**: Always run an initial `npm test` or `npx tsc --noEmit` baseline before starting a task to observe pre-existing failures. Thoroughly read existing architecture prior to generating new components.
- **Verifiable Dead Code Pruning**: When refactoring legacy logic, carefully trace and delete old functions, unused classes, and isolated code blocks ONLY if they are verifiably dead after replacement, explicitly preventing repository bloat.
- **UI Validation**: When modifying frontend code, particularly concerning role routing and offline logic, always validate the UI manually using Chrome (or a browser subagent) to confirm graceful degradation during server outages rather than relying solely on static analysis.

## 7. Advanced Development Constraints
- **Strict `import type`**: Use the `import type { ... }` keyword when importing ambient types or interfaces. This ensures the bundler strips the import during execution, preventing phantom runtime `require()` crashes.
- **Discriminated Unions**: When defining complex domain boundaries (e.g., network messages, blocks, external contracts), favor TypeScript **Discriminated Unions** (using literal `type` fields) over stacking properties into monolithic objects. This enforces compile-time bounds and avoids manual runtime type-checking.
- **Zombie Test Processes**: When running integration tests (`MongoMemoryServer`, WebSockets), locate and kill orphaned background processes (e.g., `pkill -f mongod`) if the test environment exhibits port-binding freezes.
- **IDE Phantom Caching**: When renaming broad directories or migrating components, trust CLI compiler diagnostics (`npx tsc --noEmit`) over IDE lint assertions. Language server caches often flag ghost files that no longer exist on disk.

## 8. Agent Writing Guide
Avoid adding superfluous, "fluff" adjectives when forming any response or generating any code. Examples of this are words ending in -ly, such as "organically", "natively", "dynamically", "appropriately", "actively", "logically", etc. Ask yourself: do these adjectives add value to the intent or meaning of the sentence. If your response is absolutely, yes, then you may include them. Otherwise, prefer to omit these words as they reduce readability.
