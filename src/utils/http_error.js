import i18next from 'i18next';

// 这些免费接口出错时经常回一整页 HTML —— 谷歌的反爬提示页、nginx 的 405/502
// 默认页。原来各家服务都是直接 `JSON.stringify(res.data)` 丢给界面，用户看到的
// 是一坨转义后的 HTML 源码，既看不出发生了什么，也不知道下一步该干什么。
// 这里统一压成几行：状态码 + 一句人话 + 该服务专属的处置建议。

const isHtmlBody = (data) => typeof data === 'string' && /^\s*<[!a-z]/i.test(data);

// 服务端塞在 JSON 里的错误描述，OpenAI 系和多数网关都在这两个位置之一。
const pickMessage = (data) => {
    const message = data?.error?.message ?? data?.message;
    return typeof message === 'string' && message !== '' ? message : '';
};

const MAX_RAW_LENGTH = 200;

/**
 * 把失败的 HTTP 响应压成一行人能读的报错。
 *
 * @param {number} status      HTTP 状态码
 * @param {*} data             tauri http 插件按 content-type 解析后的响应体
 * @param {string} hintKey     处置建议的 i18n key，留空则不加建议行
 * @param {object} hintOptions 传给 i18next 的插值变量
 */
export function formatHttpError(status, data, hintKey = '', hintOptions = undefined) {
    const lines = [`Http Status: ${status}`];

    const message = pickMessage(data);
    if (message) {
        lines.push(message);
    } else if (isHtmlBody(data)) {
        lines.push(i18next.t('services.http_error.html_page'));
    } else if (data !== undefined && data !== null && data !== '') {
        // 既不是 HTML 又没有标准错误字段，原样带上（截断），至少留下可排查的信息。
        const raw = typeof data === 'string' ? data : JSON.stringify(data);
        lines.push(raw.length > MAX_RAW_LENGTH ? raw.slice(0, MAX_RAW_LENGTH) + '…' : raw);
    }

    if (hintKey) {
        lines.push(i18next.t(hintKey, hintOptions));
    }
    return lines.join('\n');
}
