use crate::cmd::cache_file;
use crate::config::get;
use arboard::Clipboard;
use image::{imageops, GrayImage};
use log::{info, warn};
use std::panic::{catch_unwind, AssertUnwindSafe};
use tauri::api::notification::Notification;
use tauri::api::shell;
use tauri::Manager;
use url::Url;

const CUT_IMAGE_NAME: &str = "pot_simplify_screenshot_cut.png";
const MAX_UPSCALED_PIXELS: u64 = 12_000_000;

#[derive(Debug)]
enum QrError {
    MissingImage,
    ReadImage(String),
    NotFound,
    NotUrl,
}

pub fn scan_selection(app_handle: &tauri::AppHandle) {
    match decode_qr_url(app_handle) {
        Ok(url) => {
            info!("QR code URL: {}", url);
            if let Err(e) = Clipboard::new().and_then(|mut clipboard| clipboard.set_text(&url)) {
                warn!("Failed to copy QR code URL: {}", e);
            }
            if let Err(e) = shell::open(&app_handle.shell_scope(), &url, None) {
                warn!("Failed to open QR code URL: {}", e);
                notify(
                    app_handle,
                    text("二维码网址", "QR Code URL"),
                    &format!(
                        "{}\n{}",
                        text(
                            "识别成功，但打开浏览器失败。",
                            "Decoded successfully, but the browser could not be opened."
                        ),
                        url
                    ),
                );
            } else {
                notify(
                    app_handle,
                    text("已打开二维码网址", "QR Code URL Opened"),
                    &url,
                );
            }
        }
        Err(QrError::NotFound) => notify(
            app_handle,
            text("未识别到二维码", "No QR Code Found"),
            text(
                "请框选完整、清晰的二维码后重试。",
                "Select a complete, clear QR code and try again.",
            ),
        ),
        Err(QrError::NotUrl) => notify(
            app_handle,
            text("二维码内容不是网址", "QR Code Is Not a URL"),
            text(
                "目前只识别以 http:// 或 https:// 开头的网址。",
                "Only http:// and https:// URLs are supported.",
            ),
        ),
        Err(QrError::MissingImage) => notify(
            app_handle,
            text("二维码识别失败", "QR Code Scan Failed"),
            text(
                "截图文件不存在，请重新框选。",
                "The screenshot file is missing. Please scan again.",
            ),
        ),
        Err(QrError::ReadImage(e)) => {
            warn!("Failed to read QR code image: {}", e);
            notify(
                app_handle,
                text("二维码识别失败", "QR Code Scan Failed"),
                text(
                    "二维码图片读取失败，请重新框选。",
                    "The screenshot could not be read. Please scan again.",
                ),
            );
        }
    }
}

fn decode_qr_url(app_handle: &tauri::AppHandle) -> Result<String, QrError> {
    let path = cache_file(app_handle, CUT_IMAGE_NAME);
    if !path.exists() {
        return Err(QrError::MissingImage);
    }

    let image =
        image::open(&path).map_err(|e| QrError::ReadImage(format!("{}: {}", path.display(), e)))?;
    let gray = image.to_luma8();
    let mut found_payload = false;

    if let Some(url) = decode_candidate(&gray, &mut found_payload) {
        return Ok(url);
    }

    for factor in [2, 3] {
        let Some(scaled) = upscale(&gray, factor) else {
            continue;
        };
        if let Some(url) = decode_candidate(&scaled, &mut found_payload) {
            return Ok(url);
        }
        let mut inverted = scaled;
        imageops::invert(&mut inverted);
        if let Some(url) = decode_candidate(&inverted, &mut found_payload) {
            return Ok(url);
        }
    }

    let mut inverted = gray;
    imageops::invert(&mut inverted);
    if let Some(url) = decode_candidate(&inverted, &mut found_payload) {
        return Ok(url);
    }

    if found_payload {
        Err(QrError::NotUrl)
    } else {
        Err(QrError::NotFound)
    }
}

fn upscale(gray: &GrayImage, factor: u32) -> Option<GrayImage> {
    let width = gray.width().checked_mul(factor)?;
    let height = gray.height().checked_mul(factor)?;
    let pixels = width as u64 * height as u64;
    if width == 0 || height == 0 || pixels > MAX_UPSCALED_PIXELS {
        return None;
    }

    Some(imageops::resize(
        gray,
        width,
        height,
        imageops::FilterType::Triangle,
    ))
}

fn decode_candidate(gray: &GrayImage, found_payload: &mut bool) -> Option<String> {
    for payload in decode_payloads(gray) {
        *found_payload = true;
        if let Some(url) = parse_http_url(&payload) {
            return Some(url);
        }
    }
    None
}

