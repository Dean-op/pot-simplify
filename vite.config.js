import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    // prevent vite from obscuring rust errors
    clearScreen: false,
    // tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
    },
    // to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
                daemon: resolve(__dirname, 'daemon.html'),
            },
            output: {
                // 四个窗口的入口文件都叫 index.jsx，默认命名会产出一堆
                // index-<hash>.js，没法对着产物核对哪个窗口加载了什么。
                // 这里用父目录名给按需 chunk 重命名。
                chunkFileNames(chunk) {
                    if (chunk.name === 'index' && chunk.facadeModuleId) {
                        const parts = chunk.facadeModuleId.split(/[\\/]/);
                        const dir = parts[parts.length - 2];
                        if (dir) {
                            return `assets/${dir}-[hash].js`;
                        }
                    }
                    return 'assets/[name]-[hash].js';
                },
            },
        },
        // 只发 Windows，WebView2 跟着 Edge 走，直接按 chrome105 出码
        target: 'chrome105',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
}));
