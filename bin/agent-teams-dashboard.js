#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.env.DIST_DIR = process.env.DIST_DIR ?? join(__dirname, '..', 'dist');

await import('../server-dist/server/index.js');
