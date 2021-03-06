/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-ignore
import router from 'workbox-routing';
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  // @ts-ignore
} from 'workbox-strategies';
// @ts-ignore
import { Plugin } from 'workbox-cache-expiration';
import { AMP_ASSET_CACHE } from './constants';
import { AmpSwModule } from '../core/AmpSwModule';

export type AssetCachingOptions = Array<{
  regexp: RegExp;
  cachingStrategy: 'NETWORK_FIRST' | 'CACHE_FIRST' | 'STALE_WHILE_REVALIDATE';
  denyList?: Array<RegExp>;
  purgeOnQuotaError?: boolean;
  maxEntries?: number;
}>;

// TODO(KB): Temporary Interface until Workbox v5. Replace when upgrading.
interface CacheWillUpdateOptions {
  request: Request;
  response: Response;
}

class AssetCachingPlugin extends Plugin {
  private denyList: Array<RegExp>;

  constructor(config: any, denyList?: Array<RegExp>) {
    super(config);
    this.denyList = denyList || [];
  }

  async cacheWillUpdate({
    request,
    response,
  }: CacheWillUpdateOptions): Promise<Response | null> {
    if (
      this.denyList.some(deniedUrlRegExp => deniedUrlRegExp.test(request.url))
    ) {
      // When matching a RegExp in the DenyList, do not use the cache for the entry.
      return null;
    }

    const returnedResponse: Response | null = super.cacheWillUpdate
      ? await super.cacheWillUpdate({ response })
      : response;

    if (!returnedResponse) {
      return null;
    }

    const cachableResponse = returnedResponse.clone();
    const responseContentType = cachableResponse.headers.get('content-type');
    if (responseContentType && responseContentType.includes('text/html')) {
      return null;
    }

    return cachableResponse;
  }
}

export class AssetCachingAmpModule implements AmpSwModule {
  init(assetCachingOptions: AssetCachingOptions) {
    assetCachingOptions.forEach(assetCachingOption => {
      let cachingStrategy = null;
      let purgeOnQuotaError = true;
      if (assetCachingOption.purgeOnQuotaError !== undefined) {
        purgeOnQuotaError = assetCachingOption.purgeOnQuotaError;
      }
      const cachingConfig = {
        cacheName: AMP_ASSET_CACHE,
        plugins: [
          new AssetCachingPlugin({
            maxEntries: assetCachingOption.maxEntries || 25,
            denyList: assetCachingOption.denyList,
            purgeOnQuotaError,
          }),
        ],
      };

      switch (assetCachingOption.cachingStrategy) {
        case 'NETWORK_FIRST':
          cachingStrategy = new NetworkFirst(cachingConfig);
          break;
        case 'STALE_WHILE_REVALIDATE':
          cachingStrategy = new StaleWhileRevalidate(cachingConfig);
          break;
        default:
          cachingStrategy = new CacheFirst(cachingConfig);
          break;
      }

      router.registerRoute(assetCachingOption.regexp, cachingStrategy);
    });
  }
}
