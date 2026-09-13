import { fetch } from '@tauri-apps/api/http';
import { nanoid } from 'nanoid';
import md5 from '../../../utils/md5';

export async function translate(text, from, to, options = {}) {
    text = text.trim();
    if (!text) return '';

    const { config } = options;
    const { appid, secret } = config || {};

    const url = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

    const salt = nanoid();
    if (!appid || !secret) {
        throw 'Please configure appid and secret';
    }

    const str = appid + text + salt + secret;
    const sign = md5(str);

    let res = await fetch(url, {
        method: 'GET',
        query: {
            q: text,
            from: from,
            to: to,
            appid: appid,
            salt: salt,
            sign: sign,
        },
    });
    if (res.ok) {
        let result = res.data;
        if (result.error_code) {
            throw `Baidu API Error: [${result.error_code}] ${result.error_msg}`;
        }
        const { trans_result } = result;
        if (trans_result) {
            let target = '';
            for (let i in trans_result) {
                target = target + trans_result[i]['dst'] + '\n';
            }
            return target.trim();
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
