use crate::config::StoreWrapper;
use crate::error::Error;
use crate::StringWrapper;
use crate::APP;
use log::{error, info, warn};
use tauri::Manager;

// 截图缓存都放在 %LOCALAPPDATA%\<identifier>\ 下
fn cache_file(app_handle: &tauri::AppHandle, name: &str) -> std::path::PathBuf {
    use dirs::cache_dir;
    let mut path = cache_dir().expect("Get Cache Dir Failed");
    path.push(&app_handle.config().tauri.bundle.identifier);
    path.push(name);
    path
}

// 这些 PNG 只在本机流转（识别窗口显示、剪贴板、发给模型），image 默认的
// 最高压缩率能在一张大图上吃掉上百毫秒，纯属浪费，统一用最快档。
fn encode_png_fast<W: std::io::Write>(
    writer: W,
    img: &image::RgbaImage,
) -> Result<(), image::ImageError> {
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ExtendedColorType, ImageEncoder};

    PngEncoder::new_with_quality(writer, CompressionType::Fast, FilterType::Adaptive).write_image(
        img.as_raw(),
        img.width(),
        img.height(),
        ExtendedColorType::Rgba8,
    )
}

fn save_png_fast(path: &std::path::Path, img: &image::RgbaImage) -> Result<(), image::ImageError> {
    use std::fs::File;
    use std::io::BufWriter;

    encode_png_fast(BufWriter::new(File::create(path)?), img)
}

// 视觉模型是按像素数收 token 的（Qwen-VL 每 28×28 一个），一张 1440p 的截图
// 光是上传加 prefill 就要好几秒，而认字并不需要这么高的分辨率。超过上限就等
// 比缩到上限；没超、或者尺寸都读不出来，返回 None 让调用方用原图，连解码都省。
//
// 只缩发给模型的这一份，磁盘上的 cut png 保持原样——复制图片和识别窗口里的
// 预览都指着它。
fn shrink_png(png: &[u8], max_edge: u32) -> Option<Vec<u8>> {
    use image::imageops::FilterType;
    use std::io::Cursor;

    // 先只读文件头拿尺寸，不解整张图
    let (width, height) = image::ImageReader::new(Cursor::new(png))
        .with_guessed_format()
        .ok()?
        .into_dimensions()
        .ok()?;
    let long_edge = width.max(height);
    if long_edge <= max_edge {
        return None;
    }

    let scale = max_edge as f64 / long_edge as f64;
    let new_width = ((width as f64 * scale).round() as u32).max(1);
    let new_height = ((height as f64 * scale).round() as u32).max(1);
    let img = image::load_from_memory(png).ok()?.to_rgba8();
    // Triangle：缩小文字比 Nearest 干净得多，又比 Lanczos3 快
    let resized = image::imageops::resize(&img, new_width, new_height, FilterType::Triangle);
    info!(
        "Shrink image: {}x{} -> {}x{}",
        width, height, new_width, new_height
    );

    let mut out = Cursor::new(Vec::new());
    encode_png_fast(&mut out, &resized).ok()?;
    Some(out.into_inner())
}

#[tauri::command]
pub fn get_text(state: tauri::State<StringWrapper>) -> String {
    return state.0.lock().unwrap().to_string();
}

#[tauri::command]
pub fn reload_store() {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let mut store = state.0.lock().unwrap();
    store.load().unwrap();
}

// async：不加的话命令跑在主线程上，裁图的这几十毫秒会把事件循环堵住，
// 识别窗口的创建只能排在后面。
#[tauri::command(async)]
pub fn cut_image(left: u32, top: u32, width: u32, height: u32, app_handle: tauri::AppHandle) {
    use crate::screenshot::LAST_SCREENSHOT;
    use image::{imageops, RgbaImage};
    info!("Cut image: {}x{}+{}+{}", width, height, left, top);

    // 优先用 screenshot() 留在内存里的原始像素；拿不到（比如中途重启过）
    // 再退回去解那张全屏 PNG
    let cached = LAST_SCREENSHOT
        .lock()
        .unwrap()
        .take()
        .and_then(|(w, h, rgba)| RgbaImage::from_raw(w, h, rgba));
    let full = match cached {
        Some(v) => v,
        None => {
            warn!("Screenshot pixels not cached, decoding png instead");
            let path = cache_file(&app_handle, "pot_simplify_screenshot.png");
            if !path.exists() {
                return;
            }
            match image::open(&path) {
                Ok(v) => v.to_rgba8(),
                Err(e) => {
                    error!("{:?}", e.to_string());
                    return;
                }
            }
        }
    };

    // 越界保护：框选坐标是前端拿 dpi 换算出来的，取整之后可能多出一两个像素
    if left >= full.width() || top >= full.height() {
        error!("Cut area out of screen: {}x{}", full.width(), full.height());
        return;
    }
    let width = width.min(full.width() - left);
    let height = height.min(full.height() - top);
    if width == 0 || height == 0 {
        return;
    }

    let cut = imageops::crop_imm(&full, left, top, width, height).to_image();
    let path = cache_file(&app_handle, "pot_simplify_screenshot_cut.png");
    if let Err(e) = save_png_fast(&path, &cut) {
        error!("{:?}", e.to_string());
    }
}

// max_edge：发给模型的图片长边上限，前端传 maxEdge（Tauri 会转成 snake_case）。
// 传 0 或者不传就是不限制。
#[tauri::command(async)]
pub fn get_base64(app_handle: tauri::AppHandle, max_edge: Option<u32>) -> String {
    use base64::{engine::general_purpose, Engine as _};
    use std::fs;

    let path = cache_file(&app_handle, "pot_simplify_screenshot_cut.png");
    if !path.exists() {
        return "".to_string();
    }
    // 直接读 cut_image 刚写下去的 PNG：省一次解码 + 重新编码
    let vec = match fs::read(&path) {
        Ok(v) => v,
        Err(e) => {
            error!("{:?}", e.to_string());
            return "".to_string();
        }
    };
    let vec = match max_edge {
        Some(max_edge) if max_edge > 0 => shrink_png(&vec, max_edge).unwrap_or(vec),
        _ => vec,
    };
    general_purpose::STANDARD.encode(&vec)
}

#[tauri::command]
pub fn copy_img(app_handle: tauri::AppHandle, width: usize, height: usize) -> Result<(), Error> {
    use arboard::{Clipboard, ImageData};
    use image::ImageReader;
    use std::borrow::Cow;

    let path = cache_file(&app_handle, "pot_simplify_screenshot_cut.png");
    let data = ImageReader::open(path)?.decode()?;

    let img = ImageData {
        width,
        height,
        bytes: Cow::from(data.as_bytes()),
    };
    let result = Clipboard::new()?.set_image(img)?;
    Ok(result)
}

#[tauri::command]
pub fn font_list() -> Result<Vec<String>, Error> {
    use font_kit::source::SystemSource;
    let source = SystemSource::new();

    Ok(source.all_families()?)
}

#[tauri::command]
pub fn open_devtools(window: tauri::Window) {
    if !window.is_devtools_open() {
        window.open_devtools();
    } else {
        window.close_devtools();
    }
}
