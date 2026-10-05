import realAxios from '../../node_modules/axios/index.js';
import type { AxiosRequestConfig } from '../../node_modules/axios/index.d.ts';

const DOCUMENT_BACKEND = 'https://XXX.uw.r.appspot.com';

function axios(config: AxiosRequestConfig) {
  const url =
    typeof config?.url === 'string' && config.url.startsWith(DOCUMENT_BACKEND)
      ? config.url.slice(DOCUMENT_BACKEND.length) || '/'
      : config?.url;

  return realAxios({ ...config, url });
}

Object.assign(axios, realAxios);

export default axios as typeof realAxios;
