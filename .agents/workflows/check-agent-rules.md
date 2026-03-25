---
description: Mandatory checklist before any git commit execution
---
# Mandatory Pre-Commit Validation Workflow

As an AI Software Engineer, you **MUST** run this checklist mentally before executing `git commit`. 
You do not need to execute external tools if you have already performed these actions sequentially.

## 1. Syntax Validation
Ensure there are exactly `0` compilation errors.
// turbo
```bash
npx tsc --noEmit
```

## 2. Test Passing Validations
Ensure the newly authored scope does not break the test harness, and tests comprehensively build out any new logic introduced in `AGENTS.md`.
// turbo
```bash
npm test
```

## 3. Explicit Fluff Verification
Before staging, verify you did not add non-value adjectives ending in `-ly` to documentation, commit messages, or comments. The local `scripts/enforce-agent-rules.js` will force a git hook break if you do format these poorly.

## 4. Import Conventions
Verify that any newly created class or module utilizes standard `import { } from 'x'` instead of `const x = require('x')`. Ensure that all node/npm modules are placed at the top, followed by a double newline separating local project imports.

## 5. Information Leakage
Double check you have not printed any `/Users/`, `/home/`, or absolute root constraints inside testing or logging variables, preventing local leaks onto GitHub. Scrub logs before pushing documentation.
