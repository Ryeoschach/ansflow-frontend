import request from '../utils/requests.ts';

// 获取当前登录用户的信息及权限列表
export const getMe = () => {
    return request.get('/account/me/');
};

// 获取当前用户的授权菜单树
export const getMyMenus = () => {
    return request.get('/account/menus/');
};
