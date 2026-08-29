use lingua::{Language, LanguageDetector, LanguageDetectorBuilder};
use once_cell::sync::Lazy;

// lingua 的 Language 枚举变体是由 Cargo.toml 里的 feature 决定的，
// 所以这个列表必须和 features 一致；下面 match 能穷尽也是靠这一点。
// 增删语种时：Cargo.toml features、这个数组、match 分支三处要一起改。
const LANGUAGES: [Language; 22] = [
    Language::Chinese,
    Language::Japanese,
    Language::English,
    Language::Korean,
    Language::French,
    Language::Spanish,
    Language::German,
    Language::Russian,
    Language::Italian,
    Language::Portuguese,
    Language::Turkish,
    Language::Arabic,
    Language::Vietnamese,
    Language::Thai,
    Language::Indonesian,
    Language::Malay,
    Language::Hindi,
    Language::Mongolian,
    Language::Bokmal,
    Language::Nynorsk,
    Language::Persian,
    Language::Ukrainian,
];

// 原来 lang_detect 每次调用都 build 一遍检测器，划词翻译每输入一次
// 就重建 22 个语种的模型；init_lang_detect 里预热出来的那个又是局部
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
            Language::Korean => Ok("ko"),
            Language::French => Ok("fr"),
            Language::Spanish => Ok("es"),
            Language::German => Ok("de"),
            Language::Russian => Ok("ru"),
            Language::Italian => Ok("it"),
            Language::Portuguese => Ok("pt_pt"),
            Language::Turkish => Ok("tr"),
            Language::Arabic => Ok("ar"),
            Language::Vietnamese => Ok("vi"),
            Language::Thai => Ok("th"),
            Language::Indonesian => Ok("id"),
            Language::Malay => Ok("ms"),
            Language::Hindi => Ok("hi"),
            Language::Mongolian => Ok("mn_cy"),
            Language::Bokmal => Ok("nb_no"),
            Language::Nynorsk => Ok("nn_no"),
            Language::Persian => Ok("fa"),
            Language::Ukrainian => Ok("uk"),
        }
    } else {
        Ok("en")
    }
}
