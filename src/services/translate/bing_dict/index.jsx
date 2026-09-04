import { fetch } from '@tauri-apps/api/http';

import { formatHttpError } from '../../../utils/http_error';
import { isSentence } from '../../../utils';

export async function translate(text, from, to) {
    if (isSentence(text)) {
        return '';
    }

    if (from === 'auto') {
        if (/^[\u4e00-\u9fff]/.test(text)) {
            from = 'zh-cn';
        } else if (/^[A-Za-z]/.test(text)) {
            from = 'en-us';
        }
    }
    if (from === to) {
        return text;
    }

    const query = (text ?? '').trim().replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
    if (!query) {
        return '';
    }

    const res = await fetch(`https://cn.bing.com/dict/search?q=${encodeURIComponent(query)}&mkt=zh-cn`, {
        method: 'GET',
        headers: {
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        responseType: 2,
    });

    if (!res.ok) {
        throw formatHttpError(res.status, res.data);
    }

    const doc = new DOMParser().parseFromString(res.data, 'text/html');
    const qdef = doc.querySelector('.qdef');
    if (!qdef) {
        throw `Words not yet included: ${query}`;
    }

    let target = { pronunciations: [], explanations: [], associations: [], sentence: [] };

    // Pronunciations
    const usNode = qdef.querySelector('.hd_prUS');
    const usAudio = qdef.querySelector('#bigaud_us')?.getAttribute('data-mp3link');
    if (usNode) {
        const symbol = usNode.textContent.replace(/^美\s*/, '').trim();
        target.pronunciations.push({
            region: '美',
            symbol,
            voice: usAudio ? (usAudio.startsWith('http') ? usAudio : `https://cn.bing.com${usAudio}`) : '',
        });
    }

    const ukNode = qdef.querySelector('.hd_pr');
    const ukAudio = qdef.querySelector('#bigaud_uk')?.getAttribute('data-mp3link');
    if (ukNode) {
        const symbol = ukNode.textContent.replace(/^英(?:国)?\s*/, '').trim();
        target.pronunciations.push({
            region: '英',
            symbol,
            voice: ukAudio ? (ukAudio.startsWith('http') ? ukAudio : `https://cn.bing.com${ukAudio}`) : '',
        });
    }

    // Chinese pinyin if neither US nor UK is present
    if (target.pronunciations.length === 0) {
        const pinyinNode = qdef.querySelector('.hd_p1_1');
        if (pinyinNode) {
            const pyMatch = pinyinNode.textContent.match(/\[([^\]]+)\]/);
            if (pyMatch) {
                target.pronunciations.push({
                    region: '',
                    symbol: `[${pyMatch[1].trim()}]`,
                    voice: '',
                });
            }
        }
    }

    // Explanations: <ul><li><span class="pos">...</span><span class="def...">...</span></li>...</ul>
    const liNodes = qdef.querySelectorAll('ul li');
    for (const li of liNodes) {
        const posNode = li.querySelector('.pos');
        const defNode = li.querySelector('.def');
        if (defNode) {
            const trait = posNode ? posNode.textContent.trim() : '';
            const rawDef = defNode.textContent.trim();
            const explains = rawDef
                .split(/[；;]/)
                .map((x) => x.trim())
                .filter(Boolean);
            if (explains.length > 0) {
                target.explanations.push({ trait, explains });
            }
        }
    }

    // Associations (变形)
    const hdIf = doc.querySelector('.hd_if');
    if (hdIf) {
        const assocText = hdIf.textContent.replace(/\s+/g, ' ').trim();
        if (assocText) {
            target.associations.push(assocText);
        }
    }

    // Sentences: #sentenceSeg .se_li
    const seLiNodes = doc.querySelectorAll('#sentenceSeg .se_li');
    let sentCount = 0;
    for (const seLi of seLiNodes) {
        if (sentCount >= 3) break;
        const enNode = seLi.querySelector('.sen_en');
        const cnNode = seLi.querySelector('.sen_cn');
        if (enNode && cnNode) {
            const source = enNode.textContent.replace(/\s+/g, ' ').trim();
            const targetText = cnNode.textContent.replace(/\s+/g, ' ').trim();
            if (source) {
                target.sentence.push({
                    source,
                    target: targetText,
                });
                sentCount++;
            }
        }
    }

    // Fetch pronunciation audio binary
    for (let i of target.pronunciations) {
        if (i.voice) {
            try {
                const audioRes = await fetch(i.voice, { responseType: 3 });
                if (audioRes.ok) {
                    i.voice = audioRes.data;
                } else {
                    i.voice = '';
                }
            } catch {
                i.voice = '';
            }
        }
    }

    return target;
}

export * from './Config';
export * from './info';

