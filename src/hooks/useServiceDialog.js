import { createContext, useCallback, useRef, useState } from 'react';

export const ServiceDialogContext = createContext(null);

export function useServiceDialog(onClose) {
    const saving = useRef(false);
    const close = useRef(onClose);
    close.current = onClose;
    const [isSaving, setIsSaving] = useState(false);
    const dirty = useRef(false);
    const cancelTest = useRef(null);
    const pendingClose = useRef(null);
    const [isDirty, setIsDirty] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const setSaving = useCallback((value) => {
        saving.current = value;
        setIsSaving(value);
    }, []);

    const setDirty = useCallback((value) => {
        dirty.current = value;
        setIsDirty(value);
    }, []);
    const registerCancelTest = useCallback((callback) => {
        cancelTest.current = callback;
        return () => {
            if (cancelTest.current === callback) cancelTest.current = null;
        };
    }, []);
    const requestClose = useCallback((action) => {
        if (saving.current) return;
        cancelTest.current?.();
        if (dirty.current) {
            pendingClose.current ??= action ?? close.current;
            setConfirmOpen(true);
        } else {
            (action ?? close.current)();
        }
    }, []);
    const cancelDiscard = useCallback(() => {
        pendingClose.current = null;
        setConfirmOpen(false);
    }, []);
    const discardChanges = useCallback(() => {
        const action = pendingClose.current;
        pendingClose.current = null;
        setConfirmOpen(false);
        setDirty(false);
        action?.();
    }, [setDirty]);

    return {
        isSaving,
        setSaving,
        isDirty,
        setDirty,
        confirmOpen,
        requestClose,
        registerCancelTest,
        cancelDiscard,
        discardChanges,
    };
}
