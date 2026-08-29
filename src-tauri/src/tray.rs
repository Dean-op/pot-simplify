use crate::clipboard::*;
use crate::config::{get, set};
use crate::window::config_window;
use crate::window::input_translate;
use crate::window::ocr_recognize;
use crate::window::ocr_translate;
use log::info;
use tauri::CustomMenuItem;
use tauri::GlobalShortcutManager;
use tauri::SystemTrayEvent;
use tauri::SystemTrayMenu;
use tauri::SystemTrayMenuItem;
use tauri::SystemTraySubmenu;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn update_tray(app_handle: tauri::AppHandle, mut language: String, mut copy_mode: String) {
    let tray_handle = app_handle.tray_handle();

    if language.is_empty() {
        language = match get("app_language") {
            Some(v) => v.as_str().unwrap().to_string(),
            None => {
                set("app_language", "en");
                "en".to_string()
            }
        };
    }
    if copy_mode.is_empty() {
        copy_mode = match get("translate_auto_copy") {
            Some(v) => v.as_str().unwrap().to_string(),
            None => {
                set("translate_auto_copy", "disable");
                "disable".to_string()
            }
        };
    }

    info!(
        "Update tray with language: {}, copy mode: {}",
        language, copy_mode
    );
    tray_handle
        .set_menu(tray_menu(tray_labels(language.as_str())))
        .unwrap();
    tray_handle
        .set_tooltip(&format!("pot-simplify {}", app_handle.package_info().version))
        .unwrap();

    let enable_clipboard_monitor = match get("clipboard_monitor") {
        Some(v) => v.as_bool().unwrap(),
        None => {
            set("clipboard_monitor", false);
            false
        }
    };

    tray_handle
        .get_item("clipboard_monitor")
        .set_selected(enable_clipboard_monitor)
        .unwrap();

    match copy_mode.as_str() {
        "source" => tray_handle
            .get_item("copy_source")
            .set_selected(true)
            .unwrap(),
        "target" => tray_handle
            .get_item("copy_target")
            .set_selected(true)
            .unwrap(),
        "source_target" => tray_handle
            .get_item("copy_source_target")
            .set_selected(true)
            .unwrap(),
        "disable" => tray_handle
            .get_item("copy_disable")
            .set_selected(true)
            .unwrap(),
        _ => {}
    }
}

pub fn tray_event_handler<'a>(app: &'a AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => on_tray_click(),
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "input_translate" => on_input_translate_click(),
            "copy_source" => on_auto_copy_click(app, "source"),
            "clipboard_monitor" => on_clipboard_monitor_click(app),
            "copy_target" => on_auto_copy_click(app, "target"),
            "copy_source_target" => on_auto_copy_click(app, "source_target"),
            "copy_disable" => on_auto_copy_click(app, "disable"),
            "ocr_recognize" => on_ocr_recognize_click(),
            "ocr_translate" => on_ocr_translate_click(),
            "config" => on_config_click(),
            "view_log" => on_view_log_click(app),
            "restart" => on_restart_click(app),
            "quit" => on_quit_click(app),
            _ => {}
        },
        _ => {}
    }
}

fn on_tray_click() {
    let event = match get("tray_click_event") {
        Some(v) => v.as_str().unwrap().to_string(),
        None => {
            set("tray_click_event", "config");
            "config".to_string()
        }
    };
    match event.as_str() {
        "config" => config_window(),
        "translate" => input_translate(),
        "ocr_recognize" => ocr_recognize(),
        "ocr_translate" => ocr_translate(),
        "disable" => {}
        _ => config_window(),
    }
}
fn on_input_translate_click() {
    input_translate();
}
fn on_clipboard_monitor_click(app: &AppHandle) {
    let enable_clipboard_monitor = match get("clipboard_monitor") {
        Some(v) => v.as_bool().unwrap(),
        None => {
            set("clipboard_monitor", false);
            false
        }
    };
    let current = !enable_clipboard_monitor;
    // Update Config File
    set("clipboard_monitor", current);
    // Update State and Start Monitor
    let state = app.state::<ClipboardMonitorEnableWrapper>();
    state
        .0
        .lock()
        .unwrap()
        .replace_range(.., &current.to_string());
    if current {
        start_clipboard_monitor(app.app_handle());
    }
    // Update Tray Menu Status
    app.tray_handle()
        .get_item("clipboard_monitor")
        .set_selected(current)
        .unwrap();
}
fn on_auto_copy_click(app: &AppHandle, mode: &str) {
    info!("Set copy mode to: {}", mode);
    set("translate_auto_copy", mode);
    app.emit_all("translate_auto_copy_changed", mode).unwrap();
    update_tray(app.app_handle(), "".to_string(), mode.to_string());
}
fn on_ocr_recognize_click() {
    ocr_recognize();
}
fn on_ocr_translate_click() {
    ocr_translate();
}

