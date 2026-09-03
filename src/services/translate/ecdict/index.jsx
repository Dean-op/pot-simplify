import { fetch, Body } from '@tauri-apps/api/http';

import { formatHttpError } from '../../../utils/http_error';

// 名字容易误会：这里查的不是本地的 ECDICT 数据库，而是把文本 POST 到上游作者的
// 服务器 pot-app.com/api/dict。也就是说它既依赖别人的服务器活着，也意味着每次
// 查词都把文本发给第三方。那台服务器目前对 POST 直接回 nginx 的 405 默认页，
// 客户端换参数、重试都绕不过去 —— 所以报错里直接给出替代方案。
export async function translate(text, _from, _to) {
    const res = await fetch(`https://pot-app.com/api/dict`, {
        method: 'POST',
        body: Body.json({ text }),
    });

    if (res.ok) {
        let result = res.data;
        return result;
    } else {
        throw formatHttpError(res.status, res.data, 'services.http_error.ecdict_upstream');
    }
}

export * from './Config';
export * from './info';
