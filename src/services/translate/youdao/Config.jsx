import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Input, Button } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { useConfig } from '../../../hooks/useConfig';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { translate } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.youdao.title'),
            appkey: '',
            key: '',
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
                <div className='my-2 px-1 text-xs text-default-500'>{t('services.translate.youdao.description')}</div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.youdao.appkey')}
                        placeholder={t('services.translate.youdao.optional_tip')}
                        labelPlacement='outside-left'
                        value={config['appkey']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                appkey: value,
                            });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.youdao.key')}
                        placeholder={t('services.translate.youdao.optional_tip')}
                        labelPlacement='outside-left'
                        value={config['key']}
                        variant='bordered'
                        type='password'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                key: value,
                            });
                        }}
                    />
                </div>
            </ServiceConfigForm>
        )
    );
}
