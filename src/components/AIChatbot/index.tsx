import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Card, Space, Avatar, FloatButton, Typography, theme, Dropdown, MenuProps, Tag, Drawer, List, Tooltip, Empty, Skeleton } from 'antd';
import { 
    RobotOutlined, UserOutlined, SendOutlined, MinusOutlined, PlayCircleOutlined, 
    CoffeeOutlined, ThunderboltOutlined, UserSwitchOutlined, HistoryOutlined, 
    PlusOutlined, MessageOutlined, DeleteOutlined 
} from '@ant-design/icons';
import { App, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import useAppStore from '@/store/useAppStore';
import { createChatHistory, getChatHistories, getChatMessages } from '@/api/ai';
import { executePipeline } from '@/api/pipeline';

const { Text } = Typography;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

type PersonalityKey = 'professional' | 'concise' | 'humorous';

const AIChatbot: React.FC = () => {
    const { token } = theme.useToken();
    const { t } = useTranslation();
    const { message, modal } = App.useApp();
    
    // --- UI 状态 ---
    const [visible, setVisible] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // --- 数据状态 ---
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [historyId, setHistoryId] = useState<number | null>(null);
    const [suggestedPipelineId, setSuggestedPipelineId] = useState<number | null>(null);
    const [personality, setPersonality] = useState<PersonalityKey>(
        (localStorage.getItem('ansflow-ai-personality') as PersonalityKey) || 'professional'
    );
    
    const appToken = useAppStore(state => state.token);
    const currentUser = useAppStore(state => state.currentUser);
    const aiDiagnosisConfig = useAppStore(state => state.aiDiagnosisConfig);
    const setAiDiagnosis = useAppStore(state => state.setAiDiagnosis);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 监听性格变化并持久化
    useEffect(() => {
        localStorage.setItem('ansflow-ai-personality', personality);
    }, [personality]);

    const personalityItems: MenuProps['items'] = [
        { key: 'professional', label: '技术专家', icon: <RobotOutlined /> },
        { key: 'concise', label: '简洁助手', icon: <ThunderboltOutlined /> },
        { key: 'humorous', label: '幽默特工', icon: <CoffeeOutlined /> },
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
            handleDiagnose(aiDiagnosisConfig.target_type, aiDiagnosisConfig.target_id);
            setAiDiagnosis(null);
        }
    }, [aiDiagnosisConfig]);

    // 加载历史列表
    const loadHistoryList = async () => {
        setHistoryLoading(true);
        try {
            const res = await getChatHistories({ size: 50 });
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
        
        // 查找并恢复当时的 AI 性格
        const historyItem = historyList.find(h => h.id === hid);
        if (historyItem && historyItem.personality) {
            setPersonality(historyItem.personality as PersonalityKey);
        }

        try {
            const res = await getChatMessages(hid);
            setMessages(res.map((m: any) => ({ role: m.role, content: m.content })));
            setHistoryVisible(false);
        } catch (err) {
            message.error('加载历史对话失败');
        } finally {
            setLoading(false);
        }
    };

    const startNewChat = () => {
        setHistoryId(null);
        setMessages([]);
        setHistoryVisible(false);
    };

    const handleDiagnose = async (type: 'pipeline' | 'task', id: number | string) => {
        const typeText = t(`ai.${type}`);
        setMessages([{ role: 'user', content: t('ai.diagnosing', { type: typeText, id }) }]);
        setLoading(true);
        setSuggestedPipelineId(null);
        
        try {
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            const response = await fetch('/api/v1/ai/chat-histories/diagnose/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appToken}` },
                body: JSON.stringify({ target_type: type, target_id: id, personality })
            });

            if (!response.body) throw new Error('No body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantReply = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                if (chunk.includes('__SUGGESTION__:')) {
                    const parts = chunk.split('\n');
                    for (const part of parts) {
                        if (part.startsWith('__SUGGESTION__:')) {
                            try {
                                const suggestion = JSON.parse(part.replace('__SUGGESTION__:', ''));
                                setSuggestedPipelineId(suggestion.pipeline_id);
                            } catch (e) {}
                        } else { assistantReply += part; }
                    }
                } else { assistantReply += chunk; }
                
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantReply;
                    return newMessages;
                });
            }
        } catch (err) { message.error(t('ai.diagnosisError')); } finally { setLoading(false); }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userQuestion = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
        setLoading(true);

        try {
            let currentHid = historyId;
            if (!currentHid) {
                const sid = `session_${Date.now()}`;
                const res = await createChatHistory({
                    user_id: currentUser || 'guest',
                    session_id: sid,
                    title: userQuestion.slice(0, 20),
                    personality: personality
                });
                currentHid = res.id;
                setHistoryId(res.id);
            }
            await streamResponse(currentHid, userQuestion);
        } catch (err) {
            message.error(t('ai.responseError'));
            setLoading(false);
        }
    };

    const streamResponse = async (hid: number, question: string) => {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        const response = await fetch(`/api/v1/ai/chat-histories/${hid}/chat/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appToken}` },
            body: JSON.stringify({ question, personality })
        });

        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantReply = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            assistantReply += decoder.decode(value);
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = assistantReply;
                return newMessages;
            });
        }
        setLoading(false);
    };

    return (
        <>
            <style>
                {`
                    @keyframes ai-glow-breathe {
                        0% { box-shadow: 0 0 0 0 ${token.colorPrimary}60; }
                        70% { box-shadow: 0 0 0 12px ${token.colorPrimary}00; }
                        100% { box-shadow: 0 0 0 0 ${token.colorPrimary}00; }
                    }
                    .ai-float-button-breathe { animation: ai-glow-breathe 2s infinite; }
                    .ai-chat-messages::-webkit-scrollbar { width: 4px; }
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
                type="primary"
                onClick={() => {
                    setVisible(!visible);
                    if (!visible && messages.length === 0) startNewChat();
                }}
                className="fixed right-6 bottom-[75vh] transition-transform hover:scale-110 shadow-lg ai-float-button-breathe"
                badge={{ dot: true, color: token.colorSuccess }}
            />

            {visible && (
                <div ref={containerRef}>
                    <style>
                        {`
                            .ai-chat-messages::-webkit-scrollbar {
                                width: 4px;
                            }
                            .ai-chat-messages::-webkit-scrollbar-thumb {
                                background: ${token.colorTextQuaternary};
                                border-radius: 10px;
                            }
                            .ai-chat-messages::-webkit-scrollbar-track {
                                background: transparent;
                            }
                        `}
                    </style>
                    <Card
                        title={
                            <Space style={{ color: token.colorTextHeading }}>
                                <Button 
                                    type="text" 
                                    size="small" 
                                    icon={<HistoryOutlined />} 
                                    onClick={() => {
                                        setHistoryVisible(!historyVisible);
                                        if (!historyVisible) loadHistoryList();
                                    }}
                                />
                                <span className="font-semibold">{t('ai.title')}</span>
                                <Dropdown 
                                    menu={{ 
                                        items: personalityItems, 
                                        selectable: true,
                                        selectedKeys: [personality],
                                        onClick: ({ key }) => setPersonality(key as PersonalityKey) 
                                    }} 
                                    trigger={['click']}
                                >
                                    <Tag 
                                        icon={<UserSwitchOutlined />} 
                                        className="cursor-pointer ml-1 hover:opacity-80 transition-opacity border-none text-[10px]" 
                                        style={{ color: token.colorPrimary, backgroundColor: token.colorPrimaryBg }}
                                    >
                                        {personalityItems.find(i => i?.key === personality)?.label as string}
                                    </Tag>
                                </Dropdown>
                            </Space>
                        }
                        extra={
                            <Space>
                                <Tooltip title="开启新对话">
                                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={startNewChat} />
                                </Tooltip>
                                <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => setVisible(false)} />
                            </Space>
                        }
                        className="fixed right-6 bottom-[5vh] w-105 h-155 z-50 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-solid animate-in fade-in slide-in-from-bottom-4 duration-300"
                        style={{ borderColor: token.colorBorderSecondary }}
                        styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: token.colorBgContainer, overflow: 'hidden', height: 'calc(100% - 56px)' } }}
                    >
                        {/* 历史对话抽屉 (内部模拟) */}
                        {historyVisible && (
                            <div className="absolute inset-0 z-50 animate-in slide-in-from-left duration-300 flex flex-col" style={{ backgroundColor: token.colorBgContainer }}>
                                <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: token.colorBorderSecondary }}>
                                    <Text strong style={{ color: token.colorText }}><HistoryOutlined /> 历史对话</Text>
                                    <Button type="text" icon={<PlusOutlined />} onClick={startNewChat} style={{ color: token.colorPrimary }}>新对话</Button>
                                </div>
                                <div className="flex-1 overflow-y-auto ai-chat-messages">
                                    {historyLoading ? (
                                        <div className="p-5"><Skeleton active /></div>
                                    ) : historyList.length === 0 ? (
                                        <Empty className="mt-20" description="暂无历史对话" />
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
                                                    <MessageOutlined className="mt-1" style={{ color: token.colorPrimary }} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium truncate" style={{ color: token.colorText }}>
                                                            {item.title || '无标题对话'}
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
                                    <Button block onClick={() => setHistoryVisible(false)}>返回对话</Button>
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
                                    <Avatar size="small" className="flex-shrink-0" style={{ backgroundColor: msg.role === 'assistant' ? token.colorPrimary : token.colorSuccess }} icon={msg.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />} />
                                    <div className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${msg.role === 'assistant' ? 'ai-assistant-bubble' : 'shadow-sm'}`} style={{ backgroundColor: msg.role === 'user' ? token.colorPrimary : undefined, color: msg.role === 'user' ? '#fff' : token.colorText, borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px' }}>
                                        {msg.content}
                                        {loading && index === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                                            <span className="inline-block w-1.5 h-4 animate-pulse align-middle ml-1" style={{ backgroundColor: token.colorPrimary }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                            {suggestedPipelineId && !loading && (
                                <div className="mx-auto w-full px-5 animate-in zoom-in-95 duration-500">
                                    <Card 
                                        size="small" 
                                        className="shadow-sm rounded-xl overflow-hidden" 
                                        style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorBorderSecondary }}
                                    >
                                        <Flex justify="space-between" align="center">
                                            <Space direction="vertical" size={0}>
                                                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider" style={{ color: token.colorPrimary }}>AI 自愈建议</Text>
                                                <Text strong className="text-xs" style={{ color: token.colorText }}>执行修复流水线 (ID: {suggestedPipelineId})</Text>
                                            </Space>
                                            <Button type="primary" size="small" icon={<PlayCircleOutlined />} className="rounded-lg h-8 px-4" onClick={() => {
                                                modal.confirm({
                                                    title: '确认执行 AI 建议的修复方案？',
                                                    content: '该动作将由 AI 发起并记录在审计日志中。',
                                                    onOk: async () => {
                                                        try {
                                                            await executePipeline(suggestedPipelineId);
                                                            message.success('自愈任务已下发');
                                                            setSuggestedPipelineId(null);
                                                        } catch (e) { message.error('下发失败'); }
                                                    }
                                                });
                                            }}>立即执行</Button>
                                        </Flex>
                                    </Card>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t flex items-end gap-3" style={{ backgroundColor: token.colorBgContainer, borderTopColor: token.colorBorderSecondary }}>
                            <Input.TextArea value={input} onChange={e => setInput(e.target.value)} onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={t('ai.inputPlaceholder')} autoSize={{ minRows: 1, maxRows: 4 }} style={{ backgroundColor: token.colorBgLayout, color: token.colorText }} className="border-none hover:bg-slate-200 focus:bg-white transition-all rounded-xl py-2 px-3" />
                            <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={handleSend} loading={loading} disabled={!input.trim()} className="flex-shrink-0 w-10 h-10 flex items-center justify-center shadow-lg" style={{ boxShadow: `0 4px 12px ${token.colorPrimary}40` }} />
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default AIChatbot;
