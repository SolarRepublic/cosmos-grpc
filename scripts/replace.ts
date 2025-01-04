import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const [sr_file, sx_search, sx_replace] = process.argv.slice(2);

const p_file = join(process.cwd(), sr_file);

console.log(p_file);

const sx_contents = readFileSync(p_file, 'utf-8');

const r_search = new RegExp(sx_search);

const s_out = sx_contents.replace(r_search, sx_replace);

writeFileSync(p_file, s_out);
