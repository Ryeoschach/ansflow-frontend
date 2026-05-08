import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Card, Space, Avatar, FloatButton, Typography, theme } from 'antd';
import { RobotOutlined, UserOutlined, SendOutlined, MinusOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import useAppStore from '@/store/useAppStore';
import { createChatHistory } from '@/api/ai';
import './index.css';

const { Text } = Typography;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const AIChatbot: React.FC = () => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [historyId, setHistoryId] = useState<number | null>(null);

    const { token } = theme.useToken();
    const authToken = useAppStore(state => state.token);
    const currentUser = useAppStore(state => state.currentUser);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const initChat = async () => {
        if (historyId) return;
        try {
            const sid = `session_${Date.now()}`;
            const res = await createChatHistory({
                user_id: currentUser || 'guest',
                session_id: sid,
                title: 'New AI Chat'
            });
            setSessionId(sid);
            setHistoryId(res.id);
        } catch (err) {
            console.error('Failed to init AI chat', err);
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
                setSessionId(sid);
                setHistoryId(res.id);
                await streamResponse(res.id, userQuestion);
            } else {
                await streamResponse(historyId, userQuestion);
            }
        } catch (err) {
            message.error(t('aiChatbot.sendError'));
            setLoading(false);
        }
    };

    const streamResponse = async (hid: number, question: string) => {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        
        const response = await fetch(`/api/v1/ai/chat-histories/${hid}/chat/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
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
            const chunk = decoder.decode(value);
            assistantReply += chunk;
            
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
            <FloatButton
                icon={<RobotOutlined />}
                type="primary"
                onClick={() => {
                    setVisible(!visible);
                    if (!visible) initChat();
                }}
                style={{ right: 24, bottom: 24 }}
                badge={{ dot: true, color: token.colorSuccess }}
            />

            {visible && (
                <Card
                    style={{ borderColor: token.colorBorder }}
                    title={
                        <Space>
                            <RobotOutlined />
                            <span>{t('aiChatbot.title')}</span>
                        </Space>
                    }
                    extra={
                        <Space>
                            <Button type="text" icon={<MinusOutlined />} onClick={() => setVisible(false)} />
                        </Space>
                    }
                    className="ai-chatbot-card"
                    styles={{
                        body: { padding: 0 },
                        header: { borderBottom: `1px solid ${token.colorBorderSecondary}` }
                    }}
                >
                    <div className="ai-chat-messages" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="ai-welcome">
                                <Avatar size={64} icon={<RobotOutlined />} src="/favicon.svg" />
                                <div style={{ marginTop: 16 }}>
                                    <Text strong>{t('aiChatbot.welcomeTitle')}</Text>
                                    <br />
                                    <Text type="secondary">{t('aiChatbot.welcomeDesc')}</Text>
                                </div>
                            </div>
                        )}
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-bubble-container ${msg.role}`}>
                                <Avatar
                                    size="small"
                                    icon={msg.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                                    style={{ backgroundColor: msg.role === 'assistant' ? token.colorPrimary : token.colorSuccess }}
                                />
                                <div className="chat-bubble">
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && messages[messages.length-1]?.role === 'user' && (
                            <div className="chat-bubble-container assistant">
                                <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: token.colorPrimary }} />
                                <div className="chat-bubble loading">...</div>
                            </div>
                        )}
                    </div>
                    <div className="ai-chat-input">
                        <Input.TextArea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onPressEnter={e => {
                                if (!e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={t('aiChatbot.placeholder')}
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            bordered={false}
                        />
                        <Button 
                            type="primary" 
                            icon={<SendOutlined />} 
                            onClick={handleSend}
                            loading={loading}
                            disabled={!input.trim()}
                        />
                    </div>
                </Card>
            )}
        </>
    );
};

export default AIChatbot;
