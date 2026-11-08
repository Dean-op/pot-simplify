import { createContext, useCallback, useRef, useState } from 'react';

export const ServiceDialogContext = createContext(null);

export function useServiceDialog(onClose) {
    const saving = useRef(false);
    const close = useRef(onClose);
    close.current = onClose;
    const [isSaving, setIsSaving] = useState(false);

    const setSaving = useCallback((value) => {
        saving.current = value;
        setIsSaving(value);
    }, []);

    const requestClose = useCallback((action) => {
        if (!saving.current) (action ?? close.current)();
    }, []);

    return { isSaving, setSaving, requestClose };
}
