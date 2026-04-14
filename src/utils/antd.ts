import { message, notification, Modal } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

/**
 * 这是一个可以在 React 组件外部（如 Axios 拦截器）使用的 Ant Design 全局方法持有者。
 * 使用步骤：
 * 1. 在 App.tsx 的 <App> 组件内部放置一个初始化组件。
 * 2. 在组件中使用 App.useApp() 获取实例并赋值给此处的变量。
 */

let messageInstance: MessageInstance = message;
let notificationInstance: NotificationInstance = notification;
let modalInstance: Omit<ModalStaticFunctions, 'warn'> = Modal;

export const setGlobalAntd = (
  m: MessageInstance,
  n: NotificationInstance,
  mo: Omit<ModalStaticFunctions, 'warn'>
) => {
  messageInstance = m;
  notificationInstance = n;
  modalInstance = mo;
};

export { messageInstance as message, notificationInstance as notification, modalInstance as modal };
