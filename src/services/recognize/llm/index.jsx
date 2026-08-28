import { fetch, Body } from '@tauri-apps/api/http';
import { buildChatCompletionsUrl, formatApiError } from '../../../utils/llm_provider';
import { defaultPrompt, defaultRequestArguments } from './Config';
import { Language } from './info';

/**
 * 用 OpenAI 兼容的视觉模型做 OCR。
 * base64 由 Rust 侧 cmd.rs::get_base64() 提供，是裸 base64（不带 data: 前缀）的 PNG。
 */
export async function recognize(base64, lang, options = {}) {
    const { config } = options;
    const { requestPath, model, apiKey, prompt, requestArguments } = config;

    const apiUrl = buildChatCompletionsUrl(requestPath);

    const langName = Language[lang] ?? Language.auto;
    const promptText = (prompt ?? defaultPrompt).replaceAll('$lang', langName);

    const body = {
        ...JSON.parse(requestArguments ?? defaultRequestArguments),
        model,
        stream: false,
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

    const res = await fetch(apiUrl.href, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
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

    // 视觉模型常把结果包在 ```...``` 里，去掉围栏
    return content
        .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
}

export * from './Config';
export * from './info';
