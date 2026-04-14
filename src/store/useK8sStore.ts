import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface K8sState {
  // 当前选中的集群 ID
  activeClusterId: number | null;
  setActiveClusterId: (id: number | null) => void;
  // 当前选中的命名空间
  activeNamespace: string | undefined;
  setActiveNamespace: (ns: string | undefined) => void;
  // 资源过滤搜索词
  resourceSearchQuery: string;
  setResourceSearchQuery: (q: string) => void;
  // 常用命名空间收藏 (MVP 预留)
  favoriteNamespaces: string[];
  toggleFavoriteNamespace: (ns: string) => void;
}

/**
 * @name useK8sStore
 * @description K8sCenter 专用持久化状态，记录用户在多集群管理时的操作上下文。
 */
const useK8sStore = create<K8sState>()(
  persist(
    (set) => ({
      activeClusterId: null,
      setActiveClusterId: (activeClusterId) => set({ activeClusterId }),
      activeNamespace: 'default',
      setActiveNamespace: (activeNamespace) => set({ activeNamespace }),
      resourceSearchQuery: '',
      setResourceSearchQuery: (resourceSearchQuery) => set({ resourceSearchQuery }),
      favoriteNamespaces: [],
      toggleFavoriteNamespace: (ns) => set((state) => ({
        favoriteNamespaces: state.favoriteNamespaces.includes(ns)
          ? state.favoriteNamespaces.filter(i => i !== ns)
          : [...state.favoriteNamespaces, ns]
      })),
    }),
    {
      name: 'ansflow-k8s-context', // 缓存 Key
    }
  )
);

export default useK8sStore;
