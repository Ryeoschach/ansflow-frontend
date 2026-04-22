import React, { Fragment, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, App, Tooltip, Popconfirm, Drawer } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, CloudOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getArtifacts, deleteArtifact, createArtifact, updateArtifact, getArtifactVersionsById, type Artifact, type ArtifactVersion } from '../../../api/artifact';
import { getRegistries } from '../../../api/registry';
import { getPipelines } from '../../../api/pipeline';
import useAppStore from '../../../store/useAppStore';
import dayjs from 'dayjs';

const { Text } = Typography;

const Artifacts: React.FC = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { token: authToken, hasPermission } = useAppStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
    const [detailArtifact, setDetailArtifact] = useState<Artifact | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);
    const [form] = Form.useForm();
    const [versions, setVersions] = useState<ArtifactVersion[]>([]);

    const { data: artifactData, isLoading, refetch } = useQuery({
        queryKey: ['artifacts'],
        queryFn: () => getArtifacts({ page: 1, page_size: 100 }),
        enabled: !!authToken,
    });

    const { data: registryData } = useQuery({
        queryKey: ['registries-all'],
        queryFn: () => getRegistries({ page: 1, page_size: 100 }),
        enabled: !!authToken && isModalOpen,
    });

    const { data: pipelineData } = useQuery({
        queryKey: ['pipelines-all'],
        queryFn: () => getPipelines({ page: 1, page_size: 100 }),
        enabled: !!authToken && isModalOpen,
    });

    const saveMutation = useMutation({
        mutationFn: (values: any) => editingArtifact
            ? updateArtifact(editingArtifact.id, values)
            : createArtifact(values),
        onSuccess: () => {
            message.success(editingArtifact ? t('artifact.updateSuccess') : t('artifact.createSuccess'));
            setIsModalOpen(false);
            setEditingArtifact(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteArtifact,
        onSuccess: () => {
            message.success(t('artifact.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        },
    });

    const openDetail = async (record: Artifact) => {
        setDetailArtifact(record);
        setDetailVisible(true);
        try {
            const res = await getArtifactVersionsById(record.id);
            setVersions(res.data || []);
        } catch {
            setVersions([]);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    const typeMap: Record<string, { text: string; color: string }> = {
        docker_image: { text: 'Docker 镜像', color: 'blue' },
        jar: { text: 'JAR 包', color: 'orange' },
        binary: { text: '二进制', color: 'cyan' },
        helm_chart: { text: 'Helm Chart', color: 'purple' },
        other: { text: '其他', color: 'default' },
    };

    const columns = [
        {
            title: t('artifact.name'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string, record: Artifact) => (
                <Space>
                    <InboxOutlined style={{ color: '#1890ff' }} />
                    <Text strong>{text}</Text>
                </Space>
            ),
        },
        {
            title: t('artifact.type'),
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type: string) => {
                const info = typeMap[type] || typeMap.other;
                return <Tag color={info.color}>{info.text}</Tag>;
            },
        },
        {
            title: t('artifact.registry'),
            dataIndex: 'registry_name',
            key: 'registry_name',
            width: 150,
            ellipsis: true,
            render: (text: string) => text ? <Tag color="blue"><CloudOutlined /> {text}</Tag> : '-',
        },
        {
            title: t('artifact.repository'),
            dataIndex: 'repository',
            key: 'repository',
            width: 200,
            ellipsis: true,
            render: (text: string) => text ? <Text code className="text-xs">{text}</Text> : '-',
        },
        {
            title: t('artifact.latestTag'),
            dataIndex: 'latest_tag',
            key: 'latest_tag',
            width: 120,
            render: (tag: string) => tag ? <Tag color="green">{tag}</Tag> : '-',
        },
        {
            title: t('artifact.size'),
            dataIndex: 'latest_size',
            key: 'latest_size',
            width: 100,
            render: (size: number) => formatSize(size),
        },
        {
            title: t('artifact.pipeline'),
            dataIndex: 'pipeline_name',
            key: 'pipeline_name',
            width: 150,
            ellipsis: true,
            render: (text: string) => text || '-',
        },
        {
            title: t('artifact.versions'),
            dataIndex: 'version_count',
            key: 'version_count',
            width: 100,
            render: (count: number) => <Tag>{count}</Tag>,
        },
        {
            title: t('artifact.action'),
            key: 'action',
            render: (_: any, record: Artifact) => (
                <Space>
                    <Tooltip title={t('artifact.viewDetail')}>
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
                    </Tooltip>
                    {hasPermission('pipeline:artifact:edit') && (
                        <Tooltip title={t('common.edit')}>
                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
                                setEditingArtifact(record);
                                form.setFieldsValue(record);
                                setIsModalOpen(true);
                            }} />
                        </Tooltip>
                    )}
                    {hasPermission('pipeline:artifact:delete') && (
                        <Popconfirm title={t('artifact.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title={t('common.delete')}>
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const versionColumns = [
        { title: t('artifact.versionTag'), dataIndex: 'tag', key: 'tag', width: 120, render: (v: string) => <Tag color="green">{v}</Tag> },
        { title: t('artifact.digest'), dataIndex: 'digest', key: 'digest', ellipsis: true, render: (v: string) => v ? <Text code className="text-xs">{v?.substring(0, 16)}...</Text> : '-' },
        { title: t('artifact.size'), dataIndex: 'size', key: 'size', width: 100, render: (v: number) => formatSize(v) },
        { title: t('artifact.buildUser'), dataIndex: 'build_user', key: 'build_user', width: 100, render: (v: string) => v || '-' },
        { title: t('artifact.commitSha'), dataIndex: 'commit_sha', key: 'commit_sha', width: 120, ellipsis: true, render: (v: string) => v ? <Text code className="text-xs">{v?.substring(0, 8)}</Text> : '-' },
        { title: t('artifact.createTime'), dataIndex: 'create_time', key: 'create_time', width: 170, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    ];

    return (
        <>
        <Card
            title={
                <Space>
                    <InboxOutlined />
                    {t('artifact.title')}
                </Space>
            }
            extra={
                <Button type="text" icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
                    {t('common.refresh')}
                </Button>
            }
        >
            <Table
                dataSource={artifactData?.data}
                columns={columns}
                rowKey="id"
                loading={isLoading}
                scroll={{ x: 'max-content' }}
                pagination={{
                    total: artifactData?.total,
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: total => t('common.total', { total }),
                }}
            />
        </Card>

            <Modal
                title={editingArtifact ? t('artifact.editArtifact') : t('artifact.createArtifact')}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => { setIsModalOpen(false); setEditingArtifact(null); form.resetFields(); }}
                confirmLoading={saveMutation.isPending}
                width={600}
            >
                <Form form={form} layout="vertical" className="mt-4" onFinish={saveMutation.mutate}>
                    <Form.Item label={t('artifact.name')} name="name" rules={[{ required: true }]}>
                        <Input placeholder={t('artifact.namePlaceholder')} />
                    </Form.Item>
                    <div className="flex gap-4">
                        <Form.Item label={t('artifact.type')} name="type" className="flex-1" initialValue="docker_image">
                            <Select options={[
                                { value: 'docker_image', label: t('artifact.typeDockerImage') },
                                { value: 'jar', label: t('artifact.typeJar') },
                                { value: 'binary', label: t('artifact.typeBinary') },
                                { value: 'helm_chart', label: t('artifact.typeHelmChart') },
                                { value: 'other', label: t('artifact.typeOther') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={t('artifact.registry')} name="registry" className="flex-1">
                            <Select
                                allowClear
                                placeholder={t('artifact.selectRegistry')}
                                options={registryData?.data?.map((r: any) => ({ label: r.name, value: r.id }))}
                            />
                        </Form.Item>
                    </div>
                    <Form.Item label={t('artifact.repository')} name="repository">
                        <Input placeholder={t('artifact.repositoryPlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('artifact.latestTag')} name="latest_tag">
                        <Input placeholder={t('artifact.latestTagPlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('artifact.pipeline')} name="pipeline">
                        <Select
                            allowClear
                            placeholder={t('artifact.selectPipeline')}
                            options={pipelineData?.data?.map((p: any) => ({ label: p.name, value: p.id }))}
                        />
                    </Form.Item>
                    <Form.Item label={t('artifact.description')} name="description">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Modal>

            <Drawer
                title={t('artifact.artifactDetail', { name: detailArtifact?.name })}
                placement="right"
                width={700}
                open={detailVisible}
                onClose={() => { setDetailVisible(false); setDetailArtifact(null); setVersions([]); }}
            >
                {detailArtifact && (
                    <div className="flex flex-col gap-4">
                        <Card size="small" title={t('artifact.basicInfo')}>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><Text type="secondary">{t('artifact.type')}:</Text> {typeMap[detailArtifact.type]?.text}</div>
                                <div><Text type="secondary">{t('artifact.registry')}:</Text> {detailArtifact.registry_name || '-'}</div>
                                <div><Text type="secondary">{t('artifact.repository')}:</Text> {detailArtifact.repository || '-'}</div>
                                <div><Text type="secondary">{t('artifact.latestTag')}:</Text> {detailArtifact.latest_tag || '-'}</div>
                                <div><Text type="secondary">{t('artifact.latestDigest')}:</Text> {detailArtifact.latest_digest ? <Text code>{detailArtifact.latest_digest?.substring(0, 16)}...</Text> : '-'}</div>
                                <div><Text type="secondary">{t('artifact.size')}:</Text> {formatSize(detailArtifact.latest_size)}</div>
                                <div><Text type="secondary">{t('artifact.pipeline')}:</Text> {detailArtifact.pipeline_name || '-'}</div>
                                <div><Text type="secondary">{t('artifact.createTime')}:</Text> {dayjs(detailArtifact.create_time).format('YYYY-MM-DD HH:mm')}</div>
                            </div>
                        </Card>
                        <Card size="small" title={t('artifact.versionHistory')}>
                            <Table
                                dataSource={versions}
                                columns={versionColumns}
                                rowKey="id"
                                scroll={{ x: 'max-content' }}
                                size="small"
                                pagination={{ pageSize: 10 }}
                            />
                        </Card>
                    </div>
                )}
            </Drawer>
        </>
    );
};

export default Artifacts;
