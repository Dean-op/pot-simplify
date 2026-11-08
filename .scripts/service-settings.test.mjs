import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { after, afterEach, before, test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

let server;
let useConfig;
let deleteKey;
let useServiceSave;
let useModelList;
let renderer;
let value;
let env;

function deferred() {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
}

before(async () => {
    server = await createServer({
        configFile: false,
        cacheDir: 'node_modules/.vite-service-tests',
        // SSR tests share the process runner, but do not need a listening HMR socket.
        server: { middlewareMode: true, hmr: { server: createHttpServer() } },
        appType: 'custom',
        ssr: { noExternal: ['@tauri-apps/api'] },
        optimizeDeps: { noDiscovery: true },
        plugins: [
            {
                name: 'service-settings-boundaries',
                enforce: 'pre',
                resolveId(source, importer) {
                    if (source === '../utils/store' && importer?.endsWith('/hooks/useConfig.jsx')) {
                        return '\0service-test-store';
                    }
                    if (source === '@tauri-apps/api/event') return '\0service-test-events';
                    if (source === '@tauri-apps/api/http') return '\0service-test-http';
                },
                load(id) {
                    if (id === '\0service-test-store') return 'export const store = globalThis.serviceTestEnv.store;';
                    if (id === '\0service-test-events') {
                        return `
                            export const listen = (...args) => globalThis.serviceTestEnv.listen(...args);
                            export const emit = (...args) => globalThis.serviceTestEnv.emit(...args);
                        `;
                    }
                    if (id === '\0service-test-http')
                        return 'export const fetch = (...args) => globalThis.serviceTestEnv.fetch(...args);';
                },
            },
        ],
    });
    env = {
        data: new Map(),
        events: new Map(),
        writes: [],
        saveBarrier: null,
        setBarrier: null,
        saveError: null,
        store: {
            async get(key) {
                return structuredClone(env.data.get(key) ?? null);
            },
            async set(key, data) {
                env.writes.push(['set', key]);
                if (env.setBarrier) await env.setBarrier.promise;
                env.data.set(key, structuredClone(data));
            },
            async save() {
                env.writes.push(['save']);
                if (env.saveBarrier) await env.saveBarrier.promise;
                if (env.saveError) throw env.saveError;
            },
            async has(key) {
                return env.data.has(key);
            },
            async delete(key) {
                env.data.delete(key);
            },
        },
        async listen(key, handler) {
            env.events.set(key, handler);
            return () => env.events.delete(key);
        },
        async emit(key, payload) {
            env.writes.push(['emit', key]);
            env.events.get(key)?.({ payload });
        },
        fetch: null,
    };
    globalThis.serviceTestEnv = env;
    ({ useConfig, deleteKey } = await server.ssrLoadModule('/src/hooks/useConfig.jsx'));
    ({ useServiceSave } = await server.ssrLoadModule('/src/hooks/useServiceSave.js'));
});

afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = null;
    // Let legacy debounce callbacks finish before the next test.
    await new Promise((r) => setTimeout(r, 550));
    env.data.clear();
    env.writes = [];
    env.saveBarrier = null;
    env.setBarrier = null;
    env.saveError = null;
});

after(async () => {
    await server?.close();
    delete globalThis.serviceTestEnv;
});

async function mount(key, defaults, options = { sync: false }) {
    function Probe() {
        value = useConfig(key, defaults, options);
        return null;
    }
    await act(async () => {
        renderer = create(React.createElement(Probe));
    });
}

test('opening and cancelling a new service does not create stored credentials or an orphan instance', async () => {
    await mount('openai@new', { apiKey: '', stream: false });
    assert.deepEqual(value[0], { apiKey: '', stream: false });
    assert.equal(env.data.has('openai@new'), false);
    assert.deepEqual(env.writes, []);
});

test('editing an old service fills missing fields without losing credentials, disabled state or custom prompts', async () => {
    env.data.set('openai@old', { apiKey: 'saved', enable: false, promptList: [{ role: 'user', content: 'custom' }] });
    await mount('openai@old', { apiKey: '', stream: true, thinkingMode: 'off', promptList: [] });
    assert.deepEqual(value[0], {
        apiKey: 'saved',
        enable: false,
        promptList: [{ role: 'user', content: 'custom' }],
        stream: true,
        thinkingMode: 'off',
    });
    assert.deepEqual(env.writes, []);
});

test('unsaved edits are isolated from service-list updates', async () => {
    env.data.set('openai@draft', { apiKey: 'saved' });
    await mount('openai@draft', {});
    await act(async () => value[1]({ apiKey: 'unsaved' }));
    await act(async () => env.emit('openai:draft_changed', { apiKey: 'saved', enable: false }));
    assert.equal(value[0].apiKey, 'unsaved');
    assert.equal(env.data.get('openai@draft').apiKey, 'saved');
});

test('explicit save waits for persistence before notifying consumers', async () => {
    env.data.set('openai@save', { apiKey: 'old' });
    await mount('openai@save', {});
    env.saveBarrier = deferred();
    let finished = false;
    let save;
    await act(async () => {
        save = Promise.resolve(value[1]({ apiKey: 'new' }, true)).then(() => (finished = true));
        await Promise.resolve();
    });
    assert.equal(finished, false);
    assert.ok(!env.writes.some(([operation]) => operation === 'emit'));
    env.saveBarrier.resolve();
    await act(async () => save);
    assert.equal(env.data.get('openai@save').apiKey, 'new');
    assert.equal(finished, true);
    assert.equal(env.writes.at(-1)[0], 'emit');
});

