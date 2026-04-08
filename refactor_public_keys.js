const fs = require('fs');
const glob = require('glob');

const files = glob.sync('/Users/erichill/Documents/Code/verimus/test/**/*.ts');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  const newContent = content.split('\n').filter(line => {
    // Exclude lines that simply define publicKeyPath: ... or publicKey: ...
    if (line.match(/^\s*(publicKeyPath|publicKey)\s*:\s*.*,?\s*$/)) {
      return false;
    }
    return true;
  }).join('\n');

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
}
