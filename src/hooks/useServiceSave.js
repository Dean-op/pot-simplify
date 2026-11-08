import { useEffect, useRef, useState } from 'react';

export function useServiceSave({ onTest, onSave, onSuccess, onError }) {
    const [isLoading, setIsLoading] = useState(false);
    const active = useRef(true);
    const busy = useRef(false);

    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);

    const submit = async () => {
        if (busy.current || !active.current) return;
        busy.current = true;
        setIsLoading(true);
        try {
            await onTest?.();
            // Closing/cancelling a dialog during the network test discards its draft.
            if (!active.current) return;
            await onSave();
            if (active.current) onSuccess?.();
        } catch (error) {
            if (active.current) onError(error);
        } finally {
            busy.current = false;
            if (active.current) setIsLoading(false);
        }
    };

    return [isLoading, submit];
}
