import { useCallback, useEffect } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { useGetState } from './useGetState';
import { store } from '../utils/store';
import { debounce } from '../utils';

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

function readConfig(key, defaultValue) {
    let pending = pendingReads.get(key);
    if (!pending) {
        pending = store.get(key).then((v) => {
            if (v === null) {
                store.set(key, defaultValue);
                store.save();
                return defaultValue;
            }
            return v;
        });
        pendingReads.set(key, pending);
        pending.finally(() => {
            if (pendingReads.get(key) === pending) {
                pendingReads.delete(key);
            }
        });
    }
    return pending;
}

export const useConfig = (key, defaultValue, options = {}) => {
    const [property, setPropertyState, getProperty] = useGetState(null);
    const { sync = true } = options;

    // 同步到Store (State -> Store)
    const syncToStore = useCallback(
        debounce((v) => {
            store.set(key, v);
            store.save();
            let eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
            emit(`${eventKey}_changed`, v);
        }),
        []
    );

    // 同步到State (Store -> State)
    const syncToState = useCallback((v) => {
        if (v !== null) {
            setPropertyState(v);
        } else {
            readConfig(key, defaultValue).then((r) => {
                setPropertyState(r);
            });
        }
    }, []);

    const setProperty = useCallback((v, forceSync = false) => {
        setPropertyState(v);
        const isSync = forceSync || sync;
        isSync && syncToStore(v);
    }, []);

    // 初始化
    useEffect(() => {
        syncToState(null);
        return subscribe(key, syncToState);
    }, []);

    return [property, setProperty, getProperty];
};

export const deleteKey = (key) => {
    if (store.has(key)) {
        store.delete(key);
        store.save();
    }
};
