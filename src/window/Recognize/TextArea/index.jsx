import { Card, CardBody, CardFooter, Button, Skeleton, ButtonGroup, Tooltip } from '@nextui-org/react';
import { sendNotification } from '@tauri-apps/api/notification';
import { writeText } from '@tauri-apps/api/clipboard';
import { atom, useAtom, useAtomValue } from 'jotai';
import React, { useEffect, useState } from 'react';
import { CgSpaceBetween } from 'react-icons/cg';
import { MdContentCopy } from 'react-icons/md';
import { MdSmartButton } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';
import { nanoid } from 'nanoid';

import { getServiceName } from '../../../utils/service_instance';
import { currentServiceInstanceKeyAtom, languageAtom, recognizeFlagAtom } from '../ControlArea';
import * as builtinServices from '../../../services/recognize';
import { useConfig } from '../../../hooks';
import { imageFlagAtom } from '../ImageArea';

export const textAtom = atom();
let recognizeId = 0;

export default function TextArea(props) {
    const { serviceInstanceConfigMap } = props;
    const [autoCopy] = useConfig('recognize_auto_copy', false);
    const [deleteNewline] = useConfig('recognize_delete_newline', false);
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const recognizeFlag = useAtomValue(recognizeFlagAtom);
    const currentServiceInstanceKey = useAtomValue(currentServiceInstanceKeyAtom);
    const language = useAtomValue(languageAtom);
    const imageFlag = useAtomValue(imageFlagAtom);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useAtom(textAtom);
    const [error, setError] = useState('');
    const { t } = useTranslation();

    useEffect(() => {
        setText('');
        setError('');
        if (
            imageFlag > 0 &&
            currentServiceInstanceKey &&
            autoCopy !== null &&
            deleteNewline !== null &&
            hideWindow !== null
        ) {
            setLoading(true);
            const instanceConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {};
            const serviceName = getServiceName(currentServiceInstanceKey);
            const service = builtinServices[serviceName];
            if (language in service.Language) {
                let id = nanoid();
                recognizeId = id;
                // 只有要把图片发给模型的服务才需要 base64。系统 OCR 是 Rust 侧
                // 自己读缓存里的 PNG，白搬一趟几 MB 的 base64 纯属浪费。
                // maxEdge 交给 Rust 侧缩图：磁盘上的原图不动，只缩发出去的这一份。
                const imageData = service.info.needImageData
                    ? invoke('get_base64', { maxEdge: instanceConfig['maxImageEdge'] ?? 0 })
                    : Promise.resolve('');
                imageData
                    .then((base64) =>
                        service.recognize(base64, service.Language[language], {
                            config: instanceConfig,
                            // 流式识别的中间结果：顶掉骨架屏，让已经出来的行先显示。
                            // 删换行、自动复制这些收尾动作留给下面的 then，等全文到齐再做。
                            setResult: (v) => {
                                if (recognizeId !== id) return;
                                setText(v);
                                setLoading(false);
                            },
                        })
                    )
                    .then(
                        (v) => {
                            if (recognizeId !== id) return;
                            v = v.trim();
                            if (deleteNewline) {
                                v = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                            }
                            setText(v);
                            setLoading(false);
                            if (autoCopy) {
                                writeText(v).then(() => {
                                    if (hideWindow) {
                                        sendNotification({ title: t('common.write_clipboard'), body: v });
                                    }
                                });
                            }
                        },
                        (e) => {
                            if (recognizeId !== id) return;
                            setError(e.toString());
                            setLoading(false);
                        }
                    );
            } else {
                setError('Language not supported');
                setLoading(false);
            }
        }
    }, [imageFlag, currentServiceInstanceKey, language, recognizeFlag, autoCopy, deleteNewline, hideWindow]);

    return (
        <Card
            shadow='none'
            className='bg-content1 h-full ml-[6px] mr-[12px]'
            radius='10'
        >
            <CardBody className='bg-content1 p-0 h-full'>
                {loading ? (
                    <div className='space-y-3 m-[12px]'>
                        <Skeleton className='w-3/5 rounded-lg'>
                            <div className='h-3 w-3/5 rounded-lg bg-default-200'></div>
                        </Skeleton>
                        <Skeleton className='w-4/5 rounded-lg'>
                            <div className='h-3 w-4/5 rounded-lg bg-default-200'></div>
                        </Skeleton>
                        <Skeleton className='w-2/5 rounded-lg'>
                            <div className='h-3 w-2/5 rounded-lg bg-default-300'></div>
                        </Skeleton>
                    </div>
                ) : (
                    <>
                        {text && (
                            <textarea
                                value={text}
                                className='bg-content1 h-full m-[12px] mb-0 resize-none focus:outline-none'
                                onChange={(e) => {
                                    setText(e.target.value);
                                }}
                            />
                        )}
                        {error && (
                            <textarea
                                value={error}
                                readOnly
                                className='bg-content1 h-full m-[12px] mb-0 resize-none focus:outline-none text-red-500'
                                onChange={(e) => {
                                    setText(e.target.value);
                                }}
                            />
                        )}
                    </>
                )}
            </CardBody>
            <CardFooter className='bg-content1 flex justify-start px-[12px]'>
                <ButtonGroup>
                    <Tooltip content={t('recognize.copy_text')}>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='light'
                            onPress={() => {
                                writeText(text);
                            }}
                        >
                            <MdContentCopy className='text-[16px]' />
                        </Button>
                    </Tooltip>
                    <Tooltip content={t('recognize.delete_newline')}>
                        <Button
                            isIconOnly
                            variant='light'
                            size='sm'
                            onPress={() => {
                                setText(text.replace(/\-\s+/g, '').replace(/\s+/g, ' '));
                            }}
                        >
                            <MdSmartButton className='text-[16px]' />
                        </Button>
                    </Tooltip>
                    <Tooltip content={t('recognize.delete_space')}>
                        <Button
                            isIconOnly
                            variant='light'
                            size='sm'
                            onPress={() => {
                                setText(text.replaceAll(' ', ''));
                            }}
                        >
                            <CgSpaceBetween className='text-[16px]' />
                        </Button>
                    </Tooltip>
                </ButtonGroup>
            </CardFooter>
        </Card>
    );
}
