import { fetch } from '@tauri-apps/api/http';

import { formatHttpError } from '../../../utils/http_error';

const DISPLAY_FORMAT_DEFAULT = '发音, 快速释义, 变形';

export async function translate(text, from, to) {
    if (from == 'auto') {
        if (/^[\u4e00-\u9fff]/.test(text)) {
            from = 'zh-cn';
        } else if (/^[A-Za-z]/.test(text)) {
            from = 'en-us';
        }
    }
    if (from == to) {
        return text;
    }
    // only supports word translation
    // if (text.split(/[\s,，]/).length > 1) {
    //     return '';
    // }

    // 这个 appid 是从必应词典网页里抠出来的内部 key，不是申请来的。微软已经把它
    // 停用了：带不带浏览器 UA、带不带 Referer 都回 403 Disabled，换出口 IP 也一样，
    // 也就是说对所有人都失效，不是限流。要救活得改成抓 cn.bing.com/dict/search 的
    // 网页（那个还是 200），属于重写而不是改 bug。
    const res = await fetch(
        `https://www.bing.com/api/v6/dictionarywords/search?q=${text}&appid=371E7B2AF0F9B84EC491D731DF90A55719C7D209&mkt=zh-cn&pname=bingdict`
    );
    if (res.ok) {
        const result = res.data;
        const meaningGroups = result.value[0].meaningGroups;
        if (meaningGroups.length === 0) {
            throw `Words not yet included: ${text}`;
        }
        const formats = DISPLAY_FORMAT_DEFAULT.trim().split(/,\s*/);
        const formatGroups = meaningGroups.reduce(
            (acc, cur) => {
                const group = acc[cur.partsOfSpeech?.[0]?.description || cur.partsOfSpeech?.[0]?.name];
                if (Array.isArray(group)) {
                    group.push(cur);
                }
                return acc;
            },
            formats.reduce((acc, cur) => {
                acc[cur] = [];
                return acc;
            }, {})
        );
        let target = { pronunciations: [], explanations: [], associations: [], sentence: [] };
        for (const pronunciation of formatGroups['发音']) {
            target.pronunciations.push({
                region: pronunciation.partsOfSpeech[0].name,
                symbol: pronunciation.meanings[0].richDefinitions[0].fragments[0].text,
                voice: '',
            });
        }
        for (const explanation of formatGroups['快速释义']) {
            target.explanations.push({
                trait: explanation.partsOfSpeech[0].name,
                explains: explanation.meanings[0].richDefinitions[0].fragments.map((x) => {
                    return x.text;
                }),
            });
        }
        if (formatGroups['变形'][0]) {
            for (const association of formatGroups['变形'][0].meanings[0].richDefinitions[0].fragments) {
                target.associations.push(association.text);
            }
        }
        return target;
    } else {
        throw formatHttpError(
            res.status,
            res.data,
            res.status === 401 || res.status === 403 ? 'services.http_error.bing_dict_disabled' : ''
        );
    }
}

export * from './Config';
export * from './info';
