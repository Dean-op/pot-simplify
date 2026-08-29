import { initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import zh_CN from './locales/zh_CN.json';
import en_US from './locales/en_US.json';

// http://www.lingoes.net/zh/translator/langcode.htm

// 19 个 JSON 全静态 import 的话会一起塞进主 chunk，不管界面语言是哪一种
// 都要解析。这里只内联兜底用的 en / zh_cn，其余按需加载。
// 文件名和 i18n 的 key 对不上（ja -> ja_JP），所以显式列表；顺便也就不会
// 把 locales 目录里没在用的文件打进产物。
const lazyLocales = {
    zh_tw: () => import('./locales/zh_TW.json'),
    ja: () => import('./locales/ja_JP.json'),
    ko: () => import('./locales/ko_KR.json'),
    fr: () => import('./locales/fr_FR.json'),
    es: () => import('./locales/es_ES.json'),
    ru: () => import('./locales/ru_RU.json'),
    de: () => import('./locales/de_DE.json'),
    it: () => import('./locales/it_IT.json'),
    tr: () => import('./locales/tr_TR.json'),
    pt_pt: () => import('./locales/pt_PT.json'),
    pt_br: () => import('./locales/pt_BR.json'),
    nb_no: () => import('./locales/nb_NO.json'),
    nn_no: () => import('./locales/nn_NO.json'),
    fa: () => import('./locales/fa_IR.json'),
    uk: () => import('./locales/uk_UA.json'),
    ar: () => import('./locales/ar_AE.json'),
    he: () => import('./locales/he_IL.json'),
};

// 互为兜底的语言得一起加载，否则缺 key 时会直接掉到 en，而不是同语系
// 的那一个。zh_tw 的兜底是 zh_cn、已经内联了；反方向 zh_cn -> zh_tw 没有
// 列进来——zh_CN 是这个项目的母本，没必要为它多拉一个 9 KB 的文件。
const fallbackGroups = {
    pt_pt: ['pt_br'],
    pt_br: ['pt_pt'],
    nb_no: ['nn_no'],
    nn_no: ['nb_no'],
};

const loaded = new Set(['en', 'zh_cn']);

async function loadOne(lng) {
    if (loaded.has(lng) || !lazyLocales[lng]) {
        return;
    }
    const resource = await lazyLocales[lng]();
    i18n.addResourceBundle(lng, 'translation', resource.default.translation, true, true);
    loaded.add(lng);
}

// 切界面语言之前先把对应的资源装上，再 changeLanguage
export async function loadLanguage(lng) {
    await Promise.all([lng, ...(fallbackGroups[lng] ?? [])].map(loadOne));
}

i18n.use(initReactI18next).init({
    fallbackLng: {
        zh_tw: ['zh_cn'],
        zh_cn: ['zh_tw'],
        pt_pt: ['pt_br'],
        pt_br: ['pt_pt'],
        nb_no: ['nn_no'],
        nn_no: ['nb_no'],
        default: ['en'],
    },
    debug: false,
    interpolation: {
        escapeValue: false,
    },
    resources: {
        en: en_US,
        zh_cn: zh_CN,
    },
});

export default i18n;
