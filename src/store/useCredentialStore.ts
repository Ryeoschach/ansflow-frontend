import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CredentialState {
  // 当前过滤的认证类型
  filterAuthType: 'all' | 'password' | 'key';
  setFilterAuthType: (type: 'all' | 'password' | 'key') => void;
  // 是否隐藏敏感内容 (如私钥预览)
  maskSensitiveData: boolean;
  setMaskSensitiveData: (mask: boolean) => void;
}

/**
 * @name useCredentialStore
 * @description 凭据中心全局状态，管理敏感信息的展示策略与用户视图偏好。
 */
const useCredentialStore = create<CredentialState>()(
  persist(
    (set) => ({
      filterAuthType: 'all',
      setFilterAuthType: (filterAuthType) => set({ filterAuthType }),
      maskSensitiveData: true,
      setMaskSensitiveData: (maskSensitiveData) => set({ maskSensitiveData }),
    }),
    {
      name: 'ansflow-cred-ui-prefs',
    }
  )
);

export default useCredentialStore;
