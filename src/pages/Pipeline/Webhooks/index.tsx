import React, { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, App, Tooltip, Popconfirm, Drawer, Switch, Collapse, CodeRunner } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, GlobalOutlined, CopyOutlined, GithubOutlined, LockOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPipelineWebhooks, createPipelineWebhook, updatePipelineWebhook, deletePipelineWebhook, type PipelineWebhook } from '../../../api/pipeline';
import { getPipelines } from '../../../api/pipeline';
import useAppStore from '../../../store/useAppStore';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

const PipelineWebhooks: React.FC = () => {
    const { t } = useTranslation();
    const { message: antdMessage } = App.useApp();
    const { token: authToken, hasPermission } = useAppStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<PipelineWebhook | null>(null);
    const [detailWebhook, setDetailWebhook] = useState<PipelineWebhook | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);
    const [form] = Form.useForm();

    const { data: webhookData, isLoading } = useQuery({
        queryKey: ['pipeline-webhooks'],
        queryFn: () => getPipelineWebhooks({ page: 1, page_size: 100 }),
        enabled: !!authToken,
    });

    const { data: pipelineData } = useQuery({
        queryKey: ['pipelines-all'],
        queryFn: () => getPipelines({ page: 1, page_size: 100 }),
        enabled: !!authToken && isModalOpen,
    });

    const saveMutation = useMutation({
        mutationFn: (values: any) => editingWebhook
            ? updatePipelineWebhook(editingWebhook.id, values)
            : createPipelineWebhook(values),
        onSuccess: () => {
            antdMessage.success(editingWebhook ? t('webhook.updateSuccess') : t('webhook.createSuccess'));
            setIsModalOpen(false);
            setEditingWebhook(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['pipeline-webhooks'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePipelineWebhook,
        onSuccess: () => {
            antdMessage.success(t('webhook.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['pipeline-webhooks'] });
        },
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
            updatePipelineWebhook(id, { is_active }),
        onSuccess: () => {
            antdMessage.success(t('webhook.toggleSuccess'));
            queryClient.invalidateQueries({ queryKey: ['pipeline-webhooks'] });
        },
    });

    const openDetail = (record: PipelineWebhook) => {
        setDetailWebhook(record);
        setDetailVisible(true);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        antdMessage.success(t('webhook.copied'));
    };

    const eventTypeMap: Record<string, { text: string; color: string }> = {
        push: { text: '代码推送', color: 'green' },
        tag: { text: '标签创建', color: 'purple' },
        pull_request: { text: 'Pull Request', color: 'blue' },
        manual: { text: '手动触发', color: 'default' },
    };

    const columns = [
        {
            title: t('webhook.name'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string, record: PipelineWebhook) => (
                <Space>
                    <GlobalOutlined style={{ color: '#722ed1' }} />
                    <Text strong>{text}</Text>
                </Space>
            ),
        },
        {
            title: t('webhook.pipeline'),
            dataIndex: 'pipeline_name',
            key: 'pipeline_name',
            width: 150,
            ellipsis: true,
            render: (text: string) => text || '-',
        },
        {
            title: t('webhook.eventType'),
            dataIndex: 'event_type',
            key: 'event_type',
            width: 130,
            render: (type: string) => {
                const info = eventTypeMap[type] || { text: type, color: 'default' };
                return <Tag color={info.color}>{info.text}</Tag>;
            },
        },
        {
            title: t('webhook.repository'),
            dataIndex: 'repository_url',
            key: 'repository_url',
            width: 200,
            ellipsis: true,
            render: (text: string) => text ? <Text code className="text-xs">{text}</Text> : '-',
        },
        {
            title: t('webhook.branchFilter'),
            dataIndex: 'branch_filter',
            key: 'branch_filter',
            width: 120,
            render: (text: string) => text ? <Tag>{text}</Tag> : <Text type="secondary">-</Text>,
        },
        {
            title: t('webhook.triggerCount'),
            dataIndex: 'trigger_count',
            key: 'trigger_count',
            width: 100,
            render: (count: number) => <Tag>{count}</Tag>,
        },
        {
            title: t('webhook.lastTrigger'),
            dataIndex: 'last_trigger_time',
            key: 'last_trigger_time',
            width: 170,
            render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
            title: t('webhook.status'),
            dataIndex: 'is_active',
            key: 'is_active',
            width: 100,
            render: (isActive: boolean, record: PipelineWebhook) => (
                <Switch
                    size="small"
                    checked={isActive}
                    onChange={(checked) => toggleMutation.mutate({ id: record.id, is_active: checked })}
                    disabled={!hasPermission('pipeline:webhook:edit')}
                />
            ),
        },
        {
            title: t('webhook.action'),
            key: 'action',
            render: (_: any, record: PipelineWebhook) => (
                <Space>
                    <Tooltip title={t('webhook.viewDetail')}>
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
                    </Tooltip>
                    {hasPermission('pipeline:webhook:edit') && (
                        <Tooltip title={t('common.edit')}>
                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
                                setEditingWebhook(record);
                                form.setFieldsValue({
                                    ...record,
                                    secret_key: record.secret_key ? '********' : '',
                                });
                                setIsModalOpen(true);
                            }} />
                        </Tooltip>
                    )}
                    {hasPermission('pipeline:webhook:delete') && (
                        <Popconfirm title={t('webhook.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title={t('common.delete')}>
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const renderGithubGuide = (webhook: PipelineWebhook) => {
        if (!webhook) return null;

        const webhookUrl = webhook.webhook_url;
        const secretKey = webhook.secret_key || '';
        const timestamp = Math.floor(Date.now() / 1000).toString();

        // Signature generation example
        const signatureExample = secretKey ? `echo -n "${timestamp}.{\\"ref\\":\\"refs/heads/main\\"}" | openssl dgst -sha256 -hmac "${secretKey}" | sed 's/^.* //'` : '(未配置密钥，跳过签名)';

        return (
            <Collapse defaultActiveKey={['url', 'github']} className="mt-4">
                <Panel header={<Space><GithubOutlined /> GitHub Webhook 配置指南</Space>} key="github">
                    <div className="flex flex-col gap-4">
                        <div>
                            <Text strong>{t('webhook.step1')}</Text>
                            <Paragraph className="mt-2 mb-1 text-sm">
                                {t('webhook.step1Desc')}
                            </Paragraph>
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex items-center justify-between">
                                <Text code className="text-xs break-all">{webhookUrl}</Text>
                                <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(webhookUrl)} />
                            </div>
                        </div>

                        <div>
                            <Text strong>{t('webhook.step2')}</Text>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="mb-2">{t('webhook.step2Desc')}</div>
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-1 pr-4">{t('webhook.headerName')}</th>
                                            <th className="text-left py-1">{t('webhook.headerValue')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-600 dark:text-gray-400">
                                        <tr className="border-b"><td className="py-1 pr-4">Content-Type</td><td className="py-1">application/json</td></tr>
                                        <tr><td className="py-1 pr-4">X-AnsFlow-Timestamp</td><td className="py-1 font-mono">{timestamp}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {secretKey && (
                            <div>
                                <Text strong>{t('webhook.step3')}</Text>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="mb-2">{t('webhook.step3Desc')}</div>
                                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                                        <div className="text-xs font-mono break-all">
                                            <div className="text-gray-500 mb-1"># {t('webhook.signatureCommand')}</div>
                                            <div>{signatureExample}</div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500">
                                        {t('webhook.signatureTip')}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <Text strong className="text-blue-600 dark:text-blue-400">
                                {t('webhook.note')}
                            </Text>
                            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400/80">
                                {secretKey ? t('webhook.noteWithSecret') : t('webhook.noteWithoutSecret')}
                            </div>
                        </div>
                    </div>
                </Panel>
            </Collapse>
        );
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
                        <GlobalOutlined className="mr-2" />{t('webhook.title')}
                    </Typography.Title>
                    <Text type="secondary">{t('webhook.subtitle')}</Text>
                </div>
                {hasPermission('pipeline:webhook:add') && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                        setEditingWebhook(null);
                        form.resetFields();
                        setIsModalOpen(true);
                    }}>
                        {t('webhook.create')}
                    </Button>
                )}
            </div>

            <Card variant="outlined" className="shadow-sm rounded-xl">
                <Table
                    dataSource={webhookData?.data}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        total: webhookData?.total,
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: total => t('common.total', { total }),
                    }}
                />
            </Card>

            <Modal
                title={editingWebhook ? t('webhook.editWebhook') : t('webhook.createWebhook')}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => { setIsModalOpen(false); setEditingWebhook(null); form.resetFields(); }}
                confirmLoading={saveMutation.isPending}
                width={600}
            >
                <Form form={form} layout="vertical" className="mt-4" onFinish={saveMutation.mutate}>
                    <Form.Item label={t('webhook.name')} name="name" rules={[{ required: true }]}>
                        <Input placeholder={t('webhook.namePlaceholder')} />
                    </Form.Item>
                    <div className="flex gap-4">
                        <Form.Item label={t('webhook.pipeline')} name="pipeline" className="flex-1" rules={[{ required: true }]}>
                            <Select
                                placeholder={t('webhook.selectPipeline')}
                                options={pipelineData?.data?.map((p: any) => ({ label: p.name, value: p.id }))}
                            />
                        </Form.Item>
                        <Form.Item label={t('webhook.eventType')} name="event_type" className="flex-1" initialValue="push">
                            <Select options={[
                                { value: 'push', label: t('webhook.eventPush') },
                                { value: 'tag', label: t('webhook.eventTag') },
                                { value: 'pull_request', label: t('webhook.eventPR') },
                                { value: 'manual', label: t('webhook.eventManual') },
                            ]} />
                        </Form.Item>
                    </div>
                    <Form.Item label={t('webhook.repository')} name="repository_url">
                        <Input placeholder="https://github.com/org/repo" />
                    </Form.Item>
                    <Form.Item label={t('webhook.branchFilter')} name="branch_filter" extra={t('webhook.branchFilterTip')}>
                        <Input placeholder="main, release/*" />
                    </Form.Item>
                    <Form.Item label={t('webhook.secretKey')} name="secret_key" extra={<Space><LockOutlined /> {t('webhook.secretKeyExtra')}</Space>}>
                        <Input.Password placeholder={t('webhook.secretKeyPlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('webhook.description')} name="description">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Modal>

            <Drawer
                title={t('webhook.webhookDetail', { name: detailWebhook?.name })}
                placement="right"
                width={650}
                open={detailVisible}
                onClose={() => { setDetailVisible(false); setDetailWebhook(null); }}
            >
                {detailWebhook && (
                    <div className="flex flex-col gap-4">
                        <Card size="small" title={t('webhook.basicInfo')}>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><Text type="secondary">{t('webhook.pipeline')}:</Text> {detailWebhook.pipeline_name || '-'}</div>
                                <div><Text type="secondary">{t('webhook.eventType')}:</Text> {eventTypeMap[detailWebhook.event_type]?.text || detailWebhook.event_type}</div>
                                <div><Text type="secondary">{t('webhook.repository')}:</Text> {detailWebhook.repository_url ? <Text code>{detailWebhook.repository_url}</Text> : '-'}</div>
                                <div><Text type="secondary">{t('webhook.branchFilter')}:</Text> {detailWebhook.branch_filter || '-'}</div>
                                <div><Text type="secondary">{t('webhook.triggerCount')}:</Text> {detailWebhook.trigger_count}</div>
                                <div><Text type="secondary">{t('webhook.lastTrigger')}:</Text> {detailWebhook.last_trigger_time ? dayjs(detailWebhook.last_trigger_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</div>
                                <div><Text type="secondary">{t('webhook.createTime')}:</Text> {dayjs(detailWebhook.create_time).format('YYYY-MM-DD HH:mm:ss')}</div>
                                <div><Text type="secondary">{t('webhook.secretKey')}:</Text> {detailWebhook.secret_key ? <Tag color="green">{t('webhook.configured')}</Tag> : <Tag color="orange">{t('webhook.notConfigured')}</Tag>}</div>
                            </div>
                        </Card>

                        <Card size="small" title={<Space><LockOutlined /> {t('webhook.triggerUrl')}</Space>}>
                            <Paragraph copyable className="mb-2">
                                <Text code className="text-sm break-all">{detailWebhook.webhook_url}</Text>
                            </Paragraph>
                            <Text type="secondary" className="text-xs">{t('webhook.triggerUrlTip')}</Text>
                        </Card>

                        {renderGithubGuide(detailWebhook)}

                        {detailWebhook.description && (
                            <Card size="small" title={t('webhook.description')}>
                                <Text>{detailWebhook.description}</Text>
                            </Card>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default PipelineWebhooks;
