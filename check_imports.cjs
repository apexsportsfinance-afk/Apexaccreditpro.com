
const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/Administrator/OneDrive/Desktop/pro/src/pages/admin/Accreditations.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
const lines = content.split('\n');
const results = [];

lines.forEach((line, index) => {
  let match;
  while ((match = importRegex.exec(line)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const absolutePath = path.resolve(path.dirname(filePath), importPath);
      const possibleExtensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
      let found = false;
      for (const ext of possibleExtensions) {
        if (fs.existsSync(absolutePath + ext)) {
          found = true;
          break;
        }
      }
      if (!found) {
        results.push({ line: index + 1, importPath, absolutePath, status: 'MISSING' });
      } else {
        results.push({ line: index + 1, importPath, status: 'OK' });
      }
    } else {
       results.push({ line: index + 1, importPath, status: 'EXTERNAL' });
    }
  }
});

console.log(JSON.stringify(results, null, 2));
