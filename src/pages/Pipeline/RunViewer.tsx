import React, { useState, useEffect, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Layout, Typography, Space, Button, theme, Tag, Drawer, Spin, Card, App, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  LoadingOutlined,
  SyncOutlined,
  MonitorOutlined,
  StopOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  VerticalAlignBottomOutlined,
  LineHeightOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getPipelineRunDetail, stopPipelineRun } from '../../api/pipeline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useWebSocket from 'react-use-websocket';
import { useTranslation } from 'react-i18next';
import useLogStore from '../../store/useLogStore';
import useAppStore from '../../store/useAppStore';

import AnsibleNode from './nodes/AnsibleNode';
import K8sNode from './nodes/K8sNode';
import HttpNode from './nodes/HttpNode';
import GitNode from './nodes/GitNode';
import BuildNode from './nodes/BuildNode';
import KanikoNode from './nodes/KanikoNode';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const nodeTypes = {
  ansible: AnsibleNode,
  k8s_deploy: K8sNode,
  http_webhook: HttpNode,
  git_clone: GitNode,
  docker_build: BuildNode,
  kaniko_build: KanikoNode,
};

/**
 * [Performance Optimizer] ANSI Log Parser
 * 将 Ansible 的色彩代码 (ANSI Codes) 瞬间解析为 React 样式
 */
