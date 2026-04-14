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
  // 当前处于编辑状态的 Pipeline ID
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  // 重置画布
  resetDesigner: () => void;
}

/**
 * @name useDesignerStore
 * @description 专门用于管理流水线设计器实时草稿状态的 Store，支持持久化，防止页面刷新丢失设计进度
 */
const useDesignerStore = create<DesignerState>()(
  persist(
    (set) => ({
      nodes: [],
      setNodes: (nodes) => set({ nodes }),
      edges: [],
      setEdges: (edges) => set({ edges }),
      editingId: null,
      setEditingId: (editingId) => set({ editingId }),
      resetDesigner: () => set({ nodes: [], edges: [], editingId: null }),
    }),
    {
      name: 'ansflow-designer-snapshot', // 存储 Key
    }
  )
);

export default useDesignerStore;
