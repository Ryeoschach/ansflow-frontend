import request from '../utils/requests';

/**
 * 登录接口
 * 返回 access token (RT 在 Cookie 中)
 */
export const login = (data: any) => {
    return request.post('/auth/login/', data);
};

/**
 * 刷新 Token 接口
 */
export const refreshToken = () => {
    return request.post('/auth/refresh/');
};