fn decode_payloads(gray: &GrayImage) -> Vec<String> {
    let width = gray.width() as usize;
    let height = gray.height() as usize;
    let raw = gray.as_raw();

    let result = catch_unwind(AssertUnwindSafe(|| {
        let mut prepared =
            rqrr::PreparedImage::prepare_from_greyscale(width, height, |x, y| raw[y * width + x]);
        prepared
            .detect_grids()
            .into_iter()
            .filter_map(|grid| grid.decode().ok().map(|(_, text)| text))
            .collect::<Vec<_>>()
    }));

    match result {
        Ok(payloads) => payloads,
        Err(_) => {
            warn!("QR decoder panicked while processing the selected image");
            Vec::new()
        }
    }
}

fn parse_http_url(payload: &str) -> Option<String> {
    let url = Url::parse(payload.trim()).ok()?;
    match url.scheme() {
        "http" | "https" if url.host_str().is_some() => Some(url.to_string()),
        _ => None,
    }
}

fn text<'a>(zh: &'a str, en: &'a str) -> &'a str {
    let is_zh = get("app_language")
        .and_then(|value| value.as_str().map(|language| language == "zh_cn"))
        .unwrap_or(false);
    if is_zh {
        zh
    } else {
        en
    }
}

fn notify(app_handle: &tauri::AppHandle, title: &str, body: &str) {
    if let Err(e) = Notification::new(&app_handle.config().tauri.bundle.identifier)
        .title(title)
        .body(body)
        .icon("pot-simplify")
        .show()
    {
        warn!("Failed to show QR code notification: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_payloads, parse_http_url};
    use image::{imageops, GrayImage, Luma};

    #[test]
    fn accepts_http_urls() {
        assert!(parse_http_url("https://example.com/a?b=1").is_some());
        assert!(parse_http_url("  HTTP://example.com  ").is_some());
    }

    #[test]
    fn rejects_non_http_payloads() {
        assert!(parse_http_url("www.example.com").is_none());
        assert!(parse_http_url("mailto:test@example.com").is_none());
        assert!(parse_http_url("plain text").is_none());
    }

    #[test]
    fn decodes_qr_and_rejects_inverted_input() {
        let mut gray = qr_fixture();
        assert_eq!(decode_payloads(&gray), vec!["HELLO WORLD".to_string()]);

        imageops::invert(&mut gray);
        assert!(decode_payloads(&gray).is_empty());
    }

    #[test]
    fn decodes_upscaled_small_qr() {
        let gray = qr_fixture();
        let small = imageops::resize(&gray, 140, 140, imageops::FilterType::Nearest);
        let upscaled = imageops::resize(&small, 420, 420, imageops::FilterType::Triangle);
        assert_eq!(decode_payloads(&upscaled), vec!["HELLO WORLD".to_string()]);
    }

    #[test]
    fn decodes_url_qr() {
        let modules = [
            "111111101111101111111",
            "100000100101001000001",
            "101110100110001011101",
            "101110100111001011101",
            "101110100010101011101",
            "100000100001101000001",
            "111111101010101111111",
            "000000001111100000000",
            "110110100110101000001",
            "011111001010110001110",
            "111101101100010101111",
            "011001011111010100100",
            "010111111110010000010",
            "000000001100111011110",
            "111111100110100110100",
            "100000100011001001101",
            "101110101110000110010",
            "101110101011011101100",
            "101110100110110111111",
            "100000101001001111111",
            "111111101110111111000",
        ];
        let gray = render_modules(&modules);
        let payloads = decode_payloads(&gray);
        assert_eq!(
            payloads
                .iter()
                .find_map(|payload| parse_http_url(payload)),
            Some("https://a.co/".to_string())
        );
    }

    fn qr_fixture() -> GrayImage {
        // 17x17 version-1 QR: "HELLO WORLD"
        let modules = [
            "111111100100101111111",
            "100000101001001000001",
            "101110100100001011101",
            "101110101001001011101",
            "101110100011101011101",
            "100000101110101000001",
            "111111101010101111111",
            "000000000011100000000",
            "111110111100110101010",
            "001010011010110011111",
            "110100111001000101001",
            "010111000100000100000",
            "001001111001000000100",
            "000000001011111001011",
            "111111101110101011101",
            "100000100011111100110",
            "101110101010100001110",
            "101110101010100101100",
            "101110101101010011000",
            "100000101000000000101",
            "111111101101010010000",
        ];
        render_modules(&modules)
    }

    fn render_modules(modules: &[&str]) -> GrayImage {
        let scale = 10;
        let quiet = 4;
        let side = (modules.len() as u32 + quiet * 2) * scale;
        let mut gray = GrayImage::from_pixel(side, side, Luma([255]));
        for (y, row) in modules.iter().enumerate() {
            for (x, bit) in row.bytes().enumerate() {
                if bit == b'1' {
                    for dy in 0..scale {
                        for dx in 0..scale {
                            gray.put_pixel(
                                (x as u32 + quiet) * scale + dx,
                                (y as u32 + quiet) * scale + dy,
                                Luma([0]),
                            );
                        }
                    }
                }
            }
        }
        gray
    }
}
