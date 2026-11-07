import { fetch, Body } from '@tauri-apps/api/http';
import { buildChatCompletionsUrl, buildThinkingParams, formatApiError } from '../../../utils/llm_provider';
import { Language } from './info';
import { defaultRequestArguments } from './Config';

export async function translate(text, from, to, options) {
    const { config, setResult, detect } = options;

    let { service, requestPath, model, apiKey, stream, promptList, requestArguments, thinkingMode } = config;

    // azure 的地址是完整的 deployment 路径，不做补全；openai 兼容端点统一补到 /chat/completions
    let apiUrl;
    if (service === 'openai') {
        apiUrl = buildChatCompletionsUrl(requestPath);
    } else {
        apiUrl = new URL(/^https?:\/\//.test(requestPath) ? requestPath : `https://${requestPath}`);
    }

    // 兼容旧版
    if (promptList === undefined) {
        promptList = [
            {
                role: 'system',
                content:
                    'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
            },
            { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
        ];
    }

    promptList = promptList.map((item) => {
        return {
            ...item,
            content: item.content
                .replaceAll('$text', text)
                .replaceAll('$from', from)
                .replaceAll('$to', to)
                .replaceAll('$detect', Language[detect]),
        };
    });

    // Apply formatting rules to existing instances without replacing saved custom prompts.
    const markdownInstruction =
        'Preserve Markdown structure and line breaks, including headings, emphasis, lists, tables and blockquotes. ' +
        'Translate only prose; keep code, inline code, URLs and link destinations unchanged. ' +
        'Do not wrap the entire translation in a Markdown code fence or add explanations.';
    const systemIndex = promptList.findIndex((item) => item.role === 'system');
    if (systemIndex >= 0) {
        promptList[systemIndex].content += '\n\n' + markdownInstruction;
    } else {
        promptList.unshift({ role: 'system', content: markdownInstruction });
    }

    const headers =
        service === 'openai'
            ? {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
              }
            : {
                  'Content-Type': 'application/json',
                  'api-key': apiKey,
              };
    const body = {
        ...JSON.parse(requestArguments ?? defaultRequestArguments),
        // 放在 requestArguments 之后：开关是显式选的，优先级高于手写参数；
        // 想完全交给手写参数控制就把开关选成「跟随模型默认」，那时这里返回空对象。
        // 旧配置里没有 thinkingMode，按「强制关闭」处理——本来就是为了提速加的。
        ...buildThinkingParams(requestPath, thinkingMode ?? 'off'),
        stream: stream,
        messages: promptList,
    };
    if (service === 'openai') {
        body['model'] = model;
    }
    if (stream) {
        const res = await window.fetch(apiUrl.href, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });
        if (res.ok) {
            let target = '';
            const handleLine = (line) => {
                if (!line.startsWith('data:')) return;
                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') return;
                let chunk;
                try {
                    chunk = JSON.parse(payload);
                } catch {
                    return;
                }
                const content = chunk.choices?.[0]?.delta?.content;
                if (typeof content === 'string' && content !== '') {
                    target += content;
                    setResult?.(target);
                }
            };
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                // Keep partial SSE lines and UTF-8 characters until the next network chunk.
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';
                    for (const line of lines) {
                        handleLine(line);
                    }
                }
                buffer += decoder.decode();
                for (const line of buffer.split('\n')) {
                    handleLine(line);
                }
            } finally {
                reader.releaseLock();
            }
            setResult?.(target.trim());
            return target.trim();
        } else {
            throw `Http Request Error\n${formatApiError(res.status, await res.json().catch(() => null))}`;
        }
    } else {
        let res = await fetch(apiUrl.href, {
            method: 'POST',
            headers: headers,
            body: Body.json(body),
        });
        if (res.ok) {
            let result = res.data;
            const { choices } = result;
            if (choices) {
                let target = choices[0].message.content.trim();
                if (target) {
                    if (target.startsWith('"')) {
                        target = target.slice(1);
                    }
                    if (target.endsWith('"')) {
                        target = target.slice(0, -1);
                    }
                    return target.trim();
                } else {
                    throw JSON.stringify(choices);
                }
            } else {
                throw JSON.stringify(result);
            }
        } else {
            throw `Http Request Error\n${formatApiError(res.status, res.data)}`;
        }
    }
}

export * from './Config';
export * from './info';
