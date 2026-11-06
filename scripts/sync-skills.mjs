// Copies the mywebui AI skills (iobroker.mywebui/docs/ai-skills) into skills/.
// Run: node scripts/sync-skills.mjs "<path to iobroker.mywebui>/docs/ai-skills"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, 'mywebui-development', 'SKILL.md'))) { console.error('usage: node scripts/sync-skills.mjs <iobroker.mywebui>/docs/ai-skills'); process.exit(1); }
const dest = fileURLToPath(new URL('../skills/', import.meta.url));
fs.rmSync(dest, { recursive: true, force: true });
for (const d of fs.readdirSync(src, { withFileTypes: true })) {
    if (d.isDirectory()) fs.cpSync(path.join(src, d.name), path.join(dest, d.name), { recursive: true });
}
console.log('skills copied to', dest);
