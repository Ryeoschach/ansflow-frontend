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
import { Layout, Typography, Space, Button, theme, Tag, Drawer, Spin, Card, App, Tooltip, Dropdown, Input } from 'antd';
import {
  ArrowLeftOutlined,
  LoadingOutlined,
  SyncOutlined,
  MonitorOutlined,
  StopOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  VerticalAlignBottomOutlined,
  LineHeightOutlined,
  ForkOutlined,
  DownOutlined,
  MinusCircleOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getPipelineRunDetail, stopPipelineRun, retryPipelineRun, approvePipelineNode } from '../../api/pipeline';
import { summarizePipelineRun } from '../../api/ai';
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
import LogTerminal from './components/LogTerminal';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const nodeTypes = {
  ansible: AnsibleNode,
  k8s_deploy: K8sNode,
  http_webhook: HttpNode,
  git_clone: GitNode,
  docker_build: BuildNode,
  kaniko_build: KanikoNode,
  approval: (props: any) => {
    const { data } = props;
    const isWaiting = data.runStatus === 'waiting';
    return (
      <div className={`relative ${isWaiting ? 'animate-pulse scale-105 transition-all duration-1000' : ''}`}>
        <HttpNode {...props} />
      </div>
    );
  }
};

/**
 * [Performance Optimizer] ANSI Log Parser
 * 将 Ansible 的色彩代码 (ANSI Codes) 瞬间解析为 React 样式
 */
