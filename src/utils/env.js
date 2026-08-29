import { type } from '@tauri-apps/api/os';

// 只留 osType。arch / osVersion / appVersion 原本只有「关于」页在用，
// 那个页面已经删掉，再拉这三个 IPC 纯粹是白等启动时间。
export let osType = '';

export async function initEnv() {
    osType = await type();
}
