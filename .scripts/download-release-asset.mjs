import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export async function downloadReleaseAsset(repo, tag, name, output, sha1) {
    assert.match(repo, /^[\w-]+\/[\w.-]+$/);
    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };
    const metadata = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
        headers,
        signal: AbortSignal.timeout(60_000),
    });
    assert.ok(metadata.ok, `Release metadata: HTTP ${metadata.status}`);
    const asset = (await metadata.json()).assets?.find((asset) => asset.name === name);
    assert.ok(asset, `Release asset not found: ${name}`);
    assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0, 'Invalid asset size');
    assert.ok(
        new RegExp(`^https://api\\.github\\.com/repos/${repo}/releases/assets/\\d+$`).test(asset.url),
        'Invalid official asset URL'
    );
    const expected = sha1 ? `sha1:${sha1}` : asset.digest;
    if (expected) assert.match(expected, /^(sha1:[a-f\d]{40}|sha256:[a-f\d]{64})$/i);
    const algorithm = expected?.split(':')[0].toLowerCase() ?? 'sha256';
    const hash = createHash(algorithm);
    const signature = { '.dll': 'MZ', '.zip': 'PK\u0003\u0004', '.cab': 'MSCF' }[path.extname(name)];
    assert.ok(signature, `Unsupported asset type: ${name}`);

    const partial = `${output}.partial`;
    let size = 0;
    let prefix = Buffer.alloc(0);
    try {
        const response = await fetch(`${asset.url}?download=1`, {
            headers: { ...headers, Accept: 'application/octet-stream' },
            signal: AbortSignal.timeout(600_000),
        });
        assert.equal(response.status, 200, `Asset download: HTTP ${response.status}`);
        assert.ok(response.headers.get('content-type')?.includes('application/octet-stream'), 'Not a binary asset');
        await mkdir(path.dirname(output), { recursive: true });
        await pipeline(
            Readable.fromWeb(response.body),
            new Transform({
                transform(chunk, encoding, callback) {
                    size += chunk.length;
                    hash.update(chunk);
                    if (prefix.length < 4) prefix = Buffer.concat([prefix, chunk]).subarray(0, 4);
                    callback(null, chunk);
                },
            }),
            createWriteStream(partial)
        );
        assert.equal(size, asset.size, 'Asset size mismatch');
        assert.equal(prefix.subarray(0, signature.length).toString('latin1'), signature, 'Asset signature mismatch');
        const digest = `${algorithm}:${hash.digest('hex')}`;
        if (expected) assert.equal(digest, expected.toLowerCase(), 'Asset hash mismatch');
        await rename(partial, output);
        console.log(`Verified ${name}: ${size} bytes, ${digest}`);
    } finally {
        await rm(partial, { force: true });
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        const args = process.argv.slice(2);
        assert.ok(args.length === 4 || args.length === 5, 'Expected: repo tag asset output [sha1]');
        await downloadReleaseAsset(...args);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