const AnsiLog = React.memo(({ text, token }: { text: string; token: any }) => {
  if (!text) return null;

  const parseAnsi = (str: string) => {
    // 基础 ANSI 颜色映射表
    const colorMap: Record<string, string> = {
      '31': token.colorError,
      '32': token.colorSuccess,
      '33': token.colorWarning,
      '34': token.colorInfo,
      '36': token.colorInfo,
      '90': token.colorTextTertiary,
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
  const [incrementalLog, setIncrementalLog] = useState<{nodeId: string, content: string} | null>(null);
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
    if (lastJsonMessage) {
      const msg = lastJsonMessage as any;
      if (msg.type === 'status_update') {
        const newData = msg.data;
        queryClient.setQueryData(['pipeline_run', runId], (old: any) => ({
            ...old, 
            data: old?.data ? { ...old.data, ...newData } : { ...old, ...newData }
        }));
      } else if (msg.type === 'pipeline_node_log_append') {
        // 增量日志处理
        setIncrementalLog({
          nodeId: msg.data.node_id,
          content: msg.data.content
        });
      }
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

  /** @description 从指定节点重试流水线 */
  const retryRunMutation = useMutation({
    mutationFn: (startNodeId: string) => retryPipelineRun(Number(runId), startNodeId),
    onSuccess: (res: any) => {
      message.success(t('runViewer.retryStarted'));
      navigate(`/v1/pipeline/runs/${res.run_id || res.id}`);
    },
    onError: (err: any) => message.error(`${t('runViewer.controlCommandRejected')}: ${err.message}`)
  });

  const approveMutation = useMutation({
    mutationFn: (action: 'pass' | 'reject') => {
        const payload = runData?.data || runData;
        const nodeRun = payload.nodes.find((n: any) => n.node_id === selectedNodeData?.id);
        return approvePipelineNode(nodeRun.id, action, (document.getElementById('approval-comment') as HTMLTextAreaElement)?.value);
    },
    onSuccess: () => {
        message.success(t('common.success'));
        queryClient.invalidateQueries({ queryKey: ['pipeline_run', runId] });
    }
  });

  const summarizeMutation = useMutation({
    mutationFn: () => summarizePipelineRun(runId!),
    onSuccess: (res: any) => {
        message.success(res.message);
    }
  });

  /**
   * @description 获取 nodeId 的所有前置节点（通过边反向遍历）
   */
  const getAncestors = (nodeId: string, edgeList: Edge[]): string[] => {
    const ancestors: string[] = [];
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const parents = edgeList.filter(e => e.target === current).map(e => e.source);
      parents.forEach(p => {
        if (!visited.has(p)) {
          ancestors.push(p);
          queue.push(p);
        }
      });
    }
    return ancestors;
  };

  /**
   * @description 获取所有可作为起点的候选节点
   */
  const getViableStartNodes = (nodeList: Node[], edgeList: Edge[], lastRunNodes: any[]): Node[] => {
    const failedNodeIds = new Set(lastRunNodes.filter((n: any) => n.status === 'failed').map((n: any) => n.node_id));
    return nodeList.filter(n => {
      // 必须与失败节点有关联（是失败节点或其下游）
      const ancestors = getAncestors(n.id, edgeList);
      const hasFailedAncestor = ancestors.some(a => failedNodeIds.has(a)) || failedNodeIds.has(n.id);
      if (!hasFailedAncestor) return false;

      // 所有直接上游必须都已成功或跳过（或者是入口节点）
      const immediateParents = edgeList.filter(e => e.target === n.id).map(e => e.source);
      const allParentsDone = immediateParents.every(pid => {
        const parentNode = lastRunNodes.find((r: any) => r.node_id === pid);
        return parentNode?.status === 'success' || parentNode?.status === 'skipped' || parentNode === undefined;
      });
      return allParentsDone || immediateParents.length === 0;
    });
  };

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
          case 'waiting': return <Tag icon={<SyncOutlined spin />} color="purple" className="rounded-full px-3">等待审批</Tag>;
          case 'cancelled': return <Tag icon={<StopOutlined />} color="default" className="rounded-full px-3">{t('runViewer.cancelled')}</Tag>;
          case 'skipped': return <Tag icon={<MinusCircleOutlined />} color="default" className="rounded-full px-3">{t('runViewer.skipped')}</Tag>;
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
                <MonitorOutlined style={{ color: token.colorPrimary }} className="text-lg" /> 
                <Title level={5} style={{ margin: 0 }}>{payload?.pipeline_name || t('runViewer.detecting')}</Title>
                {getStatusTag(payload?.status)}
            </div>
            <Text type="secondary" className="text-[10px] uppercase tracking-tighter">
                RUN ID: #{runId} | TRIGGER: {payload?.trigger_type || 'MANUAL'}
            </Text>
          </div>
        </Space>
        
        <Space>
           {payload?.status === 'success' && (
              <Tooltip title={t('runViewer.aiSummaryTip')}>
                <Button 
                    icon={<RobotOutlined className="text-blue-500" />} 
                    onClick={() => summarizeMutation.mutate()}
                    loading={summarizeMutation.isPending}
                >
                    {t('runViewer.aiSummary')}
                </Button>
              </Tooltip>
           )}
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
          {hasPermission('pipeline:run:retry') && payload?.status === 'failed' && (
            <Dropdown
              menu={{
                items: [
                  { key: 'full', label: t('runViewer.retryFromBeginning'), onClick: () => retryRunMutation.mutate('') },
                  { type: 'divider' },
                  ...getViableStartNodes(nodes, edges, (payload?.nodes || [])).map(n => ({
                    key: n.id,
                    label: t('runViewer.retryFromNode', { node: n.data?.label || n.id }),
                    onClick: () => retryRunMutation.mutate(n.id)
                  }))
                ]
              }}
              disabled={retryRunMutation.isPending}
            >
              <Button icon={<ForkOutlined />} loading={retryRunMutation.isPending} className="rounded-xl">
                {t('runViewer.retryFromThisNode')} <DownOutlined />
              </Button>
            </Dropdown>
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
                    if (s === 'success') return token.colorSuccess;
                    if (s === 'failed') return token.colorError;
                    if (s === 'running') return token.colorPrimary;
                    if (s === 'waiting') return '#722ed1';
                    return token.colorTextTertiary;
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
                <HistoryOutlined style={{ color: token.colorPrimary }} />
                <span className="font-bold text-base" style={{ color: token.colorTextHeading }}>{t('runViewer.title')}</span>
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
            {selectedNodeData?.runStatus === 'waiting' && (
                <Card 
                    size="small" 
                    title={<Space><MonitorOutlined className="text-purple-500" /><span>审批干预</span></Space>}
                    className="mb-4 border-2 border-purple-100 bg-purple-50/30 rounded-2xl overflow-hidden shadow-sm"
                >
                    <div className="space-y-3">
                        <Text type="secondary" className="text-[11px]">该步骤需要人工确认后才能继续执行，请填写审核意见：</Text>
                        <Input.TextArea 
                            id="approval-comment"
                            placeholder="请输入审核意见 (可选)" 
                            rows={3} 
                            className="rounded-xl border-purple-200"
                        />
                        <Space className="w-full justify-end">
                            <Button 
                                danger 
                                ghost 
                                className="rounded-lg"
                                onClick={() => approveMutation.mutate('reject')}
                                loading={approveMutation.isPending}
                            >
                                驳回
                            </Button>
                            <Button 
                                type="primary" 
                                className="rounded-lg bg-purple-600 hover:bg-purple-500 border-none"
                                onClick={() => approveMutation.mutate('pass')}
                                loading={approveMutation.isPending}
                            >
                                通过并继续
                            </Button>
                        </Space>
                    </div>
                </Card>
            )}
            <Card size="small" className="border-none shadow-sm rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs py-2">
                    <div className="flex flex-col gap-1">
                        <Text type="secondary" className="uppercase text-[10px] tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>{t('runViewer.nodeAlias')}</Text>
                        <Text strong className="text-sm" style={{ color: token.colorText }}>{selectedNodeData?.label || t('runViewer.unnamedHostNode')}</Text>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Text type="secondary" className="uppercase text-[10px] tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>{t('runViewer.totalDuration')}</Text>
                        <Space className="font-mono" style={{ color: token.colorPrimary }}>
                            <ClockCircleOutlined />
                            <Text strong style={{ color: token.colorPrimary }}>
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
                {selectedNodeData?.runStatus === 'failed' && (
                  <div className="mt-4 pt-4 border-t flex gap-2" style={{ borderColor: token.colorBorderSecondary }}>
                    {payload?.diagnosis_history_id ? (
                      <>
                        <Button
                          type="primary"
                          icon={<RobotOutlined />}
                          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl"
                          onClick={() => {
                            setDrawerVisible(false);
                            useAppStore.getState().setAiDiagnosis({
                              target_type: 'pipeline',
                              target_id: runId!,
                              target_name: payload?.pipeline_name,
                              history_id: payload.diagnosis_history_id
                            });
                          }}
                        >
                          查看 AI 诊断结论
                        </Button>
                        <Tooltip title="重新分析">
                          <Button
                            icon={<SyncOutlined />}
                            className="h-10 w-10 flex items-center justify-center rounded-xl"
                            onClick={() => {
                              setDrawerVisible(false);
                              useAppStore.getState().setAiDiagnosis({
                                target_type: 'pipeline',
                                target_id: runId!,
                                target_name: payload?.pipeline_name
                              });
                            }}
                          />
                        </Tooltip>
                      </>
                    ) : (
                      <Button
                        type="primary"
                        danger
                        icon={<RobotOutlined />}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl"
                        onClick={() => {
                          setDrawerVisible(false);
                          useAppStore.getState().setAiDiagnosis({
                            target_type: 'pipeline',
                            target_id: runId!,
                            target_name: payload?.pipeline_name
                          });
                        }}
                      >
                        AI 智能诊断
                      </Button>
                    )}
                  </div>
                )}
            </Card>
          </div>

          {selectedNodeData?.runStatus === 'failed' && (
            <div className="px-6 pb-4">
              <Button
                type="primary"
                icon={<ForkOutlined />}
                onClick={() => {
                  modal.confirm({
                    title: t('runViewer.confirmRetryFromNode'),
                    content: t('runViewer.confirmRetryFromNodeTip', { node: selectedNodeData?.label }),
                    okText: t('common.confirm'),
                    onOk: () => retryRunMutation.mutate(selectedNodeData.id)
                  });
                }}
                loading={retryRunMutation.isPending}
                className="rounded-xl w-full"
              >
                {t('runViewer.retryFromThisNode')}
              </Button>
            </div>
          )}

          <div className="flex-1 px-6 pb-6 flex flex-col min-h-0">
             <div className="flex items-center justify-between mb-3 px-2">
                <Text className="text-[11px] font-bold uppercase tracking-widest" style={{ color: token.colorTextTertiary }}>{t('runViewer.terminalRealtimeEcho')}</Text>
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
                {(selectedNodeData?.logs || (selectedNodeData?.id && incrementalLog?.nodeId === selectedNodeData.id)) ? (
                    <LogTerminal
                        logs={selectedNodeData?.logs}
                        incrementalLog={(selectedNodeData?.id && incrementalLog?.nodeId === selectedNodeData.id) ? incrementalLog?.content : undefined}
                        fontSize={logFontSize}
                        autoScroll={autoScroll}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 gap-2">
                        <SyncOutlined className="text-3xl animate-spin" />
                        <span className="text-[10px]">WAITING FOR STDIO BUFFER...</span>
                    </div>
                )}
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
