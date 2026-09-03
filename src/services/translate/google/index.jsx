import { fetch } from '@tauri-apps/api/http';

import { formatHttpError } from '../../../utils/http_error';

// 谷歌这套 translate_a/single 有好几个入口，路径、参数、返回结构完全一样，
// 但各自归在不同的配额/反爬桶里，被限流的时机也不一样：
//   · translate.googleapis.com + client=gtx            —— API host
//   · clients5.google.com      + client=dict-chrome-ex —— Chrome 内置词典扩展走的入口
//   · translate.google.com     + client=gtx            —— 网页版所在的 host，挡着
//     Google 的网页反爬层，共用出口 IP 时最容易整片 429，所以排最后
//
// 单靠猜哪个入口能通没有意义：同一条出口 IP 上今天通的明天可能就不通。所以按
// 顺序试，某个入口回 429/403/5xx 就换下一个。注意这不是对同一个桶重试（那只会
// 把限流捅得更深），是换桶，最多三次、不循环。三个都不行基本就说明整条出口 IP
// 被判了，那是网络层的事，客户端再怎么改都绕不过去。
const ENDPOINTS = [
    { url: 'https://translate.googleapis.com', client: 'gtx' },
    { url: 'https://clients5.google.com', client: 'dict-chrome-ex' },
    { url: 'https://translate.google.com', client: 'gtx' },
];

export const DEFAULT_URL = ENDPOINTS[0].url;

// 存着这三个内置入口里的任何一个，都当「没自定义」处理，照旧走上面的轮换。
// 只有用户真填了别的镜像才固定用那一个 —— 那是明确的选择，不该替他改。
const BUILTIN_HOST_PATTERN =
    /^(?:https?:\/\/)?(?:translate\.googleapis\.com|clients5\.google\.com|translate\.google\.com)$/i;

// 设置页显示用：只把空值和历史默认值收敛掉，用户自己填过的照原样显示。
const LEGACY_URL_PATTERN = /^(?:https?:\/\/)?translate\.google\.com$/i;

const withScheme = (url) => (url.startsWith('http') ? url : 'https://' + url);
const tidy = (url) => (url ?? '').trim().replace(/\/+$/, '');

// 换个入口还有戏的状态码：429 限流、403 直接拒、5xx 那一家自己抽风。
const shouldFallback = (status) => status === 429 || status === 403 || status >= 500;

export function normalizeCustomUrl(custom_url) {
    const url = tidy(custom_url);
    return url === '' || LEGACY_URL_PATTERN.test(url) ? DEFAULT_URL : withScheme(url);
}

function resolveEndpoints(custom_url) {
    const url = tidy(custom_url);
    if (url === '' || BUILTIN_HOST_PATTERN.test(url)) {
        return ENDPOINTS;
    }
    return [{ url: withScheme(url), client: 'gtx' }];
}

// 上一次成功的入口。轮换本身能把限流绕过去，但如果每次翻译都从头撞一遍 429，
// 等于每句话白付一个往返 —— 走代理的时候这一个往返尤其贵。所以命中一次之后就
// 把它提到最前面。只记在内存里，重启重新探测：换了代理节点、限流恢复了都能自己
// 适应，也不用往 config.json 里塞状态。
let preferred = null;

function ordered(endpoints) {
    const first = preferred && endpoints.find((e) => e.url === preferred);
    return first ? [first, ...endpoints.filter((e) => e !== first)] : endpoints;
}

function request(endpoint, text, from, to) {
    return fetch(`${endpoint.url}/translate_a/single?dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t`, {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        query: {
            client: endpoint.client,
            sl: from,
            tl: to,
            hl: to,
            ie: 'UTF-8',
            oe: 'UTF-8',
            otf: '1',
            ssel: '0',
            tsel: '0',
            kc: '7',
            q: text,
        },
    });
}

function parse(result) {
    // 词典模式
    if (result[1]) {
        let target = { pronunciations: [], explanations: [], associations: [], sentence: [] };
        // 发音
        if (result[0][1][3]) {
            target.pronunciations.push({ symbol: result[0][1][3], voice: '' });
        }
        // 释义
        for (let i of result[1]) {
            target.explanations.push({
                trait: i[0],
                explains: i[2].map((x) => {
                    return x[0];
                }),
            });
        }
        // 例句
        if (result[13]) {
            for (let i of result[13][0]) {
                target.sentence.push({ source: i[0] });
            }
        }
        return target;
    }
    // 翻译模式
    let target = '';
    for (let r of result[0]) {
        if (r[0]) {
            target = target + r[0];
        }
    }
    return target.trim();
}

export async function translate(text, from, to, options = {}) {
    const { config } = options;
    const endpoints = ordered(resolveEndpoints(config?.custom_url));

    let last = null;
    for (const endpoint of endpoints) {
        const res = await request(endpoint, text, from, to);
        if (res.ok) {
            preferred = endpoint.url;
            return parse(res.data);
        }
        last = res;
        if (!shouldFallback(res.status)) {
            break;
        }
    }

    // 三个都没成，说明这条出口 IP 整体被判了，下次别再从上次那个开始。
    preferred = null;

    // 报错里带上试过哪些入口：不写清楚的话，下次再出问题根本分不清是某一个桶
    // 被限流，还是整条出口 IP 都被判了。
    const hosts = endpoints.map((e) => e.url.replace(/^https?:\/\//, '')).join(', ');
    throw formatHttpError(
        last.status,
        last.data,
        shouldFallback(last.status) ? 'services.http_error.google_blocked' : '',
        {
            hosts,
        }
    );
}

export * from './Config';
export * from './info';
