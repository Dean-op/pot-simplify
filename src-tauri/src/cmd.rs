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

// 视觉模型按像素数和长边收 token，同时发给模型的图片如果是无损 PNG，
// 一张 1080p 截图就有数 MB，Base64 膨胀后严重拖慢网络上传（上行带宽通常只有 10~30Mbps）。
// 这里把发给模型的图片转为 JPEG（Quality 85），体积直降 80%~90%（从数 MB 降到 100~300KB），
// 若超过 max_edge 还会等比缩小，大幅缩减上传时间与模型 ViT 编码开销。
// 磁盘上的原图（pot_simplify_screenshot_cut.png）依然保留无损 PNG，供本地 UI 预览和剪贴板复制。
fn to_jpeg(png_bytes: &[u8], max_edge: Option<u32>, quality: u8) -> Result<Vec<u8>, image::ImageError> {
    use image::codecs::jpeg::JpegEncoder;
    use image::imageops::FilterType;
    use image::{ExtendedColorType, ImageEncoder};
    use std::io::Cursor;

    let img = image::load_from_memory(png_bytes)?;
    let (width, height) = (img.width(), img.height());
    let long_edge = width.max(height);

    let rgb_img = if let Some(max_edge) = max_edge {
        if max_edge > 0 && long_edge > max_edge {
            let scale = max_edge as f64 / long_edge as f64;
            let new_width = ((width as f64 * scale).round() as u32).max(1);
            let new_height = ((height as f64 * scale).round() as u32).max(1);
            info!(
                "Shrink and convert image for LLM: {}x{} -> {}x{}",
                width, height, new_width, new_height
            );
            let resized = image::imageops::resize(&img.to_rgba8(), new_width, new_height, FilterType::Triangle);
            image::DynamicImage::ImageRgba8(resized).into_rgb8()
        } else {
            img.into_rgb8()
        }
    } else {
        img.into_rgb8()
    };

    let mut out = Cursor::new(Vec::new());
    JpegEncoder::new_with_quality(&mut out, quality).write_image(
        rgb_img.as_raw(),
        rgb_img.width(),
        rgb_img.height(),
        ExtendedColorType::Rgb8,
    )?;
    Ok(out.into_inner())
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
    let vec = match fs::read(&path) {
        Ok(v) => v,
        Err(e) => {
            error!("{:?}", e.to_string());
            return "".to_string();
        }
    };
    // 发给模型前转为高质量 JPEG（Quality 85）并根据 max_edge 缩放，体积暴降 80%~90%
    let jpeg = to_jpeg(&vec, max_edge, 85).unwrap_or(vec);
    general_purpose::STANDARD.encode(&jpeg)
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
