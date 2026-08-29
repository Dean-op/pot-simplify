export const info = {
    name: 'system',
    icon: `system`,
    // Rust 侧直接读缓存目录里的 PNG，不用前端把几 MB 的 base64 再搬一趟
    needImageData: false,
};

export enum Language {
    auto = 'auto',
    zh_cn = 'zh_cn',
    zh_tw = 'zh_tw',
    en = 'en',
    ja = 'ja',
    ko = 'ko',
    fr = 'fr',
    es = 'es',
    ru = 'ru',
    de = 'de',
    it = 'it',
    tr = 'tr',
    pt_pt = 'pt_pt',
    pt_br = 'pt_br',
    vi = 'vi',
    id = 'id',
    th = 'th',
    ms = 'ms',
    ar = 'ar',
    hi = 'hi',
    uk = 'uk',
    he = 'he',
}
