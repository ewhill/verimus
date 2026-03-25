# Codebase Audit: AGENTS.md Compliance Verification

## Goal Description
The objective is to audit the entire TypeScript codebase to ensure 100% compliance with the constraints defined in `AGENTS.md`, and proactively fix any unaligned codebase sections.

## Findings Summary

### Compliant Areas (100% Passing)
1. **Directory Structure & File Naming**: All component directories (`snake_case`) and class files (`UpperCamelCase`) are perfectly structured. Unit tests cleanly reside within their isolated `test/` folders matching their class names.
2. **Import Conventions**: There are zero instances of `require()` within any `.ts` file. All imports are grouped, sorted alphabetically utilizing `import/order`, and cleanly conform to the requested spacing rules.
3. **Syntax & Tests**: Baseline `tsc` compilation strictly returned 0 errors, and all tests seamlessly pass.

### Violations Identified
1. **Unused Variable Prefixes**: `AGENTS.md` explicitly requires prefixing unused variables exactly with `_unused` (e.g., `_unusedReq`), barring generic single underscore implementations (`_`). I located a few manual residual usages such as `_req` and `_` bridging generic callbacks within `api_server/ApiServer.ts` and `crypto_utils/test/CryptoUtils.test.ts`. 
2. **Strict Mock Integrity (`as any`)**: The directives explicitly prohibit polluting production architecture schemas with defensive `typeof` checks or broad `as any` type-casting merely to appease incomplete mocks.
    - **Production Violation**: Detected a defensive, loose bypass nested inside `route_handlers/download_handler/DownloadHandler.ts` invoking `typeof (readStream as any).destroy === 'function'`, definitively violating the runtime purity rules. 
    - **Testing Harness Violations**: Discovered over 97 isolated occurrences across `.test.ts` files universally leveraging `{} as any` payloads instead of concretely extending robust, expected architectural mock limits. 

## User Review Required

> [!IMPORTANT]
> The most pervasive violation inside the repository is the usage of ~100 loose `as any` bridges actively fulfilling unit tests contexts instead of strongly typing the struct data mappings.  
> 
> **Question:** Do you want me to expand and rewrite all ~100 active `as any` struct mocks recursively throughout every `.test.ts` file, or should I start by safely eliminating the production violation within `DownloadHandler.ts` and standardizing the final missing `_unused` variables?

## Proposed Changes

### route_handlers
#### [MODIFY] [DownloadHandler.ts](file:///Users/erichill/Documents/Code/verimus/route_handlers/download_handler/DownloadHandler.ts)
- Eliminate defensive typecast `typeof (readStream as any).destroy === 'function'` guard logic to strictly enforce proper stream destruction blindly matching structural guarantees.
#### [MODIFY] [DownloadHandler.test.ts](file:///Users/erichill/Documents/Code/verimus/route_handlers/download_handler/test/DownloadHandler.test.ts)
- Bind explicit `destroy` hook bounds into the test stream payloads, allowing the production pipeline to trigger the architecture predictably.

### api_server
#### [MODIFY] [ApiServer.ts](file:///Users/erichill/Documents/Code/verimus/api_server/ApiServer.ts)
- Standardize remaining parameter usage from `_req` to `_unusedReq`.

### crypto_utils
#### [MODIFY] [CryptoUtils.test.ts](file:///Users/erichill/Documents/Code/verimus/crypto_utils/test/CryptoUtils.test.ts)
- Standardize generic parameter `_` utilizing `_unusedEncoding` mappings internally.

*(If authorized, this list will aggressively expand downwards covering all remaining *.test.ts components to eradicate all `as any` overrides)*

## Verification Plan

### Automated Tests
- Execute `npm test` verifying test harness integrity successfully survives without the defensive logic.
- Execute `npx tsc --noEmit` and `npx eslint .` to validate that new types and prefixed unused variables properly compile against strict ESLint bounds.