fn on_config_click() {
    config_window();
}

fn on_view_log_click(app: &AppHandle) {
    use tauri::api::path::app_log_dir;
    let log_path = app_log_dir(&app.config()).unwrap();
    tauri::api::shell::open(&app.shell_scope(), log_path.to_str().unwrap(), None).unwrap();
}
fn on_restart_click(app: &AppHandle) {
    info!("============== Restart App ==============");
    app.restart();
}
fn on_quit_click(app: &AppHandle) {
    app.global_shortcut_manager().unregister_all().unwrap();
    info!("============== Quit App ==============");
    app.exit(0);
}

// 11 个 tray_menu_xx() 原来结构一模一样，只有字面量不同，加起来 400 行。
// 现在收成一张标签表 + 一个构建函数：加语言只用加一个 const。
// 界面语言裁到中英两种后，这里也只留 EN / ZH_CN 两张表。
struct TrayLabels {
    input_translate: &'static str,
    clipboard_monitor: &'static str,
    auto_copy: &'static str,
    copy_source: &'static str,
    copy_target: &'static str,
    copy_source_target: &'static str,
    copy_disable: &'static str,
    ocr_recognize: &'static str,
    ocr_translate: &'static str,
    config: &'static str,
    view_log: &'static str,
    restart: &'static str,
    quit: &'static str,
}

const TRAY_LABELS_EN: TrayLabels = TrayLabels {
    input_translate: "Input Translate",
    clipboard_monitor: "Clipboard Monitor",
    auto_copy: "Auto Copy",
    copy_source: "Source",
    copy_target: "Target",
    copy_source_target: "Source+Target",
    copy_disable: "Disable",
    ocr_recognize: "OCR Recognize",
    ocr_translate: "OCR Translate",
    config: "Config",
    view_log: "View Log",
    restart: "Restart",
    quit: "Quit",
};

const TRAY_LABELS_ZH_CN: TrayLabels = TrayLabels {
    input_translate: "输入翻译",
    clipboard_monitor: "监听剪切板",
    auto_copy: "自动复制",
    copy_source: "原文",
    copy_target: "译文",
    copy_source_target: "原文+译文",
    copy_disable: "关闭",
    ocr_recognize: "文字识别",
    ocr_translate: "截图翻译",
    config: "偏好设置",
    view_log: "查看日志",
    restart: "重启应用",
    quit: "退出",
};

fn tray_labels(language: &str) -> &'static TrayLabels {
    match language {
        "zh_cn" => &TRAY_LABELS_ZH_CN,
        // 界面语言只留中英，其余（包括老配置里存的 ja / pt_br 等）一律走 en
        _ => &TRAY_LABELS_EN,
    }
}

fn tray_menu(labels: &TrayLabels) -> tauri::SystemTrayMenu {
    SystemTrayMenu::new()
        .add_item(CustomMenuItem::new(
            "input_translate",
            labels.input_translate,
        ))
        .add_item(CustomMenuItem::new(
            "clipboard_monitor",
            labels.clipboard_monitor,
        ))
        .add_submenu(SystemTraySubmenu::new(
            labels.auto_copy,
            SystemTrayMenu::new()
                .add_item(CustomMenuItem::new("copy_source", labels.copy_source))
                .add_item(CustomMenuItem::new("copy_target", labels.copy_target))
                .add_item(CustomMenuItem::new(
                    "copy_source_target",
                    labels.copy_source_target,
                ))
                .add_native_item(SystemTrayMenuItem::Separator)
                .add_item(CustomMenuItem::new("copy_disable", labels.copy_disable)),
        ))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("ocr_recognize", labels.ocr_recognize))
        .add_item(CustomMenuItem::new("ocr_translate", labels.ocr_translate))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("config", labels.config))
        .add_item(CustomMenuItem::new("view_log", labels.view_log))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("restart", labels.restart))
        .add_item(CustomMenuItem::new("quit", labels.quit))
}
