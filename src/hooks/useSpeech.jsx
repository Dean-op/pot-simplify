import { useCallback } from 'react';

// pot 内部语言码 → BCP-47。喂给 SpeechSynthesisUtterance.lang，系统据此挑
// 对应语言的语音包。用 WebView2（Edge 内核）自带的 speechSynthesis，走的是
// Windows 系统语音：离线、免费、零依赖。
const LANG_MAP = {
    zh_cn: 'zh-CN',
    zh_tw: 'zh-TW',
    en: 'en-US',
    ja: 'ja-JP',
    ko: 'ko-KR',
    fr: 'fr-FR',
    es: 'es-ES',
    ru: 'ru-RU',
    de: 'de-DE',
    it: 'it-IT',
    tr: 'tr-TR',
    pt_pt: 'pt-PT',
    pt_br: 'pt-BR',
    vi: 'vi-VN',
    id: 'id-ID',
    th: 'th-TH',
    ms: 'ms-MY',
    ar: 'ar-SA',
    hi: 'hi-IN',
    km: 'km-KH',
    mn_cy: 'mn-MN',
    mn_mo: 'mn-MN',
    nb_no: 'nb-NO',
    nn_no: 'nn-NO',
    fa: 'fa-IR',
    sv: 'sv-SE',
    pl: 'pl-PL',
    nl: 'nl-NL',
    uk: 'uk-UA',
    he: 'he-IL',
};

// auto 或未知语种时按字符集粗判一下，主要覆盖中日韩；判不出就交给系统默认语音。
function guessBcp47(text) {
    if (/[一-鿿]/.test(text)) return 'zh-CN';
    if (/[぀-ヿ]/.test(text)) return 'ja-JP';
    if (/[가-힯]/.test(text)) return 'ko-KR';
    return '';
}

function resolveBcp47(lang, text) {
    return LANG_MAP[lang] || guessBcp47(text ?? '');
}

/**
 * 朗读任意文字（识别结果、译文、原文）。返回的 speak(text, lang) 是开关语义：
 * 正在读时再点一次就停，和词典发音用的 useVoice 保持一致的交互。
 * lang 传 pot 内部语言码（如 'zh_cn' / 'en' / 'auto'）。
 */
export const useSpeech = () => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

    return useCallback(
        (text, lang) => {
            if (!synth) return;
            // 正在读（或排队中）就当作「停止」
            if (synth.speaking || synth.pending) {
                synth.cancel();
                return;
            }
            const content = (text ?? '').trim();
            if (content === '') return;

            const utterance = new SpeechSynthesisUtterance(content);
            const bcp47 = resolveBcp47(lang, content);
            if (bcp47) {
                utterance.lang = bcp47;
                // 尽量挑同语言的语音，免得用错口音的默认语音念外语。
                // getVoices() 首次可能为空（语音包异步加载），那就只靠 lang 让系统自选。
                const voices = synth.getVoices();
                const prefix = bcp47.split('-')[0];
                const match =
                    voices.find((v) => v.lang === bcp47) ||
                    voices.find((v) => v.lang.replace('_', '-').startsWith(prefix));
                if (match) {
                    utterance.voice = match;
                }
            }
            synth.speak(utterance);
        },
        [synth]
    );
};
