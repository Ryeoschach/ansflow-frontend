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

/**
 * GitHub OAuth 登录
 * @param code GitHub 授权后回调的 code
 */
export const githubLogin = (code: string) => {
    return request.post('/auth/social/github/', { code });
};

/**
 * 微信 OAuth 登录
 * @param code wx.login() 获取的 code
 */
export const wechatLogin = (code: string) => {
    return request.post('/auth/social/wechat/', { code });
};

/**
 * LDAP 账号密码登录
 * @param username LDAP 用户名
 * @param password LDAP 密码
 */
export const ldapLogin = (username: string, password: string) => {
    return request.post('/auth/ldap/login/', { username, password });
};

/**
 * 已登录用户绑定 GitHub / 微信
 * @param type github 或 wechat
 * @param code 授权 code
 */
export const bindSocialAccount = (type: 'github' | 'wechat', code: string) => {
    return request.post('/auth/social/bind/', { type, code });
};