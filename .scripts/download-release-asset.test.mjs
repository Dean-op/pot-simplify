import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const repo = 'tauri-apps/nsis-tauri-utils';
const tag = 'nsis_tauri_utils-v0.4.1';
const name = 'nsis_tauri_utils.dll';
const assetUrl = `https://api.github.com/repos/${repo}/releases/assets/123`;
const sha1 = 'e7f994b9d977ec1756708cd99186703f25fc735b';

async function fixture(t, body = 'MZtest', size = 6, status = 200, assetName = name) {
    const root = await mkdtemp(path.join(tmpdir(), 'pot-asset-'));
    t.after(async () => {
        assert.equal(path.dirname(root), path.resolve(tmpdir()));
        assert.ok(path.basename(root).startsWith('pot-asset-'));
        await rm(root, { recursive: true });
    });
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (url === `https://api.github.com/repos/${repo}/releases/tags/${tag}`) {
            return Response.json({ assets: [{ name: assetName, url: assetUrl, size, digest: null }] });
        }
        assert.equal(url, `${assetUrl}?download=1`);
        assert.equal(new Headers(options.headers).get('accept'), 'application/octet-stream');
        return new Response(body, { status, headers: { 'content-type': 'application/octet-stream' } });
    });
    const { downloadReleaseAsset } = await import('./download-release-asset.mjs');
    return { file: path.join(root, assetName), downloadReleaseAsset };
}

test('asset API download writes the complete binary after verifying its pinned hash', async (t) => {
    const { file, downloadReleaseAsset } = await fixture(t);
    await downloadReleaseAsset(repo, tag, name, file, sha1);
    assert.equal(await readFile(file, 'utf8'), 'MZtest');
});

test('bad status, truncated data and a wrong hash cannot replace an existing asset', async (t) => {
    for (const [body, size, status, expected] of [
        ['unavailable', 11, 504, /HTTP 504/],
        ['MZ', 6, 200, /size/i],
        ['MZevil', 6, 200, /hash/i],
    ]) {
        await t.test(expected.source, async (t) => {
            const { file, downloadReleaseAsset } = await fixture(t, body, size, status);
            await writeFile(file, 'keep-existing');
            await assert.rejects(downloadReleaseAsset(repo, tag, name, file, sha1), expected);
            assert.equal(await readFile(file, 'utf8'), 'keep-existing');
            await assert.rejects(readFile(`${file}.partial`), { code: 'ENOENT' });
        });
    }
});

test('CAB downloads reject non-CAB bytes even when the metadata size matches', async (t) => {
    const { file, downloadReleaseAsset } = await fixture(t, 'html!!', 6, 200, 'runtime.cab');
    await assert.rejects(downloadReleaseAsset(repo, tag, 'runtime.cab', file), /signature/i);
});
