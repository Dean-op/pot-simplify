import { fetch } from '@tauri-apps/api/http';

import { formatHttpError } from '../../../utils/http_error';
import { isSentence } from '../../../utils';

export async function translate(text, _from, _to) {
    if (isSentence(text)) {
        return '';
    }

    const query = (text ?? '').trim().replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
    if (!query) {
        return '';
    }

    const res = await fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });

    if (!res.ok) {
        throw formatHttpError(res.status, res.data);
    }

    const data = res.data;
    const target = { pronunciations: [], explanations: [], associations: [], sentence: [] };

    // 1. English -> Chinese (data.ec or data.simple)
    const ec = data?.ec?.word?.[0];
    const simple = data?.simple?.word?.[0];

    if (ec || simple) {
        const usphone = ec?.usphone || simple?.usphone;
        const ukphone = ec?.ukphone || simple?.ukphone;
        const usspeech = ec?.usspeech || simple?.usspeech;
        const ukspeech = ec?.ukspeech || simple?.ukspeech;

        if (usphone) {
            target.pronunciations.push({
                region: '美',
                symbol: `[${usphone}]`,
                voice: usspeech ? `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(usspeech)}` : '',
            });
        }
        if (ukphone) {
            target.pronunciations.push({
                region: '英',
                symbol: `[${ukphone}]`,
                voice: ukspeech ? `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(ukspeech)}` : '',
            });
        }

        if (ec?.trs) {
            for (const trItem of ec.trs) {
                const line = trItem.tr?.[0]?.l?.i?.[0];
                if (line && typeof line === 'string') {
                    const posMatch = line.match(/^([a-zA-Z]+\.)\s*(.*)$/);
                    if (posMatch) {
                        const trait = posMatch[1];
                        const explains = posMatch[2]
                            .split(/[；;,，]/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        target.explanations.push({ trait, explains });
                    } else {
                        target.explanations.push({
                            trait: '',
                            explains: line
                                .split(/[；;,，]/)
                                .map((s) => s.trim())
                                .filter(Boolean),
                        });
                    }
                }
            }
        }

        if (ec?.wfs) {
            const inflections = [];
            for (const wf of ec.wfs) {
                if (wf.wf?.name && wf.wf?.value) {
                    inflections.push(`${wf.wf.name}: ${wf.wf.value}`);
                }
            }
            if (inflections.length > 0) {
                target.associations.push(inflections.join('  '));
            }
        }
    }

    // 2. Chinese -> English (data.ce)
    const ce = data?.ce?.word?.[0];
    if (ce && target.explanations.length === 0) {
        if (ce.phone) {
            target.pronunciations.push({
                region: '',
                symbol: `[${ce.phone}]`,
                voice: '',
            });
        }
        if (ce.trs) {
            for (const trItem of ce.trs) {
                const tr = trItem.tr?.[0]?.l;
                if (tr) {
                    const trait = tr.pos || '';
                    const tran = tr['#tran'] || '';
                    let explains = [];
                    if (Array.isArray(tr.i)) {
                        explains = tr.i
                            .map((x) => (typeof x === 'object' ? x['#text'] : x))
                            .filter(Boolean);
                    }
                    if (explains.length === 0 && tran) {
                        explains = tran
                            .split(/[；;,，]/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                    }
                    if (explains.length > 0) {
                        target.explanations.push({ trait, explains });
                    }
                }
            }
        }
    }

    // 3. Sentences: blng_sents_part
    if (data?.blng_sents_part?.['sentence-pair']) {
        let count = 0;
        for (const pair of data.blng_sents_part['sentence-pair']) {
            if (count >= 3) break;
            const source = pair.sentence;
            const targetText = pair['sentence-translation'];
            if (source && targetText) {
                target.sentence.push({
                    source: source.replace(/<[^>]+>/g, ''),
                    target: targetText,
                });
                count++;
            }
        }
    }

    if (target.explanations.length === 0) {
        throw `Words not yet included: ${query}`;
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

