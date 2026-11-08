import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Input, Button } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
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
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.baidu.title'),
            appid: '',
            secret: '',
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
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        size='sm'
                        variant='flat'
                        color='primary'
                        onPress={() => {
                            open('https://fanyi-api.baidu.com/');
                        }}
                    >
                        {t('services.translate.baidu.apply_free_key')}
                    </Button>
                </div>
                <div className='my-2 px-1 text-xs text-default-500'>{t('services.translate.baidu.description')}</div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.baidu.appid')}
                        labelPlacement='outside-left'
                        value={config['appid']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                appid: value,
                            });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.baidu.secret')}
                        labelPlacement='outside-left'
                        value={config['secret']}
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
                                secret: value,
                            });
                        }}
                    />
                </div>
            </ServiceConfigForm>
        )
    );
}
