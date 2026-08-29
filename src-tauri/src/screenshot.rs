use log::info;
use std::sync::Mutex;

// 最近一次全屏截图的原始像素：(width, height, RGBA)。
//
// cut_image 直接从这里裁，省掉「把刚写下去的全屏 PNG 再解一遍」的开销
// （1440p 大约 30~60ms，正好卡在框选完到出识别窗口这段路上）。
// cut_image 用 take() 取走，不留着：4K 屏一张 RGBA 是 33MB，常驻托盘的
// 程序不该白占这么多。只有「拉了框选层又取消」时会留一张，等下次截图覆盖。
pub static LAST_SCREENSHOT: Mutex<Option<(u32, u32, Vec<u8>)>> = Mutex::new(None);

#[tauri::command]
pub fn screenshot(x: i32, y: i32) {
    use crate::APP;
    use dirs::cache_dir;
    use screenshots::{Compression, Screen};
    use std::fs;
    info!("Screenshot screen with position: x={}, y={}", x, y);
    let screens = Screen::all().unwrap();
    for screen in screens {
        let info = screen.display_info;
        info!("Screen: {:?}", info);
        if info.x == x && info.y == y {
            let handle = APP.get().unwrap();
            let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
            app_cache_dir_path.push(&handle.config().tauri.bundle.identifier);
            if !app_cache_dir_path.exists() {
                // 创建目录
                fs::create_dir_all(&app_cache_dir_path).expect("Create Cache Dir Failed");
            }
            app_cache_dir_path.push("pot_simplify_screenshot.png");

            let image = screen.capture().unwrap();
            let (width, height) = (image.width(), image.height());
            let buffer = image.to_png(Compression::Fast).unwrap();
            fs::write(app_cache_dir_path, buffer).unwrap();
            // PNG 还是要写盘：框选窗口是用 asset 协议读这个文件来显示的。
            // 这里额外留一份原始像素给 cut_image。
            *LAST_SCREENSHOT.lock().unwrap() = Some((width, height, image.rgba().clone()));
            break;
        }
    }
}
