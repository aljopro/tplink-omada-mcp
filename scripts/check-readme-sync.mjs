#!/usr/bin/env node
/**
 * check-readme-sync.mjs
 *
 * Two different contracts, because the two READMEs do different jobs.
 *
 * README.Docker.md is the exhaustive reference: EVERY registered tool must
 * have its own `| `toolName` |` row. Unchanged from the original check.
 *
 * README.md is a human-facing overview. It used to carry the same exhaustive
 * table, but a 357-row table is not an introduction, so it now groups tools
 * by area in prose-style rows. Requiring one row per tool there would mean
 * either a wall of table or a permanently red check.
 *
 * So README.md is checked the other way round: every tool name it MENTIONS
 * must actually exist. That is the failure mode that matters for an overview -
 * advertising tools the server does not have. It has teeth: it is what caught
 * `setDeviceLed` and `setGatewayWanConnect` still being listed months after
 * the port replaced one and removed the other.
 *
 * "Looks like a tool name" is deliberately narrow - a known tool verb prefix
 * followed by an uppercase letter. That matches `setDeviceLed` while leaving
 * prose identifiers like `post`, `pageSize`, `buildOmadaPath` and
 * `fetchPaginated` alone.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(import.meta.dirname, '..');
const toolsDir = join(root, 'src', 'tools');

const TOOL_NAME_SHAPE = /^(get|list|search|set|update|create|delete|block|unblock|reconnect|adopt|reboot|start|batch|disable|enable|generic)[A-Z]/;

function extractToolName(content) {
    const match = content.match(/server\.registerTool\(\s*['"]([^'"]+)['"]/);
    return match ? match[1] : null;
}

/** Tool names given their own table row: `| `name` | ...` */
function extractTabulatedTools(content) {
    const tools = new Set();
    for (const match of content.matchAll(/^\| `([^`]+)` \|/gm)) {
        tools.add(match[1]);
    }
    return tools;
}

/** Every backticked identifier shaped like a tool name, anywhere in the doc. */
function extractMentionedToolNames(content) {
    const names = new Set();
    for (const match of content.matchAll(/`([a-z][a-zA-Z0-9]*)`/g)) {
        if (TOOL_NAME_SHAPE.test(match[1])) names.add(match[1]);
    }
    return names;
}

const readmeMd = readFileSync(join(root, 'README.md'), 'utf8');
const readmeDockerMd = readFileSync(join(root, 'README.Docker.md'), 'utf8');

const registered = new Set();
for (const file of readdirSync(toolsDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    const toolName = extractToolName(readFileSync(join(toolsDir, file), 'utf8'));
    if (toolName) registered.add(toolName);
}

const dockerReadmeTools = extractTabulatedTools(readmeDockerMd);
const missingDockerReadme = [...registered].filter((t) => !dockerReadmeTools.has(t)).sort();

// A doc can legitimately name a tool that no longer exists - explaining why it
// was removed is useful. Opt out locally and visibly, next to the reason:
//   <!-- check-readme-sync: allow setDeviceLed, setGatewayWanConnect (reason) -->
function extractAllowed(content) {
    const allowed = new Set();
    for (const match of content.matchAll(/<!--\s*check-readme-sync:\s*allow\s+([^->]+?)\s*(?:\([^)]*\))?\s*-->/g)) {
        for (const name of match[1].split(',')) {
            const trimmed = name.trim();
            if (trimmed) allowed.add(trimmed);
        }
    }
    return allowed;
}

const allowed = extractAllowed(readmeMd);
const stale = [...extractMentionedToolNames(readmeMd)].filter((t) => !registered.has(t) && !allowed.has(t)).sort();

let failed = false;

if (missingDockerReadme.length > 0) {
    console.error(`\n❌ ${missingDockerReadme.length} tool(s) missing from README.Docker.md:\n`);
    for (const t of missingDockerReadme) console.error(`  ${t}`);
    console.error('\nREADME.Docker.md is the exhaustive reference — every registered tool needs a row.');
    failed = true;
}

if (stale.length > 0) {
    console.error(`\n❌ README.md names ${stale.length} tool(s) that do not exist:\n`);
    for (const t of stale) console.error(`  ${t}`);
    console.error('\nEither the tool was renamed or removed, or the README is advertising something unimplemented.');
    failed = true;
}

if (failed) {
    console.error('\nSee CLAUDE.md — Documentation Synchronization.\n');
    process.exit(1);
}

console.log(`✅ All ${registered.size} tools documented in README.Docker.md; README.md names no missing tools.`);
