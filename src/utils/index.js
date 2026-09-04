export const debounce = (fn, delay = 500) => {
    let timer = null;
    return (...args) => {
        timer && clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

/**
 * 判断文本是否属于长句或整段，若是则不应调用词典接口。
 * 词典接口仅适用于单词和简短词组（如 look up、as well as）。
 */
export const isSentence = (text) => {
    if (!text) return true;
    const trimmed = text.trim();
    if (!trimmed) return true;

    // 包含换行，必定是多行长句或段落
    if (/[\r\n]/.test(trimmed)) {
        return true;
    }

    // 去掉首尾常见的标点符号（如引号、括号、句末点等，避免划词划多了标点导致误判）
    const clean = trimmed.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '').trim();
    if (!clean) return true;

    // 总长度过长（词组几乎不可能超过 40 个字符）
    if (clean.length > 40) {
        return true;
    }

    // 内部含有明显的句子分界标点（句号、逗号、分号、冒号、问号、叹号等）
    if (/[。！？，、；：!?]/.test(clean) || /[,:;]\s/.test(clean) || /\.\s+[A-Za-z]/.test(clean)) {
        return true;
    }

    // 按空格分词（西文字符）
    const words = clean.split(/\s+/).filter(Boolean);
    // 词组通常在 4 个单词以内，超过 4 个词必是句子
    if (words.length > 4) {
        return true;
    }

    // 针对无空格语言（中文、日文等），词组/成语极少超过 8 个字
    // 如果不含空格且包含 CJK 字符，长度超过 8 则视为句子
    if (words.length === 1 && /[\u4e00-\u9fff\u3040-\u30ff]/.test(clean) && clean.length > 8) {
        return true;
    }

    return false;
};

