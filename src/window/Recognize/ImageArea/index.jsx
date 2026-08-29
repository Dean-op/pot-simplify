import { Card, CardBody, CardFooter, Button, Tooltip } from '@nextui-org/react';
import React, { useEffect, useRef, useCallback } from 'react';
import { atom, useAtom, useSetAtom } from 'jotai';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { MdContentCopy } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';

import { useConfig } from '../../../hooks';

// 每来一张新图 +1，识别区靠它触发识别。
//
// 原来这里存的是整张图的 base64，识别区靠它非空来触发：一张 1440p 的截图
// 是好几 MB，穿过 IPC 再解成 data: URL 要几百毫秒，而这几百毫秒完全挡在
// 「发出识别请求」前面。现在图片直接走 asset 协议从缓存目录读，base64 改成
// 由识别区按需去取——系统 OCR 根本不需要它。
export const imageFlagAtom = atom(0);
const imageUrlAtom = atom('');

const CUT_IMAGE_NAME = 'pot_simplify_screenshot_cut.png';
// 路径每次都一样，解一次就够了
let cutImagePath = null;
const getCutImagePath = () => {
    if (cutImagePath === null) {
        cutImagePath = appCacheDir().then((dir) => join(dir, CUT_IMAGE_NAME));
    }
    return cutImagePath;
};

let unlisten = null;

export default function ImageArea() {
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const [imageUrl, setImageUrl] = useAtom(imageUrlAtom);
    const setImageFlag = useSetAtom(imageFlagAtom);
    const imgRef = useRef();
    const { t } = useTranslation();

    const load_img = useCallback(async () => {
        const path = await getCutImagePath();
        // 文件名固定不变，得带个时间戳绕开 WebView2 的图片缓存
        setImageUrl(`${convertFileSrc(path)}?t=${Date.now()}`);
        setImageFlag((v) => v + 1);
        if (hideWindow) {
            appWindow.hide();
        } else {
            appWindow.show();
            appWindow.setFocus(true);
        }
    }, [hideWindow]);

    useEffect(() => {
        if (hideWindow !== null) {
            void load_img();
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
            unlisten = listen('new_image', (_) => {
                void load_img();
            });
        }
    }, [hideWindow]);

    return (
        <Card
            shadow='none'
            className='bg-content1 h-full ml-[12px] mr-[6px]'
            radius='10'
        >
            <CardBody className='bg-content1 h-full p-0'>
                {imageUrl !== '' && (
                    <img
                        ref={imgRef}
                        draggable={false}
                        className='object-contain h-full w-full'
                        src={imageUrl}
                    />
                )}
            </CardBody>
            <CardFooter className='bg-content1 flex justify-start px-[12px]'>
                <Tooltip content={t('recognize.copy_img')}>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={async () => {
                            await invoke('copy_img', {
                                width: imgRef.current.naturalWidth,
                                height: imgRef.current.naturalHeight,
                            });
                        }}
                    >
                        <MdContentCopy className='text-[16px]' />
                    </Button>
                </Tooltip>
            </CardFooter>
        </Card>
    );
}
