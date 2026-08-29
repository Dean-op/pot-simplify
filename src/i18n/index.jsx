import { initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import zh_CN from './locales/zh_CN.json';
import en_US from './locales/en_US.json';

// http://www.lingoes.net/zh/translator/langcode.htm

// 界面语言只留中英两种，两个 JSON 直接内联——加起来 20 KB 左右，按需加载
// 省下的那点体积不值得多一次异步等待。
export const APP_LANGUAGES = ['zh_cn', 'en'];

// 老配置里可能存着 ja / pt_br 之类已经删掉的语言，落到 i18next 会直接掉到
// en。这里显式收敛一次，让「显示语言」下拉框也能显示出实际生效的那个。
export function normalizeLanguage(lng) {
    return APP_LANGUAGES.includes(lng) ? lng : 'en';
}

// 保留这个入口：调用方（App.jsx / 常规设置页）不需要知道资源是内联还是
// 按需加载，将来要再加语言也只改这个文件。
export function changeLanguage(lng) {
    return i18n.changeLanguage(normalizeLanguage(lng));
}

i18n.use(initReactI18next).init({
    fallbackLng: 'en',
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
