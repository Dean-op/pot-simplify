import { useEffect, useRef, useState } from 'react';
import { fetchModelList } from '../utils/llm_provider';

export function useModelList(requestPath, apiKey, { onLoaded, onError }) {
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const requestId = useRef(0);
    const source = useRef('');
    source.current = JSON.stringify([requestPath, apiKey]);

    useEffect(() => {
        requestId.current++;
        setModels([]);
        setIsLoading(false);
        return () => {
            requestId.current++;
        };
    }, [requestPath, apiKey]);

    const load = async () => {
        const id = ++requestId.current;
        const requestedSource = source.current;
        const isCurrent = () => id === requestId.current && requestedSource === source.current;
        setIsLoading(true);
        try {
            const list = await fetchModelList(requestPath, apiKey);
            if (!isCurrent()) return;
            setModels(list);
            onLoaded(list);
        } catch (error) {
            if (isCurrent()) onError(error);
        } finally {
            if (isCurrent()) setIsLoading(false);
        }
    };

    return [models, isLoading, load];
}