test('deleting a service does not save when the asynchronous has check returns false', async () => {
    await deleteKey('missing');
    assert.deepEqual(env.writes, []);
});

test('cancelled service validation never commits the draft or adds an instance', async () => {
    const check = deferred();
    let commits = 0;
    function Probe() {
        value = useServiceSave({
            onTest: () => check.promise,
            onSave: () => commits++,
            onError: (error) => {
                throw error;
            },
        });
        return null;
    }
    await act(async () => {
        renderer = create(React.createElement(Probe));
    });
    let submission;
    await act(async () => {
        submission = value[1]();
    });
    assert.equal(value[0], true);
    await act(async () => renderer.unmount());
    check.resolve();
    await act(async () => submission);
    assert.equal(commits, 0);
});

test('repeated submit during validation commits once and failures leave the form retryable', async () => {
    const check = deferred();
    let attempts = 0;
    let commits = 0;
    const errors = [];
    function Probe() {
        value = useServiceSave({
            onTest: async () => {
                attempts++;
                if (attempts === 1) throw new Error('unavailable');
                await check.promise;
            },
            onSave: () => commits++,
            onError: (error) => errors.push(error.message),
        });
        return null;
    }
    await act(async () => {
        renderer = create(React.createElement(Probe));
    });
    await act(async () => value[1]());
    assert.deepEqual(errors, ['unavailable']);
    assert.equal(value[0], false);
    let submission;
    await act(async () => {
        submission = value[1]();
        await value[1]();
    });
    check.resolve();
    await act(async () => submission);
    assert.equal(attempts, 2);
    assert.equal(commits, 1);
    assert.equal(value[0], false);
});

test('only a still-mounted form runs its close callback after persistence completes', async () => {
    let persistence = Promise.resolve();
    let closes = 0;
    function Probe() {
        value = useServiceSave({
            onSave: () => persistence,
            onSuccess: () => closes++,
            onError: (error) => {
                throw error;
            },
        });
        return null;
    }
    await act(async () => {
        renderer = create(React.createElement(Probe));
    });
    await act(async () => value[1]());
    assert.equal(closes, 1);
    const pending = deferred();
    persistence = pending.promise;
    let submission;
    await act(async () => {
        submission = value[1]();
    });
    await act(async () => renderer.unmount());
    pending.resolve();
    await act(async () => submission);
    assert.equal(closes, 1);
});

test('deleting a service cancels its pending enable-switch write', async () => {
    env.data.set('openai@deleted', { enable: true });
    await mount('openai@deleted', {}, { sync: true });
    await act(async () => value[1]({ enable: false }));
    await deleteKey('openai@deleted');
    await new Promise((r) => setTimeout(r, 550));
    assert.equal(env.data.has('openai@deleted'), false);
});

test('an explicit save supersedes an older debounced write from another consumer', async () => {
    env.data.set('openai@latest', { apiKey: 'old' });
    await mount('openai@latest', {}, { sync: true });
    await act(async () => value[1]({ apiKey: 'outdated' }));
    await act(async () => value[1]({ apiKey: 'saved' }, true));
    await new Promise((r) => setTimeout(r, 550));
    assert.equal(env.data.get('openai@latest').apiKey, 'saved');
});

test('a failed explicit save keeps the persisted list and visible state unchanged', async () => {
    env.data.set('translate_service_list', ['google']);
    await mount('translate_service_list', [], { sync: true });
    env.saveError = new Error('disk unavailable');
    await act(async () => {
        await assert.rejects(value[1](['google', 'openai@unsaved'], true), /disk unavailable/);
    });
    assert.deepEqual(value[0], ['google']);
    assert.deepEqual(env.data.get('translate_service_list'), ['google']);
    assert.ok(!env.writes.some(([operation]) => operation === 'emit'));
});

test('delete waits for an already-started enable write so it cannot resurrect the service', async () => {
    env.data.set('openai@inflight', { enable: true });
    await mount('openai@inflight', {}, { sync: true });
    env.setBarrier = deferred();
    await act(async () => value[1]({ enable: false }));
    await new Promise((r) => setTimeout(r, 550));
    let deletion;
    await act(async () => {
        deletion = deleteKey('openai@inflight');
        await Promise.resolve();
    });
    env.setBarrier.resolve();
    await act(async () => deletion);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(env.data.has('openai@inflight'), false);
});

test('changing the model endpoint discards old model-list responses', async () => {
    ({ useModelList } = await server.ssrLoadModule('/src/hooks/useModelList.js'));
    const old = deferred();
    env.fetch = () => old.promise;
    function Probe({ path }) {
        value = useModelList(path, 'test-key', {
            onLoaded() {},
            onError(error) {
                throw error;
            },
        });
        return null;
    }
    await act(async () => {
        renderer = create(React.createElement(Probe, { path: 'http://old.example/v1' }));
    });
    let fetchOld;
    await act(async () => {
        fetchOld = value[2]();
    });
    await act(async () => renderer.update(React.createElement(Probe, { path: 'http://new.example/v1' })));
    old.resolve({ ok: true, data: { data: [{ id: 'old-model' }] } });
    await act(async () => fetchOld);
    assert.deepEqual(value[0], []);
    assert.equal(value[1], false);
    env.fetch = async () => ({ ok: true, data: { data: [{ id: 'new-model' }] } });
    await act(async () => value[2]());
    assert.deepEqual(value[0], ['new-model']);
});
