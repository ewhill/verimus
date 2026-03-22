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
