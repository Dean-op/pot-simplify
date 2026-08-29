export const info = {
    name: 'llm',
    icon: 'logo/openai.svg',
    // 要把图片本身发给模型，识别之前必须先把 base64 取过来
    needImageData: true,
};

// 值会被塞进 prompt 的 $lang 占位符，所以用英文语言名而不是内部语种码
export enum Language {
    auto = 'Auto',
    zh_cn = 'Simplified Chinese',
    zh_tw = 'Traditional Chinese',
    yue = 'Cantonese',
    ja = 'Japanese',
    en = 'English',
    ko = 'Korean',
    fr = 'French',
    es = 'Spanish',
    ru = 'Russian',
    de = 'German',
    it = 'Italian',
    tr = 'Turkish',
    pt_pt = 'Portuguese',
    pt_br = 'Brazilian Portuguese',
    vi = 'Vietnamese',
    id = 'Indonesian',
    th = 'Thai',
    ms = 'Malay',
    ar = 'Arabic',
    hi = 'Hindi',
    km = 'Khmer',
    fa = 'Persian',
    sv = 'Swedish',
    pl = 'Polish',
    nl = 'Dutch',
    uk = 'Ukrainian',
    he = 'Hebrew',
}
