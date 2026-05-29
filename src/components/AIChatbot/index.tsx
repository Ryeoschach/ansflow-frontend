import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Card, Space, Avatar, FloatButton, Typography, theme, Dropdown, MenuProps, Tag, Drawer, List, Tooltip, Empty, Skeleton, Tabs, Alert, Select } from 'antd';
import { 
    RobotOutlined, UserOutlined, SendOutlined, MinusOutlined, PlayCircleOutlined, 
    CoffeeOutlined, ThunderboltOutlined, UserSwitchOutlined, HistoryOutlined, 
    PlusOutlined, MessageOutlined, DeleteOutlined, SearchOutlined, BookOutlined,
    RocketOutlined, StopOutlined, LoadingOutlined
} from '@ant-design/icons';
import { App, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import useAppStore from '@/store/useAppStore';
import { 
    createChatHistory, getChatHistories, getChatMessages, 
    saveMessageToKnowledge, getAIModels, getCurrentAIConfig, AIModel,
    saveDiagnosisToKnowledge
    } from '../../api/ai';

import { useNavigate } from 'react-router-dom';
import { executePipeline } from '@/api/pipeline';
import { createAnsibleTask } from '@/api/tasks';
import useDesignerStore from '@/store/useDesignerStore';

const { Text } = Typography;

interface Message {
    id?: number;
    role: 'user' | 'assistant';
    content: string;
    is_exported?: boolean;
    referenced_docs?: { id: number; title: string }[];
}

type PersonalityKey = 'professional' | 'concise' | 'humorous';

const AIChatbot: React.FC = () => {
    const { token } = theme.useToken();
    const { t } = useTranslation();
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    
    // --- UI 状态 ---
    const [visible, setVisible] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'success' | 'error' | 'timeout'>('idle');
    
    // --- 数据状态 ---
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [historyTab, setHistoryTab] = useState<'chat' | 'diagnose'>('chat');
    const [historySearch, setHistorySearch] = useState('');
    const [historyId, setHistoryId] = useState<number | null>(null);
    const [suggestedPipelineId, setSuggestedPipelineId] = useState<number | null>(null);
    const [pipelineDraft, setPipelineDraft] = useState<any | null>(null);
    const [ansibleDraft, setAnsibleDraft] = useState<any | null>(null);
    const [isRegisteringTask, setIsRegisteringTask] = useState(false);
    const [personality, setPersonality] = useState<PersonalityKey>(
        (localStorage.getItem('ansflow-ai-personality') as PersonalityKey) || 'professional'
    );
    const [llmModels, setLlmModels] = useState<AIModel[]>([]);
    const [selectedLLMId, setSelectedLLMId] = useState<number | undefined>(undefined);
    
    const appToken = useAppStore(state => state.token);
    const currentUser = useAppStore(state => state.currentUser);
    const userAvatar = useAppStore(state => state.avatar);
    const aiDiagnosisConfig = useAppStore(state => state.aiDiagnosisConfig);
    const setAiDiagnosis = useAppStore(state => state.setAiDiagnosis);
    
    const { setNodes, setEdges, setEditingId, setSourceAlertId } = useDesignerStore();
    const navigate = useNavigate();

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    
    // 追踪当前诊断的告警 ID
    const [diagnosedAlertId, setDiagnosedAlertId] = useState<number | null>(null);

    // 监听性格变化并持久化
    useEffect(() => {
        localStorage.setItem('ansflow-ai-personality', personality);
    }, [personality]);

    // 组件卸载时关闭连接
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    // 加载可用模型和默认配置
    useEffect(() => {
        if (!useAppStore.getState().isInitializing && appToken) {
            getAIModels({ model_type: 'llm' }).then(res => {
                const models = Array.isArray(res) ? res : ((res as any).data || (res as any).results || []);
                setLlmModels(models);
            });
            getCurrentAIConfig().then(config => {
                if (config && config.default_llm) setSelectedLLMId(config.default_llm);
            });
        }
    }, [appToken]);

    const personalityItems: MenuProps['items'] = [
        { key: 'professional', label: t('ai.personality.professional'), icon: <RobotOutlined /> },
        { key: 'concise', label: t('ai.personality.concise'), icon: <ThunderboltOutlined /> },
        { key: 'humorous', label: t('ai.personality.humorous'), icon: <CoffeeOutlined /> },
    ];

    // 点击外部自动收起
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const isClickOnButton = target.closest('.ant-float-btn');
            const isClickOnOverlay = target.closest('.ant-dropdown') || target.closest('.ant-select-dropdown') || target.closest('.ant-modal');
            if (containerRef.current && !containerRef.current.contains(target) && !isClickOnButton && !isClickOnOverlay) {
                setVisible(false);
                setHistoryVisible(false);
            }
        };
        if (visible) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [visible]);

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // 监听外部诊断触发
    useEffect(() => {
        if (aiDiagnosisConfig) {
            setVisible(true);
            setHistoryVisible(false); // 强制关闭历史列表，进入对话视图
            if (aiDiagnosisConfig.history_id) {
                // 如果已经诊断过，直接加载历史
                loadMessages(aiDiagnosisConfig.history_id);
            } else {
                // 否则开始新的诊断
                handleDiagnose(aiDiagnosisConfig.target_type, aiDiagnosisConfig.target_id, aiDiagnosisConfig.target_name);
            }
            setAiDiagnosis(null);
        }
    }, [aiDiagnosisConfig]);

    // 加载历史列表
    const loadHistoryList = async (tab?: 'chat' | 'diagnose', search?: string) => {
        setHistoryLoading(true);
        try {
            const res = await getChatHistories({ 
                history_type: tab || historyTab,
                search: search !== undefined ? search : historySearch,
                size: 100 
            });
            setHistoryList(res.data || []);
        } catch (err) {
            console.error('Failed to load histories', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // 加载特定会话的消息
    const loadMessages = async (hid: number) => {
        setLoading(true);
        setHistoryId(hid);
        setMessages([]);
        setSuggestedPipelineId(null);
        setPipelineDraft(null);
        setAnsibleDraft(null);
        
        // 查找并恢复当时的 AI 性格
        if (historyList.length > 0) {
            const historyItem = historyList.find(h => h.id === hid);
            if (historyItem && historyItem.personality) {
                setPersonality(historyItem.personality as PersonalityKey);
            }
        }

        try {
            const res = await getChatMessages(hid);
            const loadedMessages = res.map((m: any) => {
                let content = m.content;
                
                // --- 历史记录解析逻辑：如果是助手发出的消息，尝试恢复草案卡片 ---
                if (m.role === 'assistant') {
                    // 1. 恢复建议流水线 ID (如果是诊断场景)
                    if (content.includes('__SUGGESTION__:')) {
                        const match = content.match(/__SUGGESTION__:(\{.*?\})/);
                        if (match) {
                            try {
                                const suggestion = JSON.parse(match[1]);
                                setSuggestedPipelineId(suggestion.pipeline_id);
                                content = content.replace(/__SUGGESTION__:\{.*?\}/, '').trim();
                            } catch (e) {}
                        }
                    }

                    // 2. 恢复 Ansible 草案
                    if (content.includes('__ANSIBLE_DRAFT__:')) {
                        const startIndex = content.indexOf('__ANSIBLE_DRAFT__:');
                        const jsonStart = content.indexOf('{', startIndex);
                        const jsonEnd = content.lastIndexOf('}');
                        if (jsonStart !== -1 && jsonEnd > jsonStart) {
                            try {
                                const draft = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
                                setAnsibleDraft(draft);
                                content = (content.substring(0, startIndex) + content.substring(jsonEnd + 1)).trim();
                            } catch (e) {}
                        }
                    }

                    // 3. 恢复流水线草案
                    if (content.includes('__PIPELINE_DRAFT__:')) {
                        const startIndex = content.indexOf('__PIPELINE_DRAFT__:');
                        const jsonStart = content.indexOf('{', startIndex);
                        const jsonEnd = content.lastIndexOf('}');
                        if (jsonStart !== -1 && jsonEnd > jsonStart) {
                            try {
                                const draft = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
                                setPipelineDraft(draft);
                                content = (content.substring(0, startIndex) + content.substring(jsonEnd + 1)).trim();
                            } catch (e) {}
                        }
                    }
                }

                return { 
                    id: m.id, 
                    role: m.role, 
                    content: content,
                    is_exported: m.is_exported
                };
            });
            
            setMessages(loadedMessages);
            setHistoryVisible(false);
        } catch (err) {
            message.error(t('ai.loadHistoryFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKnowledge = async (msgId?: number) => {
        if (!historyId || !msgId) return;
        
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        let finalTitle = t('ai.experienceTitle', { date: new Date().toLocaleDateString() });
        let finalContent = msg.content;

        modal.confirm({
            title: t('ai.exportToKB'),
            width: 600,
            content: (
                <div className="mt-4 space-y-4 text-left">
                    <div>
                        <div className="text-[11px] mb-1 opacity-50 font-bold uppercase tracking-wider">{t('ai.docTitle')}</div>
                        <Input 
                            defaultValue={finalTitle} 
                            onChange={e => { finalTitle = e.target.value }}
                            placeholder={t('ai.docTitle')}
                        />
                    </div>
                    <div>
                        <div className="text-[11px] mb-1 opacity-50 font-bold uppercase tracking-wider">{t('ai.docContent')}</div>
                        <Input.TextArea 
                            defaultValue={finalContent} 
                            onChange={e => { finalContent = e.target.value }}
                            rows={12}
                            className="font-mono text-[11px]"
                        />
                    </div>
                    <Alert 
                        message={t('common.info')} 
                        description={t('ai.exportTip')} 
                        type="info" 
                        showIcon 
                        className="text-[11px]"
                    />
                </div>
            ),
            okText: t('ai.exportConfirm'),
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await saveDiagnosisToKnowledge(historyId, msgId, finalTitle, finalContent);
                    message.success(t('ai.saveKnowledgeSuccess'));
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_exported: true } : m));
                } catch (err) {
                    message.error(t('ai.saveKnowledgeFailed'));
                }
            }
        });
    };

    const startNewChat = () => {
        setHistoryId(null);
        setMessages([]);
        setHistoryVisible(false);
    };

    const handleDiagnose = async (type: 'pipeline' | 'task' | 'alert', id: number | string, targetName?: string) => {
        const typeText = t(`ai.${type}`);
        const displayTitle = targetName ? `${typeText}: ${targetName}` : `${typeText} #${id}`;
        
        // 记录告警 ID
        if (type === 'alert') {
            setDiagnosedAlertId(Number(id));
        } else {
            setDiagnosedAlertId(null);
        }

        // 修正：将名称信息带入首条提示消息
        const initialContent = t('ai.diagnosing', { 
            type: targetName ? `${typeText}: ${targetName}` : typeText, 
            id 
        });
        setMessages([{ role: 'user', content: initialContent }]);
        
        setLoading(true);
        setAiStatus('analyzing');
        setSuggestedPipelineId(null);
        setPipelineDraft(null);
        setAnsibleDraft(null);
        
        // 超时检测：如果 60 秒还没返回，标记为超时
        const timeoutTimer = setTimeout(() => {
            setAiStatus('timeout');
        }, 60000);

        try {
            // 设置新的 abort controller
            abortControllerRef.current = new AbortController();

            // 首先创建一个专门用于记录诊断的历史会话
            const sid = `diagnose_${type}_${id}_${Date.now()}`;
            const historyRes = await createChatHistory({
                user_id: currentUser || 'guest',
                session_id: sid,
                title: t('ai.diagnosisHistoryTitle', { title: displayTitle }),
                personality: personality,
                history_type: 'diagnose'
            });
            const currentHid = historyRes.id;
            setHistoryId(currentHid);

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            const response = await fetch(`/api/v1/ai/chat-histories/${currentHid}/diagnose/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appToken}` },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({ 
                    target_type: type, 
                    target_id: id, 
                    personality,
                    history_id: currentHid,
                    llm_id: selectedLLMId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Server responded with error');
            }

            if (!response.body) throw new Error('No response body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantReply = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                assistantReply += chunk;

                // --- 增强型解析逻辑：从累积文本中提取标记 ---
                
                // 1. 提取消息 ID
                if (assistantReply.includes('__MESSAGE_ID__:')) {
                    const match = assistantReply.match(/__MESSAGE_ID__:(\d+)/);
                    if (match) {
                        const msgId = parseInt(match[1]);
                        setMessages(prev => {
                            const newMessages = [...prev];
                            newMessages[newMessages.length - 1].id = msgId;
                            return newMessages;
                        });
                        // 从显示文本中移除标记
                        assistantReply = assistantReply.replace(/__MESSAGE_ID__:\d+/, '').trim();
                    }
                }

                // 1.5 提取引用文档
                if (assistantReply.includes('__REFERENCES__:')) {
                    const match = assistantReply.match(/__REFERENCES__:(\[.*?\])\n/);
                    if (match) {
                        try {
                            const refs = JSON.parse(match[1]);
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1].referenced_docs = refs;
                                return newMessages;
                            });
                            assistantReply = assistantReply.replace(/__REFERENCES__:\[.*?\]\n/, '').trim();
                        } catch (e) {}
                    }
                }

                // 2. 提取建议流水线 ID
                if (assistantReply.includes('__SUGGESTION__:')) {
                    const match = assistantReply.match(/__SUGGESTION__:(\{.*?\})/);
                    if (match) {
                        try {
                            const suggestion = JSON.parse(match[1]);
                            setSuggestedPipelineId(suggestion.pipeline_id);
                            assistantReply = assistantReply.replace(/__SUGGESTION__:\{.*?\}/, '').trim();
                        } catch (e) {}
                    }
                }

                // 3. 提取流水线草案 (JSON)
                if (assistantReply.includes('__PIPELINE_DRAFT__:')) {
                    // 使用更健壮的匹配：从标记开始，寻找最外层的最后一个花括号
                    const startIndex = assistantReply.indexOf('__PIPELINE_DRAFT__:');
                    const jsonStart = assistantReply.indexOf('{', startIndex);
                    const jsonEnd = assistantReply.lastIndexOf('}');
                    
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        const jsonStr = assistantReply.substring(jsonStart, jsonEnd + 1);
                        try {
                            const draft = JSON.parse(jsonStr);
                            setPipelineDraft(draft);
                            // 匹配成功后，从展示文本中彻底移除标记和 JSON 部分
                            assistantReply = (assistantReply.substring(0, startIndex) + assistantReply.substring(jsonEnd + 1)).trim();
                        } catch (e) {
                            // JSON 可能还在传输中，不完整，等待下一个 chunk
                        }
                    }
                }

                // 4. 提取 Ansible 任务草案 (JSON)
                if (assistantReply.includes('__ANSIBLE_DRAFT__:')) {
                    const startIndex = assistantReply.indexOf('__ANSIBLE_DRAFT__:');
                    const jsonStart = assistantReply.indexOf('{', startIndex);
                    const jsonEnd = assistantReply.lastIndexOf('}');
                    
                    if (jsonStart !== -1 && jsonEnd > jsonStart) {
                        const jsonStr = assistantReply.substring(jsonStart, jsonEnd + 1);
                        try {
                            const draft = JSON.parse(jsonStr);
                            setAnsibleDraft(draft);
                            assistantReply = (assistantReply.substring(0, startIndex) + assistantReply.substring(jsonEnd + 1)).trim();
                        } catch (e) {
                        }
                    }
                }

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantReply;
                    return newMessages;
                });
            }
            clearTimeout(timeoutTimer);
            setAiStatus('success');

            // 诊断成功后，触发相关数据的刷新，让按钮即时更新
            if (type === 'pipeline') {
                queryClient.invalidateQueries({ queryKey: ['pipeline_run', String(id)] });
            }

            // 3秒后恢复正常状态
            setTimeout(() => setAiStatus('idle'), 3000);
        } catch (err: any) { 
            if (err.name === 'AbortError') {
                setAiStatus('idle');
                setLoading(false);
                return;
            }
            message.error(t('ai.diagnosisError')); 
            setAiStatus('error');
            clearTimeout(timeoutTimer);
        } finally { setLoading(false); }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userQuestion = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
        setLoading(true);
        setAiStatus('analyzing');

        try {
            let currentHid = historyId;
            if (!currentHid) {
                const sid = `session_${Date.now()}`;
                const res = await createChatHistory({
                    user_id: currentUser || 'guest',
                    session_id: sid,
                    title: userQuestion.slice(0, 20),
                    personality: personality,
                    history_type: 'chat'
                });
                currentHid = res.id;
                setHistoryId(res.id);
            }
            await streamResponse(currentHid, userQuestion);
            setAiStatus('success');
            setTimeout(() => setAiStatus('idle'), 3000);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setAiStatus('idle');
                setLoading(false);
                return;
            }
            message.error(t('ai.responseError'));
            setLoading(false);
            setAiStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const streamResponse = (hid: number, question: string) => {
        return new Promise<void>((resolve, reject) => {
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            setPipelineDraft(null); // Reset draft for new query
            setAnsibleDraft(null);

            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.host;
            const currentProject = useAppStore.getState().currentProject;
            const projectId = currentProject?.id || 'default';
            const wsUrl = `${wsProtocol}//${wsHost}/ws/ai/chat/?token=${appToken}&project_id=${projectId}`;

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            let assistantReply = '';

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    question,
                    history_id: hid,
                    personality,
                    llm_id: selectedLLMId
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'start') {
                        return;
                    }
                    if (data.type === 'chunk') {
                        const chunk = data.text;
                        assistantReply += chunk;

                        // 1. 提取消息 ID
                        if (assistantReply.includes('__MESSAGE_ID__:')) {
                            const match = assistantReply.match(/__MESSAGE_ID__:(\d+)/);
                            if (match) {
                                const msgId = parseInt(match[1]);
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].id = msgId;
                                    return newMessages;
                                });
                                assistantReply = assistantReply.replace(/__MESSAGE_ID__:\d+/, '').trim();
                            }
                        }

                        // 2. 提取流水线草案 (JSON)
                        if (assistantReply.includes('__PIPELINE_DRAFT__:')) {
                            const startIndex = assistantReply.indexOf('__PIPELINE_DRAFT__:');
                            const jsonStart = assistantReply.indexOf('{', startIndex);
                            const jsonEnd = assistantReply.lastIndexOf('}');
                            
                            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                                const jsonStr = assistantReply.substring(jsonStart, jsonEnd + 1);
                                try {
                                    const draft = JSON.parse(jsonStr);
                                    setPipelineDraft(draft);
                                    assistantReply = (assistantReply.substring(0, startIndex) + assistantReply.substring(jsonEnd + 1)).trim();
                                } catch (e) {}
                            }
                        }

                        // 3. 提取 Ansible 任务草案 (JSON)
                        if (assistantReply.includes('__ANSIBLE_DRAFT__:')) {
                            const startIndex = assistantReply.indexOf('__ANSIBLE_DRAFT__:');
                            const jsonStart = assistantReply.indexOf('{', startIndex);
                            const jsonEnd = assistantReply.lastIndexOf('}');
                            
                            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                                const jsonStr = assistantReply.substring(jsonStart, jsonEnd + 1);
                                try {
                                    const draft = JSON.parse(jsonStr);
                                    setAnsibleDraft(draft);
                                    assistantReply = (assistantReply.substring(0, startIndex) + assistantReply.substring(jsonEnd + 1)).trim();
                                } catch (e) {}
                            }
                        }

                        setMessages(prev => {
                            const newMessages = [...prev];
                            newMessages[newMessages.length - 1].content = assistantReply;
                            return newMessages;
                        });
                    } else if (data.type === 'end') {
                        const msgId = data.message_id;
                        const refs = data.referenced_docs;
                        setMessages(prev => {
                            const newMessages = [...prev];
                            const lastMsg = newMessages[newMessages.length - 1];
                            if (msgId) lastMsg.id = msgId;
                            if (refs) lastMsg.referenced_docs = refs;
                            return newMessages;
                        });
                        ws.close();
                    } else if (data.type === 'error') {
                        message.error(t('ai.aiError', { message: data.message }));
                        reject(new Error(data.message));
                        ws.close();
                    }
                } catch (e) {
                    console.error('Error parsing WS message:', e);
                }
            };

            ws.onclose = (event) => {
                socketRef.current = null;
                setLoading(false);
                if (event.code === 4001) {
                    message.error(t('ai.wsUnauthenticated'));
                    reject(new Error('Unauthenticated'));
                } else if (event.code === 4003) {
                    message.error(t('ai.wsForbidden'));
                    reject(new Error('Forbidden'));
                } else {
                    resolve();
                }
            };

            ws.onerror = (err) => {
                console.error('WS Error:', err);
                socketRef.current = null;
                setLoading(false);
                reject(err);
            };
        });
    };

    const handleRegisterAnsibleTask = async () => {
        if (!ansibleDraft) return;
        setIsRegisteringTask(true);
        try {
            const res = await createAnsibleTask({
                name: ansibleDraft.name || 'AI Generated Playbook',
                task_type: 'playbook',
                content: ansibleDraft.content
            });
            const newTaskId = res.id || res.data?.id;
            message.success(t('ai.ansibleRegisterSuccess', { id: newTaskId }));
            
            // If there's a pipeline draft waiting for this task, inject the ID
            if (pipelineDraft) {
                const updatedNodes = (pipelineDraft.nodes || []).map((node: any) => {
                    if (node.type === 'ansible' && node.data?.ansible_task_id === '{{__ANSIBLE_DRAFT_ID__}}') {
                        return { ...node, data: { ...node.data, ansible_task_id: newTaskId } };
                    }
                    return node;
                });
                setPipelineDraft({ ...pipelineDraft, nodes: updatedNodes });
            }
            // 移除已处理的 Ansible draft
            setAnsibleDraft(null);
        } catch (e: any) {
            message.error(t('ai.ansibleRegisterFailed', { message: e.response?.data?.error || e.message }));
        } finally {
            setIsRegisteringTask(false);
        }
    };

    return createPortal(
        <>
            <style>
                {`
                    @keyframes ai-glow-breathe {
                        0% { box-shadow: 0 0 0 0 ${token.colorPrimary}60; }
                        70% { box-shadow: 0 0 0 12px ${token.colorPrimary}00; }
                        100% { box-shadow: 0 0 0 0 ${token.colorPrimary}00; }
                    }
                    @keyframes ai-glow-analyzing {
                        0% { box-shadow: 0 0 0 0 #faad1480; }
                        50% { box-shadow: 0 0 0 15px #faad1400; }
                        100% { box-shadow: 0 0 0 0 #faad1400; }
                    }
                    .ai-float-button-breathe { animation: ai-glow-breathe 2s infinite; }
                    .ai-float-button-analyzing { animation: ai-glow-analyzing 1s infinite; }
                    .ai-chat-messages::-webkit-scrollbar { width: 4px; }
                    
                    /* AI 打字中跳动动画 */
                    .ai-typing {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        height: 20px;
                    }
                    .ai-typing-dot {
                        width: 4px;
                        height: 4px;
                        background-color: ${token.colorPrimary};
                        border-radius: 50%;
                        opacity: 0.4;
                        animation: ai-typing-bounce 1.4s infinite ease-in-out both;
                    }
                    .ai-typing-dot:nth-child(1) { animation-delay: -0.32s; }
                    .ai-typing-dot:nth-child(2) { animation-delay: -0.16s; }
                    
                    @keyframes ai-typing-bounce {
                        0%, 80%, 100% { transform: scale(0); }
                        40% { transform: scale(1.0); opacity: 1; }
                    }

                    .ai-chat-messages::-webkit-scrollbar-thumb { background: ${token.colorTextQuaternary}; border-radius: 10px; }
                    .ai-chat-messages::-webkit-scrollbar-track { background: transparent; }
                    .ai-assistant-bubble {
                        background-color: ${token.colorBgElevated};
                        border: 1px solid ${token.colorBorderSecondary} !important;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    }
                    .dark .ai-assistant-bubble {
                        background-color: ${token.colorFillAlter};
                    }
                `}
            </style>
            <FloatButton
                icon={<RobotOutlined />}
                type={aiStatus === 'analyzing' ? 'default' : 'primary'}
                onClick={() => {
                    setVisible(!visible);
                    if (!visible && messages.length === 0) startNewChat();
                }}
                className={`transition-transform hover:scale-110 shadow-lg ${
                    aiStatus === 'analyzing' ? 'ai-float-button-analyzing' : 'ai-float-button-breathe'
                }`}
                style={{ 
                    position: 'fixed',
                    right: 24,
                    bottom: '75vh',
                    backgroundColor: aiStatus === 'analyzing' ? '#fffbe6' : undefined,
                    borderColor: aiStatus === 'analyzing' ? '#ffe58f' : undefined,
                    zIndex: 2147483647 
                }}
                badge={{ 
                    dot: aiStatus === 'idle',
                    count: aiStatus !== 'idle' ? {
                        'analyzing': t('ai.statusAnalyzing'),
                        'success': t('ai.statusSuccess'),
                        'error': t('ai.statusError'),
                        'timeout': t('ai.statusTimeout')
                    }[aiStatus] : undefined,
                    color: {
                        'idle': token.colorSuccess,
                        'analyzing': '#faad14',
                        'success': '#52c41a',
                        'error': '#ff4d4f',
                        'timeout': '#fa8c16'
                    }[aiStatus]
                }}
            />

            {visible && (
                <div 
                    ref={containerRef} 
                    style={{ zIndex: 2147483647, position: 'fixed', top: 0, left: 0, width: 0, height: 0 }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <Card
                        title={
                            <Flex vertical gap={6} style={{ padding: '4px 0' }}>
                                <Flex align="center" justify="space-between">
                                    <div className="flex items-center gap-2" style={{ color: token.colorTextHeading }}>
                                        <Button 
                                            type="text" 
                                            size="small" 
                                            icon={<HistoryOutlined />} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setHistoryVisible(!historyVisible);
                                                if (!historyVisible) loadHistoryList();
                                            }}
                                        />
                                        <span className="font-semibold text-base">{t('ai.title')}</span>
                                    </div>
                                </Flex>
                                
                                <Flex align="center" gap={4} className="pl-9">
                                    <Dropdown 
                                        menu={{ 
                                            items: personalityItems, 
                                            selectable: true,
                                            selectedKeys: [personality],
                                            onClick: ({ key }) => setPersonality(key as PersonalityKey) 
                                        }} 
                                        trigger={['click']}
                                        placement="bottom"
                                        getPopupContainer={() => document.body}
                                        overlayClassName="z-[2147483647]"
                                    >
                                        <Tag 
                                            icon={<UserSwitchOutlined />} 
                                            className="cursor-pointer hover:opacity-80 transition-opacity border-none text-[10px] py-0.5 px-2" 
                                            style={{ color: token.colorPrimary, backgroundColor: token.colorPrimaryBg }}
                                        >
                                            {(personalityItems.find(i => i?.key === personality) as any)?.label as string}
                                        </Tag>
                                    </Dropdown>

                                    <Dropdown 
                                        menu={{ 
                                            items: llmModels.map(m => ({
                                                key: String(m.id),
                                                label: m.display_name,
                                                icon: <RocketOutlined />
                                            })), 
                                            selectable: true,
                                            selectedKeys: [String(selectedLLMId)],
                                            onClick: ({ key }) => setSelectedLLMId(Number(key)) 
                                        }} 
                                        trigger={['click']}
                                        placement="bottom"
                                        getPopupContainer={() => document.body}
                                        overlayClassName="z-[2147483647]"
                                    >
                                        <Tag 
                                            icon={<RocketOutlined />} 
                                            className="cursor-pointer hover:opacity-80 transition-opacity border-none text-[10px] py-0.5 px-2" 
                                            style={{ 
                                                color: token.colorWarning, 
                                                backgroundColor: '#fffbe6',
                                                maxWidth: '220px',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <span style={{ 
                                                overflow: 'hidden', 
                                                textOverflow: 'ellipsis', 
                                                whiteSpace: 'nowrap' 
                                            }}>
                                                {llmModels.find(m => m.id === selectedLLMId)?.display_name || t('ai.selectModel')}
                                            </span>
                                        </Tag>
                                    </Dropdown>
                                </Flex>
                            </Flex>
                        }
                        extra={
                            <Space>
                                <Tooltip title={t('ai.newChat')}>
                                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); startNewChat(); }} />
                                </Tooltip>
                                <Button type="text" size="small" icon={<MinusOutlined />} onClick={(e) => { e.stopPropagation(); setVisible(false); }} />
                            </Space>
                        }
                        className="fixed right-6 bottom-[5vh] w-105 h-155 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-solid animate-in fade-in slide-in-from-bottom-4 duration-300"
                        style={{ borderColor: token.colorBorderSecondary, zIndex: 2147483647, pointerEvents: 'auto' }}
                        styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: token.colorBgContainer, overflow: 'hidden' } }}
                    >
                        {/* 历史对话抽屉 (内部模拟) */}
                        {historyVisible && (
                            <div className="absolute inset-0 z-50 animate-in slide-in-from-left duration-300 flex flex-col" style={{ backgroundColor: token.colorBgContainer }}>
                                <div className="px-4 pt-4 pb-2 border-b" style={{ borderColor: token.colorBorderSecondary }}>
                                    <Flex justify="space-between" align="center" className="mb-3">
                                        <Text strong style={{ color: token.colorText }}><HistoryOutlined /> {t('ai.historyRecords')}</Text>
                                        <Button type="primary" ghost size="small" icon={<PlusOutlined />} onClick={startNewChat}>{t('ai.historyNewChat')}</Button>
                                    </Flex>
                                    <Input 
                                        placeholder={t('ai.searchHistory')} 
                                        prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
                                        value={historySearch}
                                        onChange={e => {
                                            setHistorySearch(e.target.value);
                                            loadHistoryList(historyTab, e.target.value);
                                        }}
                                        allowClear
                                        size="small"
                                        className="mb-2"
                                    />
                                    <Tabs 
                                        size="small"
                                        activeKey={historyTab}
                                        onChange={(key) => {
                                            const tab = key as 'chat' | 'diagnose';
                                            setHistoryTab(tab);
                                            loadHistoryList(tab);
                                        }}
                                        items={[
                                            { key: 'chat', label: t('ai.chatTab') },
                                            { key: 'diagnose', label: t('ai.diagnoseTab') },
                                        ]}
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto ai-chat-messages">
                                    {historyLoading ? (
                                        <div className="p-5"><Skeleton active /></div>
                                    ) : historyList.length === 0 ? (
                                        <Empty className="mt-20" description={historySearch ? t('ai.noHistoryFound') : t('ai.noHistory')} />
                                    ) : (
                                        <div className="flex flex-col">
                                            {historyList.map((item: any) => (
                                                <div 
                                                    key={item.id}
                                                    className="cursor-pointer px-4 py-3 border-b transition-colors flex items-start gap-3 hover:opacity-80"
                                                    style={{ 
                                                        borderColor: token.colorBorderSecondary,
                                                        backgroundColor: historyId === item.id ? token.colorPrimaryBg : 'transparent'
                                                    }}
                                                    onClick={() => loadMessages(item.id)}
                                                >
                                                    {item.history_type === 'diagnose' ? <ThunderboltOutlined className="mt-1" style={{ color: token.colorWarning }} /> : <MessageOutlined className="mt-1" style={{ color: token.colorPrimary }} />}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium truncate" style={{ color: token.colorText }}>
                                                            {item.title || t('ai.untitledChat')}
                                                        </div>
                                                        <div className="text-[10px] mt-0.5" style={{ color: token.colorTextDescription }}>
                                                            {new Date(item.create_time).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t" style={{ borderColor: token.colorBorderSecondary }}>
                                    <Button block onClick={() => setHistoryVisible(false)}>{t('ai.backToCurrentChat')}</Button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 ai-chat-messages min-h-0" style={{ backgroundColor: token.colorBgContainer }} ref={scrollRef}>
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-60 px-10">
                                    <Avatar size={64} icon={<RobotOutlined />} style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }} className="mb-4" />
                                    <Text strong style={{ color: token.colorText }} className="block mb-1">{t('ai.welcomeTitle')}</Text>
                                    <Text type="secondary" className="text-xs">{t('ai.welcomeSubtitle')}</Text>
                                </div>
                            )}
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex gap-3 max-w-[90%] items-start ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                                    <Avatar 
                                        size="small" 
                                        className="flex-shrink-0" 
                                        style={{ backgroundColor: msg.role === 'assistant' ? token.colorPrimary : token.colorSuccess }} 
                                        icon={msg.role === 'assistant' ? <RobotOutlined /> : (!userAvatar ? <UserOutlined /> : undefined)} 
                                        src={msg.role === 'user' && userAvatar ? userAvatar : undefined}
                                    />
                                    <div className="flex flex-col gap-1">
                                        <div className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${msg.role === 'assistant' ? 'ai-assistant-bubble' : 'shadow-sm'}`} style={{ backgroundColor: msg.role === 'user' ? token.colorPrimary : undefined, color: msg.role === 'user' ? '#fff' : token.colorText, borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px' }}>
                                            {msg.content}
                                            {loading && index === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                                                <div className="ai-typing">
                                                    <div className="ai-typing-dot" />
                                                    <div className="ai-typing-dot" />
                                                    <div className="ai-typing-dot" />
                                                </div>
                                            )}
                                        </div>
                                        {msg.role === 'assistant' && msg.referenced_docs && msg.referenced_docs.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1 mb-1">
                                                <span className="text-[10px] opacity-40 mr-1 flex items-center"><BookOutlined className="mr-0.5" /> {t('ai.reference')}</span>
                                                {msg.referenced_docs.map((doc: any, i: number) => (
                                                    <Tooltip key={i} title={t('ai.referenceTooltip')}>
                                                        <Tag 
                                                            className="text-[9px] m-0 px-1 border-none bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"
                                                            onClick={() => window.open(`/v1/ai-rag/config?doc_id=${doc.id}`)}
                                                        >
                                                            {doc.title}
                                                        </Tag>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        )}
                                        {msg.role === 'assistant' && (msg.id || (loading && index === messages.length - 1)) && (
                                            <div className="flex justify-start opacity-0 animate-in fade-in duration-500 fill-mode-forwards" style={{ animationDelay: '300ms' }}>
                                                <Tooltip title={!msg.id ? t('ai.generatingCredential') : (msg.is_exported ? t('ai.alreadyInKnowledgeBase') : t('ai.saveToKnowledgeBase'))}>
                                                    <Button 
                                                        type="text" 
                                                        size="small" 
                                                        icon={msg.is_exported ? <BookOutlined style={{ color: token.colorSuccess }} /> : (msg.id ? <BookOutlined /> : <LoadingOutlined />)} 
                                                        className={`text-[10px] p-0 h-auto flex items-center gap-1 ${msg.is_exported ? 'text-green-500 opacity-100' : 'opacity-40 hover:opacity-100'}`}
                                                        onClick={() => msg.id && !msg.is_exported && handleSaveKnowledge(msg.id)}
                                                        disabled={!msg.id || msg.is_exported}
                                                    >
                                                        {msg.is_exported ? t('ai.savedToKnowledgeBase') : t('ai.saveToKnowledgeBase')}
                                                    </Button>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {suggestedPipelineId && (
                                <div className="mx-auto w-full px-5 animate-in zoom-in-95 duration-500">
                                    <Card 
                                        size="small" 
                                        className="shadow-sm rounded-xl overflow-hidden" 
                                        style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorBorderSecondary }}
                                    >
                                        <Flex justify="space-between" align="center">
                                            <Space direction="vertical" size={0}>
                                                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider" style={{ color: token.colorPrimary }}>{t('ai.selfHealing.title')}</Text>
                                                <Text strong className="text-xs" style={{ color: token.colorText }}>{t('ai.selfHealing.pipelineText', { id: suggestedPipelineId })}</Text>
                                            </Space>
                                            <Button type="primary" size="small" icon={<PlayCircleOutlined />} className="rounded-lg h-8 px-4" onClick={() => {
                                                modal.confirm({
                                                    title: t('ai.selfHealing.confirmTitle'),
                                                    content: t('ai.selfHealing.confirmContent'),
                                                    onOk: async () => {
                                                        try {
                                                            await executePipeline(suggestedPipelineId);
                                                            message.success(t('ai.selfHealing.success'));
                                                            setSuggestedPipelineId(null);
                                                        } catch (e) { message.error(t('ai.selfHealing.error')); }
                                                    }
                                                });
                                            }}>{t('ai.selfHealing.execute')}</Button>
                                        </Flex>
                                    </Card>
                                </div>
                            )}

                            {ansibleDraft && (
                                <div className="mx-auto w-full px-5 pb-3 animate-in zoom-in-95 duration-500">
                                    <Card 
                                        size="small" 
                                        className="shadow-sm rounded-xl overflow-hidden" 
                                        style={{ backgroundColor: '#e6f4ff', borderColor: '#b37feb' }}
                                    >
                                        <Flex justify="space-between" align="center">
                                            <Space direction="vertical" size={0}>
                                                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#531dab' }}>{t('ai.aiAssetOrchestration')}</Text>
                                                <Text strong className="text-xs" style={{ color: token.colorText }}>{t('ai.generatedAnsibleTask', { name: ansibleDraft.name || 'AI Task' })}</Text>
                                            </Space>
                                            <Button 
                                                type="primary" 
                                                size="small" 
                                                icon={<BookOutlined />} 
                                                style={{ backgroundColor: '#531dab' }}
                                                className="rounded-lg h-8 px-4" 
                                                loading={isRegisteringTask}
                                                onClick={handleRegisterAnsibleTask}
                                            >{t('ai.saveAndRegister')}</Button>
                                        </Flex>
                                        <div className="mt-2 text-[10px] overflow-auto max-h-32 bg-slate-900 text-slate-300 p-2 rounded-lg font-mono whitespace-pre-wrap">
                                            {ansibleDraft.content}
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {pipelineDraft && (
                                <div className="mx-auto w-full px-5 animate-in zoom-in-95 duration-500">
                                    <Card 
                                        size="small" 
                                        className="shadow-sm rounded-xl overflow-hidden" 
                                        style={{ backgroundColor: '#f9f0ff', borderColor: '#d3adf7' }}
                                    >
                                        <Flex justify="space-between" align="center">
                                            <Space direction="vertical" size={0}>
                                                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#722ed1' }}>{t('ai.aiDeepLink')}</Text>
                                                <Text strong className="text-xs" style={{ color: token.colorText }}>{t('ai.generatedPipelineDraft')}</Text>
                                            </Space>
                                            <Button 
                                                type="primary" 
                                                size="small" 
                                                icon={<RocketOutlined />} 
                                                style={{ backgroundColor: '#722ed1' }}
                                                className="rounded-lg h-8 px-4" 
                                                onClick={() => {
                                                    // 深度防御：彻底重构节点结构，确保 ReactFlow 必需字段绝对存在且有效
                                                    const safeNodes = (pipelineDraft.nodes || []).map((node: any, idx: number) => {
                                                        const defaultX = idx * 300;
                                                        const defaultY = 100;
                                                        
                                                        return {
                                                            ...node,
                                                            // 确保 id 是字符串
                                                            id: String(node.id || `node_${idx}`),
                                                            // 强制覆盖 position，确保 x 和 y 都有值
                                                            position: {
                                                                x: typeof node.position?.x === 'number' ? node.position.x : defaultX,
                                                                y: typeof node.position?.y === 'number' ? node.position.y : defaultY
                                                            },
                                                            // 确保 data 对象存在且包含 label
                                                            data: { 
                                                                ...node.data, 
                                                                label: node.data?.label || node.label || t('ai.nodeDefaultLabel', { index: idx + 1 }) 
                                                            }
                                                        };
                                                    });
                                                    
                                                    setNodes(safeNodes);
                                                    setEdges(pipelineDraft.edges || []);
                                                    setEditingId(null);
                                                    
                                                    // 设置来源告警 ID，用于自愈闭环
                                                    if (diagnosedAlertId) {
                                                        setSourceAlertId(diagnosedAlertId);
                                                    } else {
                                                        setSourceAlertId(null);
                                                    }

                                                    navigate('/v1/pipeline/designer');
                                                    setVisible(false);
                                                    message.success(t('ai.loadedDesigner'));
                                                }}
                                            >{t('ai.loadDesigner')}</Button>
                                        </Flex>
                                    </Card>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t flex items-end gap-3" style={{ backgroundColor: token.colorBgContainer, borderTopColor: token.colorBorderSecondary }}>
                            <Input.TextArea 
                                ref={inputRef}
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                onFocus={(e) => {
                                    e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // 强行抢夺焦点，防止被 Modal 夺回
                                    setTimeout(() => inputRef.current?.focus(), 10);
                                }}
                                placeholder={t('ai.inputPlaceholder')} 
                                autoSize={{ minRows: 1, maxRows: 4 }} 
                                style={{ backgroundColor: token.colorBgLayout, color: token.colorText }} 
                                className="border-none hover:bg-slate-200 focus:bg-white transition-all rounded-xl py-2 px-3" 
                            />
                            {loading ? (
                                <Tooltip title={t('ai.stopGenerating')}>
                                    <Button 
                                        type="default" 
                                        shape="circle" 
                                        icon={<StopOutlined />} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (abortControllerRef.current) {
                                                abortControllerRef.current.abort();
                                            }
                                            if (socketRef.current) {
                                                socketRef.current.close();
                                                socketRef.current = null;
                                            }
                                            setAiStatus('idle');
                                        }} 
                                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center shadow-md border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-500" 
                                    />
                                </Tooltip>
                            ) : (
                                <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={(e) => { e.stopPropagation(); handleSend(); }} disabled={!input.trim()} className="flex-shrink-0 w-10 h-10 flex items-center justify-center shadow-lg" style={{ boxShadow: `0 4px 12px ${token.colorPrimary}40` }} />
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </>
    , document.body);
};

export default AIChatbot;
