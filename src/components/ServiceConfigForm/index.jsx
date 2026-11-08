import React from 'react';
import { Button } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useToastStyle } from '../../hooks/useToastStyle';
import { useServiceSave } from '../../hooks/useServiceSave';

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
    const [isLoading, submit] = useServiceSave({
        onTest: () => onTest?.(config),
        onSave: async () => {
            await setConfig(config, true);
            await updateServiceList(instanceKey);
        },
        onSuccess: onClose,
        onError: (error) => toast.error(t('config.service.save_failed') + String(error), { style: toastStyle }),
    });

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
                    {t('common.save')}
                </Button>
            </fieldset>
        </form>
    );
}
