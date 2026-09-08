import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import PHPParser from 'php-parser';
import { zipSync, strToU8 } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'php-site');
const php = new PHPParser({ parser: { version: 802, suppressErrors: false } });
const archive = {};
let count = 0;

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await collect(filename); continue; }
    if (!entry.isFile()) continue;
    const relative = path.relative(source, filename).split(path.sep).join('/');
    // Only package source files, never live data, secrets or identity documents.
    const allowed = /^(app\/[^/]+\.(php|sql)|public\/[^/]+\.php|public\/assets\/[^/]+\.(js|css|svg)|bin\/install\.php|tests\/smoke\.php|config\.example\.php|README\.md|nginx\.example\.conf|storage\/index\.html|(?:public\/|storage\/)?\.htaccess)$/.test(relative);
    if (!allowed) continue;
    const text = await readFile(filename, 'utf8');
    if (relative.endsWith('.php')) php.parseCode(text, relative);
    if (relative.endsWith('.js')) parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    archive[`shalom-bet-php/${relative}`] = strToU8(text);
    count++;
  }
}

await collect(source);
await mkdir(path.join(root, 'deliverables'), { recursive: true });
await writeFile(path.join(root, 'deliverables', 'shalom-bet-php.zip'), zipSync(archive, { level: 6 }));
console.log(`${count} dosya paketlendi: deliverables/shalom-bet-php.zip`);
console.log('PHP ve JavaScript sozdizimi ayristirildi. PHP calisma zamani testi ayrica gereklidir.');