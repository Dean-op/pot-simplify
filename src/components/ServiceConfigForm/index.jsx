import React, { useContext, useEffect, useRef } from 'react';
import { Button } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useToastStyle } from '../../hooks/useToastStyle';
import { useServiceSave } from '../../hooks/useServiceSave';
import { ServiceDialogContext } from '../../hooks/useServiceDialog';

export default function ServiceConfigForm({
    config,
    setConfig,
    instanceKey,
    updateServiceList,
    onClose,
    onTest,
    children,
}) {
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const dialog = useContext(ServiceDialogContext);
    const setSaving = dialog?.setSaving;
    const setDirty = dialog?.setDirty;
    const registerCancelTest = dialog?.registerCancelTest;
    const original = useRef(JSON.stringify(config));
    useEffect(() => {
        setDirty?.(JSON.stringify(config) !== original.current);
    }, [config, setDirty]);
    useEffect(() => () => setDirty?.(false), [setDirty]);
    useEffect(() => () => setSaving?.(false), [setSaving]);
    const [isLoading, submit, phase, cancelTest] = useServiceSave({
        onTest: onTest ? () => onTest(config) : undefined,
        onSave: async () => {
            await setConfig(config, true);
            await updateServiceList(instanceKey);
        },
        onSuccess: onClose,
        onPhaseChange: (value) => setSaving?.(value === 'saving'),
        onError: (error) => toast.error(t('config.service.save_failed') + String(error), { style: toastStyle }),
    });
    useEffect(() => registerCancelTest?.(cancelTest), [registerCancelTest, cancelTest]);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <fieldset
                disabled={isLoading}
                className='min-w-0'
            >
                {children}
                <Button
                    type='submit'
                    isLoading={isLoading}
                    color='primary'
                    fullWidth
                >
                    {t(phase === 'idle' ? 'common.save' : `config.service.${phase}`)}
                </Button>
            </fieldset>
        </form>
    );
}
