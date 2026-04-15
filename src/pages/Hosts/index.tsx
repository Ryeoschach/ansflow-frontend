import React, { useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, Space, Tooltip, Popconfirm, Select, InputNumber, Tag, App } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, DesktopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {getHosts, createHost, updateHost, deleteHost, getEnvironments, getPlatforms, getCredentials} from '../../api/hosts.ts';
import useAppStore from '../../store/useAppStore';
import {TableSkeleton} from "../../components/Skeletons";
import { useBreakpoint } from '@/utils/useBreakpoint';

const HostManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { hasPermission } = useAppStore();
    const { token } = useAppStore.getState();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHost, setEditingHost] = useState<any>(null);

    // 分页与筛选参数
    const [params, setParams] = useState({ page: 1, size: 10, search: '' });

    // 获取主机列表
    const { data, isLoading } = useQuery({
        queryKey: ['Hosts', params],
        queryFn: () => getHosts(params),
        enabled: !!token,
    });

    // 获取所有环境 (用于下拉选择和表格渲染)
    const { data: envData } = useQuery({
        queryKey: ['environments'],
        queryFn: () => getEnvironments(params), // 获取全量环境
        enabled: !!token,
    });

    // 获取所属平台
    const { data: platformData } = useQuery({
        queryKey: ['platforms', params],
        queryFn: () => getPlatforms(params),
        enabled: !!token,
    });

    // 获取凭据列表
    const { data: credData } = useQuery({
        queryKey: ['ssh-credentials-all'],
        queryFn: () => getCredentials({ page: 1, size: 100 }),
        enabled: !!token,
    });

    // 获取环境列表数据供 Select 组件使用
    const environments = envData?.data || [];
    const platforms = platformData?.data || [];

    // 增删改 Mutations
    const saveMutation = useMutation({
        mutationFn: (values: any) => editingHost ? updateHost(editingHost.id, values) : createHost(values),
        onSuccess: () => {
            message.success(editingHost ? '主机更新成功' : '主机创建成功');
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['Hosts'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteHost,
        onSuccess: () => {
            message.success('主机已删除');
            queryClient.invalidateQueries({ queryKey: ['Hosts'] });
        }
    });

    // 状态映射字典
    const statusMap: Record<number, { text: string; color: string }> = {
        0: { text: '下线', color: 'default' },
        1: { text: '在线', color: 'success' },
        2: { text: '故障', color: 'error' },
        3: { text: '备用', color: 'processing' },
    };

    const columns = [
        {
            title: '主机名',
            dataIndex: 'hostname',
            key: 'hostname',
            render: (text: string) => <span className="font-semibold"><DesktopOutlined className="mr-2 opacity-50"/>{text}</span>
        },
        {
            title: '环境',
            dataIndex: 'env',
            key: 'env',
            render: (envId: number) => {
                const env = environments.find((e: any) => e.id === envId);
                return <Tag color="blue">{env?.name || `ID:${envId}`}</Tag>;
            }
        },
        {
            title: '平台',
            dataIndex: 'platform',
            key: 'platform',
            render: (platformId: number) => {
                if (!platformId) return <Tag color="default">未分类</Tag>;

                // 去数组里找对应的平台名称
                const p = platforms.find((p: any) => p.id === platformId);
                return <Tag color="cyan">{p?.name || `ID:${platformId}`}</Tag>;
            }
        },
        {
            title: 'IP地址',
            key: 'ip',
            render: (_: any, record: any) => (
                <div className="flex flex-col text-xs">
                    {record.private_ip && <span className="text-gray-500">内网: {record.private_ip}</span>}
                    {record.ip_address && <span className="text-blue-500">公网: {record.ip_address}</span>}
                </div>
            )
        },
        {
            title: '开放端口',
            key: 'ports',
            dataIndex: 'ports',
            // render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: '配置',
            key: 'specs',
            render: (_: any, record: any) => (
                <span className="text-xs text-gray-500">
                    {record.cpu}核 / {record.memory}G / {record.disk}G
                </span>
            )
        },
        {
            title: '操作系统',
            dataIndex: 'os_type',
            key: 'os_type',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => {
                const s = statusMap[status] || statusMap[0];
                return <Tag color={s.color}>{s.text}</Tag>;
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="编辑">
                        <Button type="text" icon={<EditOutlined />} onClick={() => {
                            setEditingHost(record);
                            form.setFieldsValue(record);
                            setIsModalOpen(true);
                        }} />
                    </Tooltip>
                    <Popconfirm title="确定删除此主机吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
                        <Tooltip title="删除">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card title="主机管理" className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('resource:hosts:add')) && (
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                    setEditingHost(null);
                    // 提供一些默认值
                    form.resetFields();
                    form.setFieldsValue({ status: 1, cpu: 2, memory: 4, disk: 50, os_type: 'Linux' });
                    setIsModalOpen(true);
                }}
            >
                录入主机
            </Button>
            )
        }>
            {isLoading ? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table
                dataSource={data?.data}
                columns={columns}
                loading={isLoading}
                rowKey="id"
                scroll={{ x: 1200 }}
                pagination={{
                    total: data?.total,
                    current: params.page,
                    pageSize: params.size,
                    showSizeChanger: true,
                    onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                }}
            />
                )}

            <Modal
                title={editingHost ? '编辑主机' : '录入主机'}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
                width={isMobile ? '95vw' : 600}
                bodyStyle={{ overflowX: 'auto' }}
                className={isMobile ? '!top-4' : ''}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => saveMutation.mutate(values)}
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item label="主机名" name="hostname" rules={[{ required: true, message: '请输入主机名' }]}>
                            <Input placeholder="例如: web-server-01" />
                        </Form.Item>
                        <Form.Item label="所属环境" name="env" rules={[{ required: true, message: '请选择环境' }]}>
                            <Select placeholder="请选择环境" options={environments.map((e: any) => ({ label: e.name, value: e.id }))} />
                        </Form.Item>
                        <Form.Item label="所属平台" name="platform">
                            <Select placeholder="请选择平台(可选)" options={platforms.map((p: any) => ({ label: p.name, value: p.id }))} allowClear/>
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item label="内网 IP" name="private_ip">
                            <Input placeholder="例如: 192.168.1.100" />
                        </Form.Item>
                        <Form.Item label="公网 IP" name="ip_address">
                            <Input placeholder="例如: 8.8.8.8" />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item label="CPU (核)" name="cpu">
                            <InputNumber className="w-full" min={1} />
                        </Form.Item>
                        <Form.Item label="内存 (GB)" name="memory">
                            <InputNumber className="w-full" min={1} />
                        </Form.Item>
                        <Form.Item label="磁盘 (GB)" name="disk">
                            <InputNumber className="w-full" min={1} />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item label="操作系统" name="os_type">
                            <Input placeholder="例如: CentOS 7.9" />
                        </Form.Item>
                        <Form.Item label="端口号" name="ports">
                            <Input placeholder="例如：80 3306" />
                        </Form.Item>
                        <Form.Item label="主机状态" name="status">
                            <Select options={[
                                { label: '在线', value: 1 },
                                { label: '下线', value: 0 },
                                { label: '故障', value: 2 },
                                { label: '备用', value: 3 },
                            ]} />
                        </Form.Item>
                    </div>

                    <Form.Item label="SSH 登录凭据 (可选)" name="credential" help="留空则使用所属平台的默认凭据">
                        <Select 
                            placeholder="选择此主机的特定登录凭据"
                            options={credData?.data?.map((c: any) => ({ label: c.name, value: c.id }))}
                            allowClear
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default HostManagement;
