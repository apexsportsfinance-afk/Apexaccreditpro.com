import fs from 'fs';

const BASE_URL = 'http://localhost:3002';

const getMime = (filename) => {
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.pdf')) return 'application/pdf';
  if (filename.endsWith('.html')) return 'text/html';
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

async function testUpload(endpoint, fieldName, filename, content, expectedStatus) {
  fs.writeFileSync(filename, content);
  
  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync(filename)], { type: getMime(filename) });
  formData.append(fieldName, fileBlob, filename);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: formData
  });

  const json = await res.json();
  const pass = res.status === expectedStatus;
  
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${endpoint} | File: ${filename} | Expected: ${expectedStatus} | Got: ${res.status} | Res: ${JSON.stringify(json)}`);
  
  fs.unlinkSync(filename);
}

async function runTests() {
  console.log('--- Testing /api/upload (Images + PDF) ---');
  await testUpload('/api/upload', 'file', 'test.jpg', 'fake-jpg-content', 200);
  await testUpload('/api/upload', 'file', 'test.png', 'fake-png-content', 200);
  await testUpload('/api/upload', 'file', 'test.pdf', 'fake-pdf-content', 200);
  await testUpload('/api/upload', 'file', 'test.html', '<html><script>alert(1)</script></html>', 400);
  await testUpload('/api/upload', 'file', 'test.svg', '<svg></svg>', 400);
  await testUpload('/api/upload', 'file', 'test.exe', 'MZ...', 400);

  console.log('\n--- Testing /api/upload/photos (Images ONLY) ---');
  await testUpload('/api/upload/photos', 'photos', 'gallery.jpg', 'fake-jpg-content', 200);
  await testUpload('/api/upload/photos', 'photos', 'gallery.png', 'fake-png-content', 200);
  await testUpload('/api/upload/photos', 'photos', 'gallery.pdf', 'fake-pdf-content', 400); // Should fail here!
  await testUpload('/api/upload/photos', 'photos', 'gallery.html', '<html></html>', 400);
  await testUpload('/api/upload/photos', 'photos', 'gallery.svg', '<svg></svg>', 400);
}

runTests().catch(console.error);
