import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../../hooks/useConfig';
import ServiceConfigForm from '.';

export default function NoConfig(props) {
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(props.instanceKey, {}, { sync: false });
    return (
        config !== null && (
            <ServiceConfigForm
                {...props}
                config={config}
                setConfig={setConfig}
            >
                <div className='mb-4'>{t('services.no_need')}</div>
            </ServiceConfigForm>
        )
    );
}
