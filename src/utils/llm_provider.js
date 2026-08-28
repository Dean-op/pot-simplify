import { fetch } from '@tauri-apps/api/http';

/**
 * OpenAI 兼容端点的提供商预设。
 * base 填到 /v1 为止，实际请求路径由 buildChatCompletionsUrl 补全。
 */
export const PROVIDER_PRESETS = [
    {
        key: 'bailian',
        label: '阿里百炼',
        base: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        console: 'https://bailian.console.aliyun.com/',
    },
    {
        key: 'siliconflow',
        label: '硅基流动',
        base: 'https://api.siliconflow.cn/v1/chat/completions',
        console: 'https://cloud.siliconflow.cn/',
    },
    {
        key: 'openai',
        label: 'OpenAI',
        base: 'https://api.openai.com/v1/chat/completions',
        console: 'https://platform.openai.com/',
    },
    {
        key: 'custom',
        label: '自定义',
        base: '',
        console: '',
    },
];

function parseUrl(requestPath) {
    let path = (requestPath ?? '').trim();
    if (path === '') {
        throw 'Request path is empty';
    }
    if (!/^https?:\/\//.test(path)) {
        path = `https://${path}`;
    }
    return new URL(path);
}

/**
 * 把用户填的地址补全成 /chat/completions。
 * 支持三种写法：
 *   https://host                       -> https://host/v1/chat/completions
 *   https://host/v1                    -> https://host/v1/chat/completions
 *   https://host/v1/chat/completions    -> 原样
 * 注意百炼的 base 本身以 /v1 结尾，不能无条件再补一个 v1。
 */
export function buildChatCompletionsUrl(requestPath) {
    const url = parseUrl(requestPath);
    let path = url.pathname.replace(/\/+$/, '');
    if (!path.endsWith('/chat/completions')) {
        path = path.endsWith('/v1') ? `${path}/chat/completions` : `${path}/v1/chat/completions`;
    }
    url.pathname = path;
    return url;
}

/** 由同一个地址推导出 /models 列表接口 */
export function buildModelsUrl(requestPath) {
    const url = parseUrl(requestPath);
    let path = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    if (!path.endsWith('/v1')) {
        path = `${path}/v1`;
    }
    url.pathname = `${path}/models`;
    return url;
}

/** 把 OpenAI 兼容端点的错误响应压成一行可读文本 */
export function formatApiError(status, data) {
    const message = data?.error?.message ?? data?.message;
    if (typeof message === 'string' && message !== '') {
        return `Http Status: ${status}\n${message}`;
    }
    return `Http Status: ${status}\n${JSON.stringify(data)}`;
}

/** 拉取模型列表，返回排好序的 model id 数组 */
export async function fetchModelList(requestPath, apiKey) {
    const url = buildModelsUrl(requestPath);
    const res = await fetch(url.href, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
        throw formatApiError(res.status, res.data);
    }
    const list = res.data?.data;
    if (!Array.isArray(list)) {
        throw JSON.stringify(res.data);
    }
    return list
        .map((item) => item?.id)
        .filter((id) => typeof id === 'string' && id !== '')
        .sort((a, b) => a.localeCompare(b));
}
