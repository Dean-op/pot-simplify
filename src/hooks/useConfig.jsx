import { useCallback, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { useGetState } from './useGetState';
import { store } from '../utils/store';

// 同一个 key 被多个组件 useConfig 是常态：app_font_size 在 App 和每一个
// TargetArea 里都有，而 TargetArea 按翻译服务数量渲染多份。原来每个 hook
// 实例都要 listen() 注册一个 tauri 事件、再各自 store.get() 一次，翻译窗口
// 启动时是几十次 IPC。这里按 key 共享：一个 key 只注册一个 listener，多个
// 订阅者共用；同时发生的首次读取也合并成一次。
const subscriptions = new Map();

function subscribe(key, callback) {
    let entry = subscriptions.get(key);
    if (!entry) {
        const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
        entry = { callbacks: new Set(), unlisten: null };
        subscriptions.set(key, entry);
        entry.unlisten = listen(`${eventKey}_changed`, (e) => {
            // 复制一份再遍历：回调里可能触发卸载
            for (const cb of [...entry.callbacks]) {
                cb(e.payload);
            }
        });
    }
    entry.callbacks.add(callback);

    return () => {
        entry.callbacks.delete(callback);
        if (entry.callbacks.size === 0) {
            subscriptions.delete(key);
            entry.unlisten?.then((f) => f());
        }
    };
}

// 只合并「同时」发生的读取，拿到结果就把 promise 丢掉，不做长期缓存，
// 免得后挂载的组件读到过期值。
const pendingReads = new Map();

async function readConfig(key, defaultValue, sync) {
    if (!sync) {
        const stored = await store.get(key);
        return structuredClone({
            ...defaultValue,
            ...Object.fromEntries(Object.entries(stored ?? {}).filter(([, value]) => value !== undefined)),
        });
    }
    let pending = pendingReads.get(key);
    if (!pending) {
        pending = store.get(key).then((v) => {
            if (v === null) {
                return store
                    .set(key, defaultValue)
                    .then(() => store.save())
                    .then(() => defaultValue);
            }
            return v;
        });
        pendingReads.set(key, pending);
        const cleanup = () => {
            if (pendingReads.get(key) === pending) {
                pendingReads.delete(key);
            }
        };
        pending.then(cleanup, cleanup);
    }
    return pending;
}

const pendingWrites = new Map();
const activeWrites = new Map();

function cancelPendingWrite(key) {
    clearTimeout(pendingWrites.get(key));
    pendingWrites.delete(key);
}

function queueWrite(key, operation) {
    const pending = (activeWrites.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
    activeWrites.set(key, pending);
    const cleanup = () => {
        if (activeWrites.get(key) === pending) activeWrites.delete(key);
    };
    pending.then(cleanup, cleanup);
    return pending;
}

function writeConfig(key, value) {
    cancelPendingWrite(key);
    return queueWrite(key, async () => {
        const previous = await store.get(key);
        try {
            await store.set(key, value);
            await store.save();
        } catch (error) {
            // Store mutates its in-memory cache before saving; undo a failed write.
            try {
                if (previous === null) await store.delete(key);
                else await store.set(key, previous);
            } catch (rollbackError) {
                console.error('Failed to restore configuration', rollbackError);
            }
            throw error;
        }
        const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
        await emit(`${eventKey}_changed`, value);
    });
}

export const useConfig = (key, defaultValue, options = {}) => {
    const [property, setPropertyState, getProperty] = useGetState(null);
    const { sync = true } = options;
    const defaults = useRef(defaultValue);
    defaults.current = defaultValue;

    const setProperty = useCallback(
        (v, forceSync = false) => {
            // Explicit saves must finish before the service list or modal is updated.
            if (forceSync) return writeConfig(key, v).then(() => setPropertyState(v));
            setPropertyState(v);
            if (sync) {
                cancelPendingWrite(key);
                pendingWrites.set(
                    key,
                    setTimeout(() => {
                        writeConfig(key, v).catch((error) => console.error('Failed to save configuration', error));
                    }, 500)
                );
            }
        },
        [key, sync]
    );

    // 初始化
    useEffect(() => {
        let active = true;
        setPropertyState(null);
        readConfig(key, defaults.current, sync)
            .then((r) => {
                if (active) setPropertyState(r);
            })
            .catch((error) => console.error('Failed to read configuration', error));
        // Draft forms do not subscribe: an enable toggle must not discard unsaved edits.
        const unsubscribe = sync ? subscribe(key, setPropertyState) : null;
        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [key, sync]);

    return [property, setProperty, getProperty];
};

export const deleteKey = async (key) => {
    cancelPendingWrite(key);
    // Wait for writes already in flight, not just the debounce timer.
    await queueWrite(key, async () => {
        if (await store.has(key)) {
            const previous = await store.get(key);
            await store.delete(key);
            try {
                await store.save();
            } catch (error) {
                await store.set(key, previous);
                throw error;
            }
        }
    });
};
