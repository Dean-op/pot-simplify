import React, { createContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { appWindow } from '@tauri-apps/api/window';

export const WindowCloseContext = createContext(null);

export default function WindowCloseGuard({ children }) {
    const guard = useRef(null);
    const register = useCallback((callback) => {
        guard.current = callback;
        return () => {
            if (guard.current === callback) guard.current = null;
        };
    }, []);
    const requestClose = useCallback(() => {
        const close = () => appWindow.close().catch((error) => console.error('Failed to close window', error));
        if (guard.current) guard.current(close);
        else void close();
    }, []);

    useEffect(() => {
        const listener = appWindow.onCloseRequested((event) => {
            event.preventDefault();
            requestClose();
        });
        return () => {
            void listener.then((unlisten) => unlisten());
        };
    }, [requestClose]);

    const value = useMemo(() => ({ register, requestClose }), [register, requestClose]);
    return <WindowCloseContext.Provider value={value}>{children}</WindowCloseContext.Provider>;
}
