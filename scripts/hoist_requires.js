const fs = require('fs');
const cp = require('child_process');

try {
    const filesToFix = cp.execSync('npx eslint "**/*.ts" --format json || true').toString();
    const results = JSON.parse(filesToFix);

    for (const res of results) {
        if (res.errorCount === 0) continue;
        let fileContent = fs.readFileSync(res.filePath, 'utf8');
        let lines = fileContent.split('\n');
        let newImports = [];
        
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            const reqMatch = line.match(/^\s*(?:const|let|var)\s+(\{?[^=}]+?\}?)\s*=\s*require\(['"]([^'"]+)['"]\);?/);
            if (reqMatch) {
                const vars = reqMatch[1].trim();
                let module = reqMatch[2];
                if (module === 'url' || module === 'crypto' || module === 'fs') {
                    module = `node:${module}`;
                    if (!vars.includes('{')) {
                        newImports.push(`import * as ${vars} from '${module}';`);
                    } else {
                        newImports.push(`import ${vars} from '${module}';`);
                    }
                } else {
                    newImports.push(`import ${vars} from '${module}';`);
                }
                // leave blank line to not break block scopes immediately implicitly
                lines[i] = line.replace(reqMatch[0], ''); 
            }
        }
        
        if (newImports.length > 0) {
            let lastImportIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('import ')) lastImportIdx = i;
            }
            
            newImports = [...new Set(newImports)];
            lines.splice(lastImportIdx + 1, 0, ...newImports);
            fs.writeFileSync(res.filePath, lines.join('\n'));
            console.log("Hoisted in", res.filePath);
        }
    }
} catch (e) {
    console.error(e);
}
