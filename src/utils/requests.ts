import axios from 'axios';
import useAppStore from '../store/useAppStore';
import { message } from './antd';

const request = axios.create({
    baseURL: '/api/v1', // 对应 Vite 代理
    timeout: 5000,
    withCredentials: true,
});

request.interceptors.request.use(
    (config) => {
        const token = useAppStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const state = useAppStore.getState();
        // 初始加载中且不是刷新请求，则不发送 Header 或直接拦截
        if (state.isInitializing && config.url !== '/auth/refresh/') {
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
        const res = response.data;
        // 如果没有数据（比如 204），直接返回数据内容（已在后端清理，此处应保持 data 层面一致）
        if (res === undefined || res === null || res === '') {
            return res;
        }
        // 如果后端返回的结构里包含 total，说明是分页数据
        // 我们把整个 res 返回，让页面能拿到 .data(数组) 和 .total
        if (Object.prototype.hasOwnProperty.call(res, 'total')) {
            return res;
        }
        // 如果是普通对象（如 login 或 me 接口），则继续剥离一层 data
        return res.data;
    },
    async (error) => {
        const { config, response } = error;
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
                // 发起静默刷新请求（后端会从 Cookie 里取 RT）
                // 注意：这里手动加了 /api/v1 因为是直接调 axios
                const res = await axios.post('/api/v1/auth/refresh/', {}, { withCredentials: true });
                const newToken = res.data.data.access; 

                // 更新 Store 中的内存 Token
                useAppStore.getState().setToken(newToken);

                // 执行队列里积压的请求
                requestsQueue.forEach((callback) => callback(newToken));
                requestsQueue = [];
                // 重试当前刚才报 401 的请求
                config.headers.Authorization = `Bearer ${newToken}`;
                return request(config);
            } catch (refreshError) {
                // 刷新失败，说明 RT 也过期了，彻底登出
                useAppStore.getState().setToken(null);
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // 处理 403 权限不足
        if (response?.status === 403) {
            const msg = response.data?.detail || '您没有权限执行此操作';
            message.error(msg);
        }

        // 处理其他异常 (比如 400 校验错误或者 500 服务器内部错误)
        if (response?.status && response.status !== 401 && response.status !== 403) {
            let msg = '系统错误，请联系管理员';
            
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