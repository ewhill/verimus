const { execSync } = require('child_process');
const fs = require('fs');

try {
    // Get staged files
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
        .split('\n')
        .filter(f => f.trim().length > 0)
        .filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.md'));

    if (stagedFiles.length === 0) {
        process.exit(0);
    }

    let hasErrors = false;

    for (const file of stagedFiles) {
        if (!fs.existsSync(file)) continue;
        if (file.includes('enforce-agent-rules.js')) continue;
        if (file.includes('AGENTS.md')) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        // Check for adverbs in markdown files exclusively
        lines.forEach((line, index) => {
            // Also check for explicit require() calls outside of tests in .ts files
            if (file.endsWith('.ts') && !file.includes('test') && !file.includes('config')) {
                if (line.match(/=\s*require\(/)) {
                    console.error(`❌ Explicit require() Blocked: Found in ${file}:${index + 1}. Use 'import' instead.`);
                    console.error(`   > ${line.trim()}`);
                    hasErrors = true;
                }
            }
        });
    }

    if (hasErrors) {
        console.error('\n🚨 AGENT COMPLIANCE FAILURE: Please align with AGENTS.md before committing.');
        process.exit(1);
    }

    process.exit(0);
} catch (e) {
    console.error("Hook error:", e);
    process.exit(1);
}
