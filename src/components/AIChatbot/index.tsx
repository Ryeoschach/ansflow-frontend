import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Card, Space, Avatar, FloatButton, Typography, theme } from 'antd';
import { RobotOutlined, UserOutlined, SendOutlined, MinusOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import useAppStore from '@/store/useAppStore';
import { createChatHistory } from '@/api/ai';

const { Text } = Typography;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const AIChatbot: React.FC = () => {
    const { token } = theme.useToken();
    const { t } = useTranslation();
    const { message } = App.useApp();
    
    const [visible, setVisible] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyId, setHistoryId] = useState<number | null>(null);
    
    const appToken = useAppStore(state => state.token);
    const currentUser = useAppStore(state => state.currentUser);
    const aiDiagnosisConfig = useAppStore(state => state.aiDiagnosisConfig);
    const setAiDiagnosis = useAppStore(state => state.setAiDiagnosis);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 点击外部自动收起
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const isClickOnButton = (event.target as HTMLElement).closest('.ant-float-btn');
            if (containerRef.current && !containerRef.current.contains(event.target as Node) && !isClickOnButton) {
                setVisible(false);
            }
        };

        if (visible) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
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

    const initChat = async () => {
        if (historyId) return;
        try {
            const sid = `session_${Date.now()}`;
            const res = await createChatHistory({
                user_id: currentUser || 'guest',
                session_id: sid,
                title: 'AI Chat'
            });
            setHistoryId(res.id);
        } catch (err) {
            console.error('Failed to init AI chat', err);
        }
    };

    const handleDiagnose = async (type: 'pipeline' | 'task', id: number | string) => {
        const typeText = t(`ai.${type}`);
        setMessages([{ role: 'user', content: t('ai.diagnosing', { type: typeText, id }) }]);
        setLoading(true);
        
        try {
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            
            const response = await fetch('/api/v1/ai/chat-histories/diagnose/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${appToken}`
                },
                body: JSON.stringify({ target_type: type, target_id: id })
            });

            if (!response.body) throw new Error('No body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantReply = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                assistantReply += chunk;
                
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantReply;
                    return newMessages;
                });
            }
        } catch (err) {
            message.error(t('ai.diagnosisError'));
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        
        const userQuestion = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
        setLoading(true);

        try {
            if (!historyId) {
                const sid = `session_${Date.now()}`;
                const res = await createChatHistory({
                    user_id: currentUser || 'guest',
                    session_id: sid,
                    title: userQuestion.slice(0, 20)
                });
                setHistoryId(res.id);
                await streamResponse(res.id, userQuestion);
            } else {
                await streamResponse(historyId, userQuestion);
            }
        } catch (err) {
            message.error(t('ai.responseError'));
            setLoading(false);
        }
    };

    const streamResponse = async (hid: number, question: string) => {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        const response = await fetch(`/api/v1/ai/chat-histories/${hid}/chat/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appToken}`
            },
            body: JSON.stringify({ question })
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
                    .ai-float-button-breathe {
                        animation: ai-glow-breathe 2s infinite;
                    }
                `}
            </style>
            <FloatButton
                icon={<RobotOutlined />}
                type="primary"
                onClick={() => {
                    setVisible(!visible);
                    if (!visible) initChat();
                }}
                className="fixed right-6 bottom-[15vh] transition-transform hover:scale-110 shadow-lg ai-float-button-breathe"
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
                                <RobotOutlined style={{ color: token.colorPrimary }} />
                                <span className="font-semibold">{t('ai.title')}</span>
                            </Space>
                        }
                        extra={
                            <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => setVisible(false)} />
                        }
                        className="fixed right-6 bottom-[5vh] w-105 h-155 z-50 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-solid animate-in fade-in slide-in-from-bottom-4 duration-300"
                        style={{ borderColor: token.colorBorderSecondary }}
                        styles={{ 
                            body: { 
                                padding: 0, 
                                flex: 1,
                                display: 'flex', 
                                flexDirection: 'column', 
                                backgroundColor: token.colorBgContainer,
                                overflow: 'hidden',
                                height: 'calc(100% - 56px)' // 减去 Header 默认高度
                            } 
                        }}
                        >
                        <div 
                            className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 ai-chat-messages min-h-0" 
                            style={{ backgroundColor: token.colorBgLayout }}
                            ref={scrollRef}
                        >
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-60 px-10">
                                    <Avatar 
                                        size={64} 
                                        icon={<RobotOutlined />} 
                                        style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
                                        className="mb-4" 
                                    />
                                    <Text strong style={{ color: token.colorText }} className="block mb-1">{t('ai.welcomeTitle')}</Text>
                                    <Text type="secondary" className="text-xs">{t('ai.welcomeSubtitle')}</Text>
                                </div>
                            )}
                            {messages.map((msg, index) => (
                                <div 
                                    key={index} 
                                    className={`flex gap-3 max-w-[90%] items-start ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                                >
                                    <Avatar 
                                        size="small" 
                                        className="flex-shrink-0"
                                        style={{ backgroundColor: msg.role === 'assistant' ? token.colorPrimary : token.colorSuccess }}
                                        icon={msg.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />} 
                                    />
                                    <div 
                                        className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words shadow-sm`}
                                        style={{
                                            backgroundColor: msg.role === 'user' ? token.colorPrimary : token.colorBgElevated,
                                            color: msg.role === 'user' ? '#fff' : token.colorText,
                                            border: msg.role === 'assistant' ? `1px solid ${token.colorBorderSecondary}` : 'none',
                                            borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px'
                                        }}
                                    >
                                        {msg.content}
                                        {loading && index === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                                            <span 
                                                className="inline-block w-1.5 h-4 animate-pulse align-middle ml-1" 
                                                style={{ backgroundColor: token.colorPrimary }}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div 
                            className="p-4 border-t flex items-end gap-3" 
                            style={{ backgroundColor: token.colorBgContainer, borderTopColor: token.colorBorderSecondary }}
                        >
                            <Input.TextArea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onPressEnter={e => {
                                    if (!e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={t('ai.inputPlaceholder')}
                                autoSize={{ minRows: 1, maxRows: 4 }}
                                style={{ backgroundColor: token.colorBgLayout, color: token.colorText }}
                                className="border-none hover:bg-slate-200 focus:bg-white transition-all rounded-xl py-2 px-3"
                            />
                            <Button 
                                type="primary" 
                                shape="circle"
                                icon={<SendOutlined />} 
                                onClick={handleSend}
                                loading={loading}
                                disabled={!input.trim()}
                                className="flex-shrink-0 w-10 h-10 flex items-center justify-center shadow-lg"
                                style={{ boxShadow: `0 4px 12px ${token.colorPrimary}40` }}
                            />
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

export default AIChatbot;
