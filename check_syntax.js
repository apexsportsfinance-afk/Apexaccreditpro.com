const fs = require('fs');
try {
    const code = fs.readFileSync('src/pages/admin/Accreditations.jsx', 'utf8');
    // Simple check: count { vs }
    const opens = (code.match(/{/g) || []).length;
    const closes = (code.match(/}/g) || []).length;
    console.log(`Braces: { = ${opens}, } = ${closes}`);
    if (opens !== closes) {
        console.error('MISMATCHED BRACES!');
    }
} catch (e) {
    console.error(e);
}
