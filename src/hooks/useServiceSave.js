import { useEffect, useRef, useState } from 'react';

export function useServiceSave({ onTest, onSave, onSuccess, onError, onPhaseChange }) {
    const [phase, setPhaseState] = useState('idle');
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
        const setPhase = (value) => {
            setPhaseState(value);
            onPhaseChange?.(value);
        };
        setPhase(onTest ? 'testing' : 'saving');
        try {
            await onTest?.();
            // Closing/cancelling a dialog during the network test discards its draft.
            if (!active.current) return;
            setPhase('saving');
            await onSave();
            if (active.current) onSuccess?.();
        } catch (error) {
            if (active.current) onError(error);
        } finally {
            busy.current = false;
            if (active.current) setPhase('idle');
        }
    };

    return [phase !== 'idle', submit, phase];
}
