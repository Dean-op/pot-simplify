import detect from '../../../utils/lang_detect';
import { invoke } from '@tauri-apps/api';
import { Language } from './info';

export async function recognize(_, lang) {
    const windowsLangMap = {
        auto: 'auto',
        zh_cn: 'zh-CN',
        zh_tw: 'zh-TW',
        en: 'en-US',
        yue: 'zh-HK',
        ja: 'ja-JP',
        ko: 'ko-KR',
        fr: 'fr-FR',
        es: 'es-ES',
        ru: 'ru-RU',
        de: 'de-DE',
        it: 'it-IT',
        tr: 'tr-TR',
        pt: 'pt-PT',
        pt_br: 'pt-BR',
        vi: 'vi-VN',
        id: 'id-ID',
        th: 'th-TH',
        ms: 'ms-MY',
        ar: 'ar-SA',
        hi: 'hi-IN',
        uk: 'uk-UA',
        he: 'he-IL',
    };
    let result = await invoke('system_ocr', { lang: windowsLangMap[lang] });
    // Windows OCR 会在中日文字之间插空格，按识别结果的语种去掉
    if (lang === Language.auto && (await detect(result)) === Language.zh_cn) {
        result = result.replaceAll(' ', '');
    } else if (lang === Language.zh_cn || lang === Language.zh_tw || lang === Language.ja) {
        result = result.replaceAll(' ', '');
    }
    return result.trim();
}

export * from './Config';
export * from './info';
