import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let MarkdownText;
let translate;

before(async () => {
    server = await createServer({
        configFile: false,
        cacheDir: 'node_modules/.vite-markdown-tests',
        server: { middlewareMode: true },
        appType: 'custom',
        plugins: [
            {
                name: 'skip-config-ui-in-service-tests',
                enforce: 'pre',
                resolveId(source, importer) {
                    if (
                        source === './Config' &&
                        importer?.replaceAll('\\', '/').endsWith('/translate/openai/index.jsx')
                    ) {
                        return '\0translation-config-test';
                    }
                },
                load(id) {
                    if (id === '\0translation-config-test') {
                        return 'export const defaultRequestArguments = "{}";';
                    }
                },
            },
        ],
    });
    MarkdownText = (await server.ssrLoadModule('/src/components/MarkdownText/index.jsx')).default;
    translate = (await server.ssrLoadModule('/src/services/translate/openai/index.jsx')).translate;
});

after(async () => {
    await server?.close();
});

function render(text, props = {}) {
    return renderToStaticMarkup(React.createElement(MarkdownText, { text, ...props }));
}

test('translation text renders headings, emphasis, lists, quotes and code instead of Markdown markers', () => {
    const html = render(
        '### Results\n\n**Important**\n\n- First\n- Second\n\n> Quote\n\n---\n\n```js\nconst n = 1;\n```'
    );
    for (const expected of [
        '<h3>Results</h3>',
        '<strong>Important</strong>',
        '<ul>',
        '<blockquote>',
        '<hr/>',
        '<pre>',
    ]) {
        assert.ok(html.includes(expected), `Missing rendered element: ${expected}`);
    }
    assert.ok(!html.includes('<textarea'));
});

test('translation preview supports GitHub tables and task lists', () => {
    const html = render('| Name | Value |\n| --- | --- |\n| Test | 42 |\n\n- [x] Done\n\n~~Removed~~');
    assert.ok(html.includes('<table>'));
    assert.ok(html.includes('<td>42</td>'));
    assert.ok(html.includes('type="checkbox"'));
    assert.ok(html.includes('<del>Removed</del>'));
});

test('source view preserves the original Markdown and escapes HTML', () => {
    const text = '### Title\n\n**Bold**\n\n<script>alert(1)</script>';
    const html = render(text, { showSource: true });
    assert.ok(html.includes('<pre'));
    assert.ok(html.includes('### Title\n\n**Bold**'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<h3>'));
});

test('preview cannot execute raw HTML or load remote images', () => {
    const html = render(
        '<script>alert(1)</script>\n\n<img src="https://example.com/pixel" onerror="alert(1)">\n\n![Diagram](https://example.com/image.png)'
    );
    assert.ok(!html.includes('<script'));
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('onerror='));
    assert.ok(html.includes('Diagram'));
});

test('only absolute HTTP and HTTPS links are clickable', () => {
    const html = render(
        '[Safe](https://example.com/a?b=1)\n\n[HTTP](http://example.com)\n\n[Script](javascript:alert%281%29)\n\n[File](file:///C:/secret)\n\n[Mail](mailto:test@example.com)\n\n[Relative](/path)\n\n[Protocol-relative](//example.com)'
    );
    assert.ok(html.includes('href="https://example.com/a?b=1"'));
    assert.ok(html.includes('href="http://example.com/"'));
    assert.equal((html.match(/<a /g) ?? []).length, 2);
    assert.ok(!html.includes('href="javascript:'));
    assert.ok(html.includes('Relative'));
});

test('incomplete streamed Markdown remains readable and an empty result does not fail', () => {
    assert.ok(render('**Still streaming').includes('Still streaming'));
    assert.ok(render('```js\nconst value =').includes('const value ='));
    assert.ok(!render('').includes('<textarea'));
});

const config = {
    service: 'openai',
    requestPath: 'https://example.com/v1',
    apiKey: 'test-key',
    model: 'test-model',
    stream: true,
    thinkingMode: 'auto',
    promptList: [
        { role: 'system', content: 'Custom translation instruction.' },
        { role: 'user', content: 'Translate $text from $from to $to ($detect).' },
    ],
    requestArguments: '{}',
};

async function withStream(chunks, run, byteChunkSize = 0) {
    const previous = globalThis.window;
    let request;
    globalThis.window = {
        fetch: async (_url, options) => {
            request = JSON.parse(options.body);
            const encoder = new TextEncoder();
            return new Response(
                new ReadableStream({
                    start(controller) {
                        const frames = [];
                        for (const chunk of chunks) {
                            frames.push(
                                encoder.encode(
                                    `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`
                                )
                            );
                        }
                        frames.push(encoder.encode('data: [DONE]\n\n'));
                        for (const frame of frames) {
                            if (byteChunkSize > 0) {
                                for (let i = 0; i < frame.length; i += byteChunkSize) {
                                    controller.enqueue(frame.slice(i, i + byteChunkSize));
                                }
                            } else {
                                controller.enqueue(frame);
                            }
                        }
                        controller.close();
                    },
                })
            );
        },
    };
    try {
        await run(() => request);
    } finally {
        globalThis.window = previous;
    }
}

test('streaming translation does not insert an underscore into Markdown content', async () => {
    await withStream(['**Impor', 'tant**'], async () => {
        const updates = [];
        const result = await translate('Important', 'English', 'Chinese', {
            config,
            setResult: (text) => updates.push(text),
            detect: 'en',
        });
        assert.deepEqual(updates, ['**Impor', '**Important**', '**Important**']);
        assert.equal(result, '**Important**');
    });
});

test('existing custom prompts get Markdown preservation rules without overwriting saved configuration', async () => {
    await withStream(['Done'], async (request) => {
        const original = structuredClone(config);
        const text = '### Title\n\n`code()`\n\n[Link](https://example.com)';
        await translate(text, 'English', 'Chinese', { config, setResult: () => {}, detect: 'en' });
        assert.ok(request().messages[0].content.startsWith('Custom translation instruction.'));
        assert.match(request().messages[0].content, /Markdown/);
        assert.equal(request().messages[1].content, `Translate ${text} from English to Chinese (English).`);
        assert.deepEqual(config, original);
    });
});

test('streaming connectivity checks return the completed translation even without a UI callback', async () => {
    await withStream(['Hello', ' world'], async () => {
        const result = await translate('test', 'English', 'Chinese', { config, detect: 'en' });
        assert.equal(result, 'Hello world');
    });
});

test('streaming preserves UTF-8, whitespace and data: inside Markdown across byte boundaries', async () => {
    const text = '### 中文\n\n```txt\n data: keep exactly \n```';
    await withStream(
        [text],
        async () => {
            const updates = [];
            const result = await translate('test', 'English', 'Chinese', {
                config,
                detect: 'en',
                setResult: (value) => updates.push(value),
            });
            assert.equal(result, text);
            assert.equal(updates.at(-1), text);
        },
        1
    );
});

test('formatting rules also apply when a custom prompt has no system message', async () => {
    const custom = { ...config, promptList: [{ role: 'user', content: 'Translate $text' }] };
    await withStream(['Done'], async (request) => {
        await translate('text', 'English', 'Chinese', { config: custom, detect: 'en' });
        assert.equal(request().messages[0].role, 'system');
        assert.match(request().messages[0].content, /Preserve Markdown/);
        assert.deepEqual(custom.promptList, [{ role: 'user', content: 'Translate $text' }]);
    });
});
