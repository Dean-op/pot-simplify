import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

try {
    const read = (file) => readFileSync(file, 'utf8');
    const versions = {
        'package.json': JSON.parse(read('package.json')).version,
        'src-tauri/tauri.conf.json': JSON.parse(read('src-tauri/tauri.conf.json')).package.version,
        'src-tauri/Cargo.toml': read('src-tauri/Cargo.toml')
            .split('[package]')[1]
            ?.split(/\r?\n\[/)[0]
            .match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1],
        'src-tauri/Cargo.lock': read('src-tauri/Cargo.lock').match(
            /(?:^|\n)name = "pot-simplify"\r?\nversion = "([^"]+)"/
        )?.[1],
    };
    const expected = process.argv[2] ?? versions['package.json'];
    assert.match(expected, /^\d+\.\d+\.\d+$/, 'Release version must be x.y.z');
    for (const [file, version] of Object.entries(versions)) {
        assert.equal(version, expected, `${file}: expected ${expected}, got ${version}`);
    }
    console.log(`Release version ${expected}: all four files match`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
