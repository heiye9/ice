import * as React from 'react';
import * as queryString from 'query-string';
import { IRouterConfig } from '../types';
import joinPath from '../utils/joinPath';

const { useEffect, useState } = React;

export default function formatRoutes(routes: IRouterConfig[], parentPath: string) {
  return routes.map((item) => {
    if (item.path) {
      const routePath = joinPath(parentPath || '', item.path);
      item.path = routePath === '/' ? '/' : routePath.replace(/\/$/, '');
    }
    if (item.children) {
      item.children = formatRoutes(item.children, item.path);
    } else if (item.component) {
      const itemComponent = item.component as any;
      itemComponent.pageConfig = Object.assign({}, itemComponent.pageConfig, { componentName: itemComponent.name });
    }
    return item;
  });
}

/**
 * @description 将中心化路由配置转化为组件路由配置
 * 
 * @param routes 路由配置
 * @param configs 需要转化的配置键名
 */
export function centre2Comp<T extends keyof IRouterConfig>(routes: IRouterConfig[], configs: T[] = []) {
  routes.forEach(item => {
    if (item.path) {
      const itemComponent = item.component as any;
      configs.forEach(cfg => {
        if (item[cfg]) {
          itemComponent[cfg] = item[cfg];
        }
      });
    }
    if (item.children) {
      centre2Comp(item.children, configs);
    }
  });
}

export function wrapperPageWithSSR(context) {
  const pageInitialProps = { ...context.pageInitialProps };
  const WrapperPageFn = (PageComponent) => {
    const ServerWrapperedPage = (props) => {
      return <PageComponent {...Object.assign({}, props, pageInitialProps)} />;
    };
    return ServerWrapperedPage;
  };
  return WrapperPageFn;
}

export function wrapperPageWithCSR() {
  const wrapperPage = (PageComponent) => {
    const { pageConfig } = PageComponent;
    const { title, scrollToTop } = pageConfig || {};

    console.log(pageConfig);
    const RouterWrapperedPage = (props) => {
      const [data, setData] = useState((window as any).__ICE_PAGE_PROPS__);
      useEffect(() => {
        if (title) {
          document.title = title;
        }

        if (scrollToTop) {
          window.scrollTo(0, 0);
        }

        // When enter the page for the first time, need to use window.__ICE_PAGE_PROPS__ as props
        // And don't need to re-request to switch routes
        // Set the data to null after use, otherwise other pages will use
        if ((window as any).__ICE_PAGE_PROPS__) {
          (window as any).__ICE_PAGE_PROPS__ = null;
        } else if (PageComponent.getInitialProps) {
          // When the server does not return data, the client calls getinitialprops
          (async () => {
            const { href, origin, pathname, search } = window.location;
            const curPath = href.replace(origin, '');
            const query = queryString.parse(search);
            const ssrError = (window as any).__ICE_SSR_ERROR__;
            const initialContext = {
              pathname,
              path: curPath,
              query,
              ssrError
            };
            const result = await PageComponent.getInitialProps(initialContext);
            setData(result);
          })();
        }
      }, []);
      return <PageComponent {...Object.assign({}, props, data)} />;
    };
    return RouterWrapperedPage;
  };
  return wrapperPage;
}
