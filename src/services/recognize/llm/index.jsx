import { fetch, Body } from '@tauri-apps/api/http';
import { buildChatCompletionsUrl, buildThinkingParams, formatApiError } from '../../../utils/llm_provider';
import { defaultPrompt, defaultRequestArguments } from './Config';
import { Language } from './info';

// 视觉模型常把结果包在 ```...``` 里，去掉围栏。
// 流式输出时每来一段都要清一次，此时结尾的围栏可能只到了一半，
// 那就先留着，等它补全或者流结束再被下一次调用清掉。
function stripFences(text) {
    return text
        .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
}

/**
 * 用 OpenAI 兼容的视觉模型做 OCR。
 * base64 由 Rust 侧 cmd.rs::get_base64() 提供，是裸 base64（不带 data: 前缀）的 PNG。
 *
 * options.setResult 存在时走流式，边收边往界面上写；不存在（比如配置页的连通性
 * 测试）也照样能流，只是攒完再返回。
 */
export async function recognize(base64, lang, options = {}) {
    const { config, setResult } = options;
    const { requestPath, model, apiKey, prompt, requestArguments, thinkingMode, stream } = config;

    // 老配置里没有 stream 字段，按开启算：识别的是整屏文字，
    // 攒完再显示会让人干等好几秒，而流式第一行通常一秒内就到了。
    const useStream = stream !== false;

    const apiUrl = buildChatCompletionsUrl(requestPath);

    const langName = Language[lang] ?? Language.auto;
    const promptText = (prompt ?? defaultPrompt).replaceAll('$lang', langName);

    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
    };

    const body = {
        ...JSON.parse(requestArguments ?? defaultRequestArguments),
        // 放在 requestArguments 之后：下拉框是显式选的，优先级高于手写参数。
        // 老配置里没有 thinkingMode，按「强制关闭」算——OCR 只要照抄图里的字，
        // 思考链纯粹是在首字之前空烧几百个 token。
        ...buildThinkingParams(requestPath, thinkingMode ?? 'off'),
        model,
        stream: useStream,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: promptText },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
                ],
            },
        ],
    };

    if (useStream) {
        // 走浏览器原生 fetch 才拿得到 ReadableStream；窗口都带
        // --disable-web-security，跨域没问题。
        const res = await window.fetch(apiUrl.href, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw `Http Request Error\n${formatApiError(res.status, await res.json().catch(() => null))}`;
        }

        let target = '';
        const handleLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) {
                return;
            }
            const payload = trimmed.slice(5).trim();
            if (payload === '' || payload === '[DONE]') {
                return;
            }
            let chunk;
            try {
                chunk = JSON.parse(payload);
            } catch {
                // 服务端偶尔会插入非 JSON 的心跳行，跳过而不是让整次识别失败
                return;
            }
            // 只取 content；reasoning_content 是思考链，不属于识别结果
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta !== '') {
                target += delta;
                if (setResult) {
                    setResult(stripFences(target));
                }
            }
        };

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        // 一条 SSE 消息可能被拆到两个 TCP 包里，buffer 存上一轮没读完的尾巴
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // 最后一段可能是半行，留到下一轮
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

        const result = stripFences(target);
        if (setResult) {
            setResult(result);
        }
        return result;
    }

    const res = await fetch(apiUrl.href, {
        method: 'POST',
        headers,
        body: Body.json(body),
    });

    if (!res.ok) {
        throw `Http Request Error\n${formatApiError(res.status, res.data)}`;
    }

    const choices = res.data?.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        throw JSON.stringify(res.data);
    }
    const content = choices[0]?.message?.content;
    if (typeof content !== 'string') {
        throw JSON.stringify(choices);
    }

    return stripFences(content);
}

export * from './Config';
export * from './info';
