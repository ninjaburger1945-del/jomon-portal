#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN;
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'ninjaburger1945-del/jomon-portal';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable not set');
  process.exit(1);
}

async function getDirectoryContents(dir) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${dir}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch ${dir}: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function deleteFile(filePath, sha) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: `chore(images): cleanup unused deep remaster images`,
      sha: sha,
      branch: 'main',
    }),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`Failed to delete ${filePath}: ${res.status} - ${JSON.stringify(errData)}`);
  }

  return true;
}

async function main() {
  const facilities = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/data/facilities.json'), 'utf-8'));

  // Get all used thumbnails
  const usedImages = new Set(
    facilities
      .map(f => f.thumbnail)
      .filter(t => t && t.includes('/images/facilities/'))
  );

  console.log(`📊 Found ${usedImages.size} used images`);
  console.log('Used images:', Array.from(usedImages).sort());

  // Get all files in public/images/facilities/
  console.log('\n📂 Fetching GitHub directory contents...');
  const files = await getDirectoryContents('public/images/facilities');

  const imagesToDelete = files.filter(file => {
    const fullPath = `/images/facilities/${file.name}`;
    return !usedImages.has(fullPath);
  });

  console.log(`\n🗑️  Found ${imagesToDelete.length} unused images to delete:`);
  imagesToDelete.forEach(f => {
    console.log(`   - ${f.name}`);
  });

  if (imagesToDelete.length === 0) {
    console.log('✅ No unused images to clean up!');
    return;
  }

  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--apply');

  if (isDryRun) {
    console.log('\n💡 Run with --apply to delete these files');
    process.exit(0);
  }

  console.log('\n🔄 Deleting unused images...');
  let successCount = 0;
  let failureCount = 0;

  for (const file of imagesToDelete) {
    try {
      await deleteFile(`public/images/facilities/${file.name}`, file.sha);
      console.log(`✅ Deleted ${file.name}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to delete ${file.name}: ${err.message}`);
      failureCount++;
    }
  }

  console.log(`\n✨ Cleanup complete! Deleted: ${successCount}, Failed: ${failureCount}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
