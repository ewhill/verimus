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
- If overriding external implicit implementations, leverage `// @ts-ignore` as opposed to `(item as any)` casting where possible.

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
