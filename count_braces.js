const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Administrator\\OneDrive\\Desktop\\pro\\src\\pages\\admin\\Events.jsx', 'utf8');
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
console.log(`Open: ${openBraces}, Close: ${closeBraces}`);
