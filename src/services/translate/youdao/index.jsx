import { fetch, Body, ResponseType } from '@tauri-apps/api/http';
import { nanoid } from 'nanoid';

function decodeHtml(html) {
    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.documentElement.textContent || '';
    }
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function getYoudaoType(from, to) {
    const map = {
        zh_cn: 'ZH_CN',
        zh_tw: 'ZH_CN',
        en: 'EN',
        ja: 'JA',
        ko: 'KR',
        fr: 'FR',
        es: 'SP',
        ru: 'RU',
    };
    const supported = [
        'ZH_CN2EN', 'ZH_CN2JA', 'ZH_CN2KR', 'ZH_CN2FR', 'ZH_CN2RU', 'ZH_CN2SP',
        'EN2ZH_CN', 'JA2ZH_CN', 'KR2ZH_CN', 'FR2ZH_CN', 'RU2ZH_CN', 'SP2ZH_CN',
    ];
    if (from === 'auto' || !from) {
        if (to === 'zh_cn' || to === 'zh_tw') return 'AUTO';
        if (map[to]) {
            const candidate = 'ZH_CN2' + map[to];
            if (supported.includes(candidate)) return candidate;
        }
        return 'AUTO';
    }
    const f = map[from];
    const t = map[to];
    if (f && t) {
        const pair = `${f}2${t}`;
        if (supported.includes(pair)) return pair;
    }
    return 'AUTO';
}

function truncate(q) {
    const len = q.length;
    if (len <= 20) return q;
    return q.substring(0, 10) + len + q.substring(len - 10, len);
}

async function sha256(str) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// 免费极速通道（无需 key、国内直连）
async function translateFree(text, from, to) {
    const url = 'https://m.youdao.com/translate';
    const type = getYoudaoType(from, to);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
                'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        },
        body: Body.form({
            inputtext: text,
            type: type,
        }),
        responseType: ResponseType.Text,
    });

    if (res.ok) {
        const html = res.data;
        const match = html.match(/<ul id="translateResult">([\s\S]*?)<\/ul>/i);
        if (match) {
            const lines = [...match[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) =>
                decodeHtml(m[1].trim())
            );
            return lines.join('\n').trim();
        }
        throw 'Translation result not found in response';
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

// 官方智云 OpenAPI 通道（配置了 appkey 和 key 时自动使用）
async function translateOfficial(text, from, to, appkey, key) {
    const officialLangMap = {
        auto: 'auto',
        zh_cn: 'zh-CHS',
        zh_tw: 'zh-CHT',
        en: 'en',
        ja: 'ja',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt_pt: 'pt',
        pt_br: 'pt',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
    };

    const qFrom = officialLangMap[from] || from || 'auto';
    const qTo = officialLangMap[to] || to || 'zh-CHS';

    const url = 'https://openapi.youdao.com/api';
    const curtime = String(Math.round(Date.now() / 1000));
    const salt = nanoid();
    const str1 = appkey + truncate(text) + salt + curtime + key;
    const sign = await sha256(str1);

    const res = await fetch(url, {
        method: 'GET',
        query: {
            q: text,
            from: qFrom,
            to: qTo,
            appKey: appkey,
            salt: salt,
            sign: sign,
            signType: 'v3',
            curtime: curtime,
        },
    });

    if (res.ok) {
        const result = res.data;
        if (result['errorCode'] && result['errorCode'] !== '0') {
            throw `Youdao API Error: code ${result['errorCode']}`;
        }
        if (result['isWord'] && result['basic']) {
            const target = { pronunciations: [], explanations: [], associations: [], sentence: [] };
            const basic = result['basic'];

            if (basic['uk-phonetic']) {
                let speech = await fetch(basic['uk-speech'], { method: 'GET', responseType: ResponseType.Binary });
                target.pronunciations.push({
                    region: 'UK',
                    symbol: basic['uk-phonetic'],
                    voice: speech.ok ? speech.data : '',
                });
            }
            if (basic['us-phonetic']) {
                let speech = await fetch(basic['us-speech'], { method: 'GET', responseType: ResponseType.Binary });
                target.pronunciations.push({
                    region: 'US',
                    symbol: basic['us-phonetic'],
                    voice: speech.ok ? speech.data : '',
                });
            }
            if (basic['phonetic'] && target.pronunciations.length === 0) {
                target.pronunciations.push({
                    region: '',
                    symbol: basic['phonetic'],
                    voice: '',
                });
            }
            if (basic['explains']) {
                for (let i of basic['explains']) {
                    let trait = '';
                    if (i.split(' ')[0].endsWith('.')) {
                        trait = i.split(' ')[0];
                    }
                    let explains = i.replace(trait, '').trim();
                    target.explanations.push({ trait, explains: explains.split('；') });
                }
            }
            return target;
        } else if (result['translation']) {
            return result['translation'].join('\n').trim();
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export async function translate(text, from, to, options = {}) {
    text = text.trim();
    if (!text) return '';

    const { config } = options;
    const appkey = config?.appkey?.trim();
    const key = config?.key?.trim();

    if (appkey && key) {
        return await translateOfficial(text, from, to, appkey, key);
    } else {
        return await translateFree(text, from, to);
    }
}

export * from './Config';
export * from './info';
