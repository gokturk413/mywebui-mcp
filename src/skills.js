// The mywebui AI skills shipped in skills/ (a copy of iobroker.mywebui/docs/ai-skills).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function loadSkills(dir) {
    const root = dir instanceof URL ? fileURLToPath(dir) : String(dir);
    const names = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && SAFE.test(d.name) && fs.existsSync(path.join(root, d.name, 'SKILL.md'))).map(d => d.name).sort() : [];
    const description = (name) => {
        const m = /^---\r?\n[\s\S]*?^description:\s*(.+)$/m.exec(fs.readFileSync(path.join(root, name, 'SKILL.md'), 'utf8'));
        return m ? m[1].trim() : '';
    };
    return {
        list: () => names.map(name => ({ name, description: description(name), files: fs.readdirSync(path.join(root, name)).filter(f => SAFE_FILE.test(f)).sort() })),
        read(name, file = 'SKILL.md') {
            if (!names.includes(name) || !SAFE_FILE.test(String(file))) return null;
            const p = path.join(root, name, file);
            return fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p, 'utf8') : null;
        },
    };
}
