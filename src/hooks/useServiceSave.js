import { useCallback, useEffect, useRef, useState } from 'react';

export function useServiceSave({ onTest, onSave, onSuccess, onError, onPhaseChange }) {
    const [phase, setPhaseState] = useState('idle');
    const active = useRef(true);
    const busy = useRef(false);
    const requestId = useRef(0);
    const currentPhase = useRef('idle');
    const phaseCallback = useRef(onPhaseChange);
    phaseCallback.current = onPhaseChange;
    const setPhase = useCallback((value) => {
        currentPhase.current = value;
        setPhaseState(value);
        phaseCallback.current?.(value);
    }, []);
    const cancelTest = useCallback(() => {
        if (!active.current || currentPhase.current === 'saving') return;
        requestId.current++;
        busy.current = false;
        setPhase('idle');
    }, [setPhase]);

    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);

    const submit = async () => {
        if (busy.current || !active.current) return;
        const id = ++requestId.current;
        busy.current = true;
        setPhase(onTest ? 'testing' : 'saving');
        try {
            await onTest?.();
            // Closing/cancelling a dialog during the network test discards its draft.
            if (!active.current || id !== requestId.current) return;
            setPhase('saving');
            await onSave();
            if (active.current && id === requestId.current) onSuccess?.();
        } catch (error) {
            if (active.current && id === requestId.current) onError(error);
        } finally {
            if (id === requestId.current) {
                busy.current = false;
                if (active.current) setPhase('idle');
            }
        }
    };

    return [phase !== 'idle', submit, phase, cancelTest];
}
