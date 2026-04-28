import axios from 'axios';
import useAppStore from '../store/useAppStore';
import { message } from './antd';
import i18n from '../locales/i18n';

const request = axios.create({
    baseURL: '/api/v1', // 对应 Vite 代理
    timeout: 15000,
    withCredentials: true,
});

request.interceptors.request.use(
    (config) => {
        (config as any)._startTime = Date.now();
        const token = useAppStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        const state = useAppStore.getState();
        // 初始加载中且不是刷新请求，则不发送 Header 或直接拦截
        if (state.isInitializing && config.url !== '/auth/refresh/' && config.url !== '/account/me/') {
            return Promise.reject(new Error('Initial loading'));
        }
        return config;
    }
);

// 用于防止多个 401 同时触发多次刷新请求的情报队列
let isRefreshing = false;
let requestsQueue: any[] = [];
request.interceptors.response.use(
    (response) => {
        const duration = Date.now() - (response.config as any)._startTime;
        if (duration > 2000) {
            console.warn(`[Performance] Slow API Request: ${response.config.url} took ${duration}ms`);
        }
        const res = response.data;
        // 如果没有数据（比如 204），直接返回数据内容
        if (res === undefined || res === null || res === '') {
            return res;
        }
        // 如果后端返回的结构里包含 total，说明是分页数据
        if (Object.prototype.hasOwnProperty.call(res, 'total')) {
            return res;
        }
        return res.data ?? res;
    },
    async (error) => {
        const { config, response } = error;
        
        // 如果请求本身就是刷新 Token 请求且报错，直接清空状态并跳转登录
        if (config.url === '/auth/refresh/' || config.url === '/api/v1/auth/refresh/') {
            isRefreshing = false;
            requestsQueue = [];
            useAppStore.getState().setToken(null);
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // 处理 401 令牌过期
        if (response?.status === 401 && !config._retry && window.location.pathname !== '/login') {
            if (isRefreshing) {
                // 如果正在刷新中，就把请求挂起来
                return new Promise((resolve) => {
                    requestsQueue.push((newToken: string) => {
                        config.headers.Authorization = `Bearer ${newToken}`;
                        resolve(request(config));
                    });
                });
            }
            config._retry = true;
            isRefreshing = true;
            try {
                // 发起静默刷新请求
                const res = await axios.post('/api/v1/auth/refresh/', {}, { withCredentials: true });
                const newToken = res.data?.data?.access || res.data?.access; 

                if (!newToken) throw new Error('Refresh failed: No access token');

                // 更新 Store 中的内存 Token
                useAppStore.getState().setToken(newToken);

                // 执行队列里积压的请求
                requestsQueue.forEach((callback) => callback(newToken));
                requestsQueue = [];
                // 重试当前刚才报 401 的请求
                config.headers.Authorization = `Bearer ${newToken}`;
                return request(config);
            } catch (refreshError) {
                useAppStore.getState().setToken(null);
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // 处理 403 权限不足
        if (response?.status === 403) {
            const msg = response.data?.detail || i18n.t('common.permissionDenied');
            message.error(msg);
        }

        // 处理其他异常 (比如 400 校验错误或者 500 服务器内部错误)
        if (response?.status && response.status !== 401 && response.status !== 403) {
            let msg = i18n.t('common.systemError');
            
            // 适配后端新的统一标准错误结构 ( {code: 400, message: "...", data: null} )
            if (response.data && response.data.message) {
                msg = response.data.message;
            } else if (response.data && typeof response.data === 'string') {
                msg = response.data;
            }

            message.error(msg);
        }

        return Promise.reject(error);
    }
);

export default request;