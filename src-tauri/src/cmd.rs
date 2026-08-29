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

// 这两个 PNG 只给本机的识别窗口和剪贴板用，image 默认的最高压缩率
// 能在一张大图上吃掉上百毫秒，纯属浪费，统一用最快档。
fn save_png_fast(path: &std::path::Path, img: &image::RgbaImage) -> Result<(), image::ImageError> {
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ExtendedColorType, ImageEncoder};
    use std::fs::File;
    use std::io::BufWriter;

    let writer = BufWriter::new(File::create(path)?);
    PngEncoder::new_with_quality(writer, CompressionType::Fast, FilterType::Adaptive).write_image(
        img.as_raw(),
        img.width(),
        img.height(),
        ExtendedColorType::Rgba8,
    )
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

#[tauri::command(async)]
pub fn get_base64(app_handle: tauri::AppHandle) -> String {
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
