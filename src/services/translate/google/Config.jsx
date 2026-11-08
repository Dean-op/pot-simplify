import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Input } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { useConfig } from '../../../hooks/useConfig';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { translate } from './index';
import { Language } from './index';
import { DEFAULT_URL } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.google.title'),
            custom_url: DEFAULT_URL,
        },
        { sync: false }
    );

    return (
        config !== null && (
            <ServiceConfigForm
                config={config}
                setConfig={setConfig}
                instanceKey={instanceKey}
                updateServiceList={updateServiceList}
                onClose={onClose}
                onTest={(draft) => translate('hello', Language.auto, Language.zh_cn, { config: draft })}
            >
                <div className='config-item'>
                    <Input
                        label={t('services.instance_name')}
                        labelPlacement='outside-left'
                        value={config[INSTANCE_NAME_CONFIG_KEY]}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    />
                </div>
                <div className={'config-item'}>
                    <Input
                        label={t('services.translate.google.custom_url')}
                        labelPlacement='outside-left'
                        value={config['custom_url']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                custom_url: value,
                            });
                        }}
                    />
                </div>
            </ServiceConfigForm>
        )
    );
}
