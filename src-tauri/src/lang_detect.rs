use lingua::{Language, LanguageDetector, LanguageDetectorBuilder};
use once_cell::sync::Lazy;

// lingua 的 Language 枚举变体是由 Cargo.toml 里的 feature 决定的，
// 所以这个列表必须和 features 一致；下面 match 能穷尽也是靠这一点。
// 增删语种时：Cargo.toml features、这个数组、match 分支三处要一起改。
//
// 只留中日英。模型是 include_dir! 嵌进二进制的 brotli 数据，22 个语种
// 合计 20.12 MB，这三个只有 1.18 MB（english 1.13、chinese 0.03、
// japanese 0.02），省下约 18.9 MB。
//
// 代价：本地检测只认这三种。非拉丁文字（俄语、阿拉伯语、泰语等）会因为
// 字符集对不上任何一个语种而返回 None，落到下面的兜底 "en"；其他拉丁语系
// （法语、德语、越南语……）会被判成英语。本地引擎现在是默认引擎（原来是
// 百度，一次 HTTP 会把翻译的首字节时间整体推后一个 RTT），所以判错的面比
// 之前大，但影响仍然有限——检测结果只用于三处：界面上那个语言标签、译文
// 语言与检测语言相同时自动切到第二目标语言、以及系统 OCR 判断是否是中文
// 好去掉空格。真正发给翻译服务的 sourceLanguage 始终是 auto，不会因为检测
// 错了就把源语言标错；第二目标语言默认也是 en，所以「俄语被判成 en」在默认
// 配置下不会真的换掉目标语言。要更准就去设置里把引擎改回百度/谷歌。
const LANGUAGES: [Language; 3] = [Language::Chinese, Language::Japanese, Language::English];

// 原来 lang_detect 每次调用都 build 一遍检测器，划词翻译每输入一次
// 就重建所有语种的模型；init_lang_detect 里预热出来的那个又是局部
// 变量，用完就丢。这里做成全局静态，预热和调用共用同一个实例。
static DETECTOR: Lazy<LanguageDetector> =
    Lazy::new(|| LanguageDetectorBuilder::from_languages(&LANGUAGES).build());

pub fn init_lang_detect() {
    let _ = DETECTOR.detect_language_of("Hello Language");
}

#[tauri::command]
pub fn lang_detect(text: &str) -> Result<&str, ()> {
    if let Some(lang) = DETECTOR.detect_language_of(text) {
        match lang {
            Language::Chinese => Ok("zh_cn"),
            Language::Japanese => Ok("ja"),
            Language::English => Ok("en"),
        }
    } else {
        Ok("en")
    }
}
