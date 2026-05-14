import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';

interface DesignerState {
  // 画布节点
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  // 画布连线
  edges: Edge[];
  setEdges: (edges: Edge[]) => void;
  // 当前处于编辑状态的 Pipeline ID (null 表示新建)
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  // 记录来源告警 ID，用于自愈闭环
  sourceAlertId: number | null;
  setSourceAlertId: (id: number | null) => void;
  // 最后修改时间
  lastModified: number;
  // 重置画布
  resetDesigner: () => void;
  // 彻底清除缓存
  clearDesigner: () => void;
}

/**
 * @name useDesignerStore
 * @description 专门用于管理流水线设计器实时草稿状态的 Store，支持持久化，防止页面刷新丢失设计进度
 */
const useDesignerStore = create<DesignerState>()(
  persist(
    (set) => ({
      nodes: [],
      setNodes: (nodes) => set({ nodes, lastModified: Date.now() }),
      edges: [],
      setEdges: (edges) => set({ edges, lastModified: Date.now() }),
      editingId: null,
      setEditingId: (editingId) => set({ editingId }),
      sourceAlertId: null,
      setSourceAlertId: (sourceAlertId) => set({ sourceAlertId }),
      lastModified: 0,
      resetDesigner: () => set({ nodes: [], edges: [], sourceAlertId: null, lastModified: 0 }),
      clearDesigner: () => set({ nodes: [], edges: [], editingId: null, sourceAlertId: null, lastModified: 0 }),
    }),
    {
      name: 'ansflow-designer-snapshot', // 存储 Key
    }
  )
);

export default useDesignerStore;
