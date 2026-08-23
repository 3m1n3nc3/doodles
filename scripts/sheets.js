#!/usr/bin/env node
/** Render one contact sheet per feature category into out/. */
import { execFileSync } from 'node:child_process';
import { catalogue } from '../src/index.js';

const cats = Object.keys(await catalogue());
for (const c of cats) {
  execFileSync(process.execPath, ['bin/naives.js', 'sheet', '--category', c, '-o', `out/sheet-${c}.svg`], { stdio: 'inherit' });
}
