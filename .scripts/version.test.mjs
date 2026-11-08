import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('./check-version.mjs', import.meta.url));

test('the actual project manifests and Cargo lock agree on a release version', () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('release validation rejects any inconsistent manifest, lock, tag or non-release version', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'pot-version-'));
    const run = (versions, tag) => {
        mkdirSync(path.join(root, 'src-tauri'), { recursive: true });
        writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: versions[0] }));
        writeFileSync(
            path.join(root, 'src-tauri/tauri.conf.json'),
            JSON.stringify({ package: { version: versions[1] } })
        );
        writeFileSync(
            path.join(root, 'src-tauri/Cargo.toml'),
            `[package]\nname = "pot-simplify"\nversion = "${versions[2]}"\n[dependencies]\n`
        );
        writeFileSync(
            path.join(root, 'src-tauri/Cargo.lock'),
            `[[package]]\nname = "pot-simplify"\nversion = "${versions[3]}"\n`
        );
        return spawnSync(process.execPath, [script, ...(tag ? [tag] : [])], { cwd: root, encoding: 'utf8' });
    };
    try {
        assert.equal(run(['9.1.0', '9.1.0', '9.1.0', '9.1.0'], '9.1.0').status, 0);
        for (let index = 0; index < 4; index++) {
            const versions = ['9.1.0', '9.1.0', '9.1.0', '9.1.0'];
            versions[index] = '9.0.9';
            assert.equal(run(versions, '9.1.0').status, 1);
        }
        assert.equal(run(['9.1.0', '9.1.0', '9.1.0', '9.1.0'], '9.2.0').status, 1);
        assert.equal(run(['9.1.0-dev', '9.1.0-dev', '9.1.0-dev', '9.1.0-dev']).status, 1);
    } finally {
        assert.equal(path.dirname(root), path.resolve(tmpdir()));
        assert.ok(path.basename(root).startsWith('pot-version-'));
        rmSync(root, { recursive: true });
    }
});
