import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Input, Button, Textarea, Select, SelectItem } from '@nextui-org/react';
import { DropdownTrigger, DropdownMenu, DropdownItem, Dropdown } from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { PROVIDER_PRESETS, fetchModelList } from '../../../utils/llm_provider';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { recognize } from './index';
import { Language } from './index';

export const defaultPrompt =
    'Extract all text from the image. Output only the extracted text, preserving the original line breaks. ' +
    'Do not add explanations, do not translate, do not wrap the result in markdown code fences. ' +
    'If the image contains no text, output nothing.';

export const defaultRequestArguments = JSON.stringify({
    temperature: 0,
    max_tokens: 4096,
});

// 120x40 的 "OCR test 42" 白底黑字 PNG，用于保存前的连通性测试
const TEST_IMAGE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAIAAAC6iKlyAAADLUlEQVR42u2aPUjrUBSAX1/folIEoSJ1dBFFTJPFEprENpbSLlZFB7GI4tLZ2cXBv01HsVXBog5OUpoqSND6szgIEgc7qJuCLbW1Grk9b7gQJP6894b3eJbzTfeeezgJHycnBGIBgG/I3+c7KkDRKBpB0SgaRSMoGkUjKBpFo2gERaNoBEWjaBT9ObFYjOM4l8vFcdzKygoNLi4usiwrimIwGLy5uaHB6upqSZJEUWRZVlVVo8L09PTv3Mq7aYlEoqqqiq6j0ajb7WYYJpVKfT3T8CnJZJLn+Ww2CwDZbJbn+Z2dnVQq1dnZ+fj4CACJRMLj8dDk2tpaujg7O2trazOKGPHPeZuWz+ddLpfNZgOA29tbQRAIIZqmNTc3w1fjF6K9Xu/h4aGxTafTsiz7fL6joyMjODY2puv6a1Plcrmuro6uJyYmrFZrV1fX/f394OCg1+t1u90nJycAMD8/zzCM0+lUFMVIe331SCSysbFBy2qatrm5CQCFQsFut1eaaIfDUSqVjG2pVHI4HI2NjU9PT5+0ZDKZ7OvrM8VHR0ePj48B4Orqqr29HQDsdns+n9c0bWho6G1H7+/vd3d3v40vLy+PjIx8OdE//nTOWCwWQsi7p7quS5L08vJycXFxfn5uOlUU5fLykq6LxSIhJBAIhMPhSCSyurpqSn5+fh4fH9/a2jLFM5nM3Nzc3t5epc1oWZbT6bSxPTg48Pl8giDQ3qRTIhwOmzp6ZmZmamrK1NENDQ304SCEqKpKj1RVDYVCw8PDps5dW1traWkRRVEURavVSlv+4eGB4zjj0hU1OhRF4Xk+l8sZL8Pd3d319XVZlun0iMfjAwMDJtGnp6ehUMgoYrPZCCG9vb3xeBwAtre3/X5/LpcTBEHX9UKhUF9fb6R9NJHK5XJPTw+tUIGiAWBpacnpdHZ0dLAsG4vFaHBycrK1tVWSpP7+/ru7O5PoYrHY1NRkWAsEAsFg8Pr62u/3C4Lg8XgymQwAzM7OsizLMMzCwoKR9pHoaDRaU1NDe/zdtP8cC/7XgV+GKBpB0SgaRSMoGkUjKBpFo2gERaNoBEWjaBSN/AN+AnBqpUph2MrBAAAAAElFTkSuQmCC';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.llm.title'),
            requestPath: 'https://api.siliconflow.cn/v1/chat/completions',
            apiKey: '',
            model: 'Qwen/Qwen3-VL-8B-Instruct',
            prompt: defaultPrompt,
            requestArguments: defaultRequestArguments,
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const [modelList, setModelList] = useState([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);

    const toastStyle = useToastStyle();

    const loadModelList = () => {
        setIsFetchingModels(true);
        fetchModelList(config['requestPath'], config['apiKey']).then(
            (list) => {
                setIsFetchingModels(false);
                setModelList(list);
                toast.success(t('services.model_list_loaded', { count: list.length }), { style: toastStyle });
            },
            (e) => {
                setIsFetchingModels(false);
                toast.error(t('services.model_list_failed') + e.toString(), { style: toastStyle });
            }
        );
    };

    return (
        config !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    recognize(TEST_IMAGE_BASE64, Language.auto, { config }).then(
                        () => {
                            setIsLoading(false);
                            setConfig(config, true);
                            updateServiceList(instanceKey);
                            onClose();
                        },
                        (e) => {
                            setIsLoading(false);
                            toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle });
                        }
                    );
                }}
            >
                <Toaster />
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
                            setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.provider_preset')}</h3>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button variant='bordered'>{t('services.provider_preset_select')}</Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label='provider preset'
                            onAction={(key) => {
                                const preset = PROVIDER_PRESETS.find((item) => item.key === key);
                                if (!preset) return;
                                setModelList([]);
                                setConfig({ ...config, requestPath: preset.base });
                            }}
                        >
                            {PROVIDER_PRESETS.map((preset) => (
                                <DropdownItem key={preset.key}>{preset.label}</DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.recognize.llm.request_path')}
                        labelPlacement='outside-left'
                        value={config['requestPath']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({ ...config, requestPath: value });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.recognize.llm.api_key')}
                        labelPlacement='outside-left'
                        type='password'
                        value={config['apiKey']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({ ...config, apiKey: value });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.recognize.llm.model')}
                        labelPlacement='outside-left'
                        value={config['model']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({ ...config, model: value });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Button
                        isLoading={isFetchingModels}
                        onPress={loadModelList}
                    >
                        {t('services.fetch_model_list')}
                    </Button>
                    {modelList.length > 0 && (
                        <Select
                            aria-label='model list'
                            className='max-w-[50%]'
                            placeholder={t('services.model_list_pick')}
                            selectedKeys={modelList.includes(config['model']) ? [config['model']] : []}
                            onChange={(e) => {
                                if (!e.target.value) return;
                                setConfig({ ...config, model: e.target.value });
                            }}
                        >
                            {modelList.map((id) => (
                                <SelectItem key={id}>{id}</SelectItem>
                            ))}
                        </Select>
                    )}
                </div>
                <p className='text-[10px] text-default-700'>{t('services.recognize.llm.model_description')}</p>
                <h3 className='my-auto'>Prompt</h3>
                <p className='text-[10px] text-default-700'>{t('services.recognize.llm.prompt_description')}</p>
                <div className='config-item'>
                    <Textarea
                        label=''
                        labelPlacement='outside'
                        variant='faded'
                        minRows={3}
                        value={config['prompt']}
                        placeholder={defaultPrompt}
                        onValueChange={(value) => {
                            setConfig({ ...config, prompt: value });
                        }}
                    />
                </div>
                <h3 className='my-auto'>Request Arguments</h3>
                <div className='config-item'>
                    <Textarea
                        label=''
                        labelPlacement='outside'
                        variant='faded'
                        value={config['requestArguments']}
                        placeholder={defaultRequestArguments}
                        onValueChange={(value) => {
                            setConfig({ ...config, requestArguments: value });
                        }}
                    />
                </div>
                <br />
                <Button
                    type='submit'
                    isLoading={isLoading}
                    color='primary'
                    fullWidth
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