const AnsiLog = React.memo(({ text }: { text: string }) => {
  if (!text) return null;
  
  const parseAnsi = (str: string) => {
    // 基础 ANSI 颜色映射表
    const colorMap: Record<string, string> = {
      '31': '#ff4d4f', // Error (Red)
      '32': '#52c41a', // Success (Green)
      '33': '#faad14', // Warning (Yellow)
      '34': '#1890ff', // Info (Blue)
      '36': '#13c2c2', // Cyan
      '90': '#8c8c8c', // Debug (Grey)
    };

    const parts = str.split(/(\u001b\[\d+m)/g);
    let currentColor = '';

    return parts.map((part, i) => {
      const match = part.match(/\u001b\[(\d+)m/);
      if (match) {
        if (match[1] === '0') {
          currentColor = '';
        } else {
          currentColor = colorMap[match[1]] || currentColor;
        }
        return null;
      }
      return <span key={i} style={{ color: currentColor }}>{part}</span>;
    });
  };

  return <div className="leading-relaxed">{parseAnsi(text)}</div>;
});

/**
 * @name ViewerCore
 * @description 流水线运行详情核心逻辑，实现：基于 WebSocket 的 DAG 图秒级状态同步、黑客风格渲染控制台。
 */
const ViewerCore = () => {
  const { t } = useTranslation();
  const { runId } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const logRef = useRef<HTMLPreElement>(null);
  const { token: authToken, hasPermission } = useAppStore();

  // Zustand 持久化：日志查看偏好
  const { autoScroll, setAutoScroll, logFontSize, setLogFontSize } = useLogStore();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  /**
   * @section WebSocket 实时链路
   */
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // 生产环境通常使用当前 Host 的子协议
  const wsUrl = `${protocol}://${window.location.host}/ws/pipeline/${runId}/`;
  
  const { lastJsonMessage, readyState } = useWebSocket(wsUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 20,
    reconnectInterval: 3000,
  });

  /** @description 收到 WS 推送时，即时修正 React Query 缓存，避免全页 Reload */
  useEffect(() => {
    if (lastJsonMessage && (lastJsonMessage as any).type === 'status_update') {
      const newData = (lastJsonMessage as any).data;
      queryClient.setQueryData(['pipeline_run', runId], (old: any) => ({
          ...old, 
          data: old?.data ? { ...old.data, ...newData } : { ...old, ...newData }
      }));
    }
  }, [lastJsonMessage, queryClient, runId]);

  /**
   * @section 数据查询层
   */
  const { data: runData, isLoading } = useQuery({
    queryKey: ['pipeline_run', runId],
    queryFn: () => getPipelineRunDetail(Number(runId)),
    enabled: !!authToken && hasPermission('pipeline:run:view'),
    // 当运行结束时，降低轮询频率或停止轮询 (交由 WS 驱动)
    refetchInterval: (query: any) => {
      // 核心优化：如果 WebSocket 连接正常 (readyState === 1)，则关闭背景轮询
      if (readyState === 1) return false;

      const state = query.state.data?.data || query.state.data;
      if (state?.status && ['success', 'failed', 'cancelled'].includes(state.status)) {
        return false; 
      }
      return 15000;
    },
  });

  /** @description 强制中止任务：下发 SIGTERM 信号 */
  const stopRunMutation = useMutation({
    mutationFn: stopPipelineRun,
    onSuccess: () => {
        message.success(t('runViewer.sigtermBroadcast'));
        queryClient.invalidateQueries({ queryKey: ['pipeline_run', runId] });
    },
    onError: (err: any) => message.error(`${t('runViewer.controlCommandRejected')}: ${err.message}`)
  });

  /**
   * @description 节点状态装饰器 (State Decorator)
   * 将后端打平的执行进度 (nodes[]) 映射回前端的 DAG 坐标点 (graph_data)
   */
  useEffect(() => {
    const payload = runData?.data || runData;
    if (payload && payload.graph_data) {
      const decoratedNodes = (payload.graph_data.nodes || []).map((n: Node) => {
        const runInfo = (payload.nodes || []).find((r: any) => r.node_id === n.id);
        const newData = {
          ...n.data,
          runStatus: runInfo?.status,
          logs: runInfo?.logs,
          runStart: runInfo?.start_time,
          runEnd: runInfo?.end_time
        };
        
        // 如果 Drawer 正开着，实时同步当前节点的日志
        if (drawerVisible && selectedNodeData && selectedNodeData.id === n.id) {
            setSelectedNodeData((prev: any) => ({ ...prev, ...newData }));
        }
        
        return { 
            ...n, 
            data: newData,
            // 针对 Trigger 节点的基础样式对齐
            style: n.type === 'input' ? { 
                ...n.style, 
                background: token.colorBgContainer, 
                color: token.colorText, 
                border: `2px solid ${runInfo?.status === 'success' ? token.colorSuccess : token.colorPrimary}`, 
                borderRadius: '12px' 
            } : n.style
        };
      });
      setNodes(decoratedNodes);
      setEdges(payload.graph_data.edges || []);
    }
  }, [runData, token, drawerVisible]);

  /** @description 日志自动滚动 */
  useEffect(() => {
    if (autoScroll && logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [selectedNodeData?.logs, autoScroll, drawerVisible]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeData({ ...node.data, id: node.id });
    setDrawerVisible(true);
  };

  const payload = runData?.data || runData;

  const getStatusTag = (status: string) => {
      switch(status) {
          case 'running': return <Tag icon={<SyncOutlined spin />} color="processing" className="rounded-full px-3">{t('runViewer.executing')}</Tag>;
          case 'success': return <Tag color="success" className="rounded-full px-3">{t('runViewer.success')}</Tag>;
          case 'failed': return <Tag color="error" className="rounded-full px-3">{t('runViewer.failed')}</Tag>;
          case 'cancelled': return <Tag icon={<StopOutlined />} color="default" className="rounded-full px-3">{t('runViewer.cancelled')}</Tag>;
          default: return <Tag color="default" className="rounded-full px-3">{t('runViewer.queued')}</Tag>;
      }
  };

  return (
    <Layout style={{ background: token.colorBgLayout }} className="h-full overflow-hidden">
      <Header 
        className="px-6 flex items-center justify-between h-16 shadow-sm dark:shadow-none z-20"
        style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Space size="large" className="flex-1">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/v1/pipeline/list')} 
            className="rounded-xl flex items-center justify-center"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
                <MonitorOutlined className="text-blue-500 text-lg" /> 
                <Title level={5} style={{ margin: 0 }}>{payload?.pipeline_name || t('runViewer.detecting')}</Title>
                {getStatusTag(payload?.status)}
            </div>
            <Text type="secondary" className="text-[10px] uppercase tracking-tighter">
                RUN ID: #{runId} | TRIGGER: {payload?.trigger_type || 'MANUAL'}
            </Text>
          </div>
        </Space>
        
        <Space>
           {hasPermission('pipeline:run:stop') && (payload?.status === 'running' || payload?.status === 'pending') && (
              <Button 
                danger 
                type="primary"
                size="middle" 
                icon={<StopOutlined />} 
                onClick={() => {
                    modal.confirm({
                        title: t('runViewer.highRiskOperationForceStop'),
                        content: t('runViewer.forceStopWillReleaseWorker'),
                        okText: t('runViewer.forceEnd'),
                        okType: 'danger',
                        onOk: () => stopRunMutation.mutate(Number(runId)),
                    });
                }}
                loading={stopRunMutation.isPending}
                className="rounded-xl"
              >
                {t('runViewer.abortPipeline')}
              </Button>
          )}
        </Space>
      </Header>
      
      <Content className="relative flex-1">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-white/50 backdrop-blur-xl">
            <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
            <Text type="secondary" className="animate-pulse">{t('runViewer.initializingClusterTopology')}</Text>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            onlyRenderVisibleElements={true} // 避免视野外节点的无效计算
            fitView
            className="bg-transparent"
          >
            <Controls showInteractive={false} style={{ background: token.colorBgContainer, border: 'none' }} className="shadow-xl rounded-xl overflow-hidden" />
            <MiniMap 
                maskColor="rgba(241, 245, 249, 0.6)"
                style={{ background: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
                className="rounded-2xl shadow-lg"
                nodeColor={(n) => {
                    const s = n.data.runStatus;
                    if (s === 'success') return '#22c55e';
                    if (s === 'failed') return '#ef4444';
                    if (s === 'running') return '#3b82f6';
                    return '#94a3b8';
                }}
            />
            <Background gap={32} size={1} color={token.colorBorderSecondary} />
          </ReactFlow>
        )}
      </Content>

      {/* 节点执行详情 (Drawer) */}
      <Drawer
        title={
            <Space size="middle">
                <HistoryOutlined className="text-blue-600" />
                <span className="text-slate-900 dark:text-slate-200 font-bold text-base">{t('runViewer.title')}</span>
            </Space>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        size={650}
        extra={getStatusTag(selectedNodeData?.runStatus)}
        className="custom-run-drawer"
        // bodyStyle={{ display: 'flex', flexDirection: 'column', padding: '0' }}
          styles={{ body: {
                      display: 'flex', flexDirection: 'column', padding: '0'}
                  }}
      >
        <div className="flex flex-col h-full">
          <div className="p-6">
            <Card size="small" className="border-none shadow-sm rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs py-2">
                    <div className="flex flex-col gap-1">
                        <Text type="secondary" className="uppercase text-[10px] tracking-widest font-bold text-slate-500 dark:text-slate-400">{t('runViewer.nodeAlias')}</Text>
                        <Text strong className="text-sm text-slate-800 dark:text-slate-200">{selectedNodeData?.label || t('runViewer.unnamedHostNode')}</Text>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Text type="secondary" className="uppercase text-[10px] tracking-widest font-bold dark:text-slate-500">{t('runViewer.totalDuration')}</Text>
                        <Space className="text-blue-600 dark:text-blue-400 font-mono">
                            <ClockCircleOutlined />
                            <Text strong className="dark:text-blue-400">
                                {(() => {
                                    if (!selectedNodeData?.runStart) return '00:00:00';
                                    const start = new Date(selectedNodeData.runStart).getTime();
                                    const end = selectedNodeData.runEnd ? new Date(selectedNodeData.runEnd).getTime() : Date.now();
                                    const diff = Math.max(0, Math.floor((end - start) / 1000));
                                    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
                                    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
                                    const s = (diff % 60).toString().padStart(2, '0');
                                    return `${h}:${m}:${s}`;
                                })()}
                            </Text>
                        </Space>
                    </div>
                </div>
            </Card>
          </div>

          <div className="flex-1 px-6 pb-6 flex flex-col min-h-0">
             <div className="flex items-center justify-between mb-3 px-2">
                <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('runViewer.terminalRealtimeEcho')}</Text>
                <Space size="middle">
                    <Tooltip title={t('runViewer.autoScrollToBottom')}>
                        <Button
                            type={autoScroll ? 'primary' : 'text'}
                            size="small"
                            icon={<VerticalAlignBottomOutlined />}
                            onClick={() => setAutoScroll(!autoScroll)}
                            className="rounded-lg"
                        />
                    </Tooltip>
                    <Tooltip title={t('runViewer.adjustFontSize')}>
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<LineHeightOutlined />} 
                            onClick={() => setLogFontSize(logFontSize >= 16 ? 11 : logFontSize + 1)}
                            className="rounded-lg"
                        />
                    </Tooltip>
                </Space>
             </div>
             
             <div className="flex-1 bg-slate-950 border border-solid border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden group">
                <pre 
                    ref={logRef}
                    style={{ fontSize: `${logFontSize}px` }}
                    className="absolute inset-0 p-5 font-mono text-slate-300 overflow-y-auto leading-relaxed whitespace-pre-wrap selection:bg-blue-500/30 custom-scrollbar"
                >
                    {selectedNodeData?.logs ? (
                        <AnsiLog text={selectedNodeData.logs} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 gap-2">
                            <SyncOutlined className="text-3xl animate-spin" />
                            <span className="text-[10px]">WAITING FOR STDIO BUFFER...</span>
                        </div>
                    )}
                </pre>
                {/* 日志底部渐变阴影 */}
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-slate-950 to-transparent pointer-events-none" />
             </div>
          </div>
        </div>
      </Drawer>
    </Layout>
  );
};

export default function PipelineRunViewer() {
  const { token } = theme.useToken();
  return (
    <div className="h-screen w-full antialiased selection:bg-blue-500/10" style={{ background: token.colorBgLayout }}>
      <ReactFlowProvider>
        <ViewerCore />
      </ReactFlowProvider>
    </div>
  );
}
