import React, { useState } from 'react';
import {
    Table,
    Card,
    Button,
    Modal,
    Form,
    Input,
    Space,
    Tooltip,
    Popconfirm,
    Select,
    Tag,
    Divider,
    Typography,
    Empty,
    theme,
    Popover,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    DatabaseOutlined,
    ArrowRightOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getResourcePools,
    createResourcePool,
    updateResourcePool,
    deleteResourcePool,
    getEnvironments,
    getPlatforms, // 保持 API 里的拼写
    getHosts
} from '../../api/hosts.ts';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';
import { App } from 'antd';
import {TableSkeleton} from "../../components/Skeletons";

const { Text } = Typography;

const ResourcePoolManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { isDark, token, hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPool, setEditingPool] = useState<any>(null);

    // 列表筛选状态
    const [listFilters, setListFilters] = useState({
        name: '',
        code: '',
        env: undefined as number | undefined,
        platform: undefined as number | undefined,
    });

    // 弹窗内主机筛选状态
    const [selectedEnv, setSelectedEnv] = useState<number | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState<number | null>(null);

    // 最终选中的主机 ID 集合 (资源池包含的主机)
    const [selectedHostIds, setSelectedHostIds] = useState<number[]>([]);

    // 1. 获取资源池列表
    const { data: poolData, isLoading: poolsLoading } = useQuery({
        queryKey: ['ResourcePools', listFilters],
        queryFn: () => getResourcePools({ 
            page: 1, 
            size: 100,
            ...listFilters
        }),
        enabled: !!token,
    });

    // 2. 获取基础配置数据 (环境/平台)
    const { data: envData } = useQuery({
        queryKey: ['environments-all'],
        queryFn: () => getEnvironments({ page: 1, size: 100 }),
        enabled: !!token,
    });

    const { data: platformData } = useQuery({
        queryKey: ['platforms-all'],
        queryFn: () => getPlatforms({ page: 1, size: 100 }),
        enabled: !!token,
    });

    // 3. 根据筛选条件动态获取待选主机
    const { data: hostData, isLoading: hostsLoading } = useQuery({
        queryKey: ['Hosts-Selection', selectedEnv, selectedPlatform],
        queryFn: () => getHosts({
            env: selectedEnv || undefined,
            platform: selectedPlatform || undefined,
            size: 100
        }),
        enabled: !!token && isModalOpen && (!!selectedEnv || !!selectedPlatform),
    });

    const environments = envData?.data || [];
    const platforms = platformData?.data || [];
    const availableHosts = hostData?.data || [];

    // 整合所有已知的主机详情，用于在左侧和右侧列表显示。
    // 这包括了 API 能查出来的待选主机，以及当前正在编辑的资源池已有的主机。
    const allHostsMap = React.useMemo(() => {
        const map = new Map<number, any>();
        // 1. 注入当前筛选出来的待选主机
        availableHosts.forEach((h: any) => map.set(h.id, h));
        // 2. 注入正在编辑的资源池已有的主机详情
        if (editingPool?.host_details) {
            editingPool.host_details.forEach((h: any) => map.set(h.id, h));
        }
        return map;
    }, [availableHosts, editingPool]);

    // 4. Mutations
    const saveMutation = useMutation({
        mutationFn: (values: any) => {
            const payload = {
                ...values,
                hosts: selectedHostIds // 手动攒的主机列表
            };
            return editingPool ? updateResourcePool(editingPool.id, payload) : createResourcePool(payload);
        },
        onSuccess: () => {
            message.success(editingPool ? '资源池更新成功' : '资源池创建成功');
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ResourcePools'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteResourcePool,
        onSuccess: () => {
            message.success('资源池已删除');
            queryClient.invalidateQueries({ queryKey: ['ResourcePools'] });
        }
    });

    const showModal = (pool?: any) => {
        setEditingPool(pool || null);
        setSelectedEnv(null);
        setSelectedPlatform(null);
        
        if (pool) {
            form.setFieldsValue(pool);
            setSelectedHostIds(pool.hosts || []); // 后端通常返回 ID 数组
        } else {
            form.resetFields();
            setSelectedHostIds([]);
        }
        setIsModalOpen(true);
    };

    // 表格列定义
    const columns = [
        {
            title: '资源池名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: '资源池标识',
            dataIndex: 'code',
            key: 'code',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: '主机数量',
            dataIndex: 'hosts',
            key: 'hostCount',
            render: (hosts: any[], record: any) => {
                const hostList = record.host_details || [];
                const content = (
                    <div className="max-h-60 overflow-auto py-1 whitespace-nowrap">
                        {hostList.length > 0 ? (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-gray-100 opacity-50">
                                        <th className="text-left pb-1 pr-4">主机名</th>
                                        <th className="text-left pb-1">内网 IP</th>
                                        <th className="text-left pb-1">所属平台</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hostList.map((h: any) => (
                                        <tr key={h.id} className="hover:bg-gray-50/5 transition-colors">
                                            <td className="py-1.5 pr-4 font-medium">{h.hostname}</td>
                                            <td className="py-1.5 opacity-70 font-mono">{h.private_ip}</td>
                                            <td className="py-1.5 opacity-70">{h.platform_name || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <Text type="secondary" className="text-xs">暂无主机</Text>
                        )}
                    </div>
                );

                return (
                    <Popover 
                        content={content} 
                        title={<span className="text-xs font-bold opacity-50 uppercase tracking-widest">主机详情</span>}
                        trigger="hover"
                        placement="right"
                    >
                        <Tag color="cyan" className="cursor-help">
                            {hosts?.length || 0} 台
                        </Tag>
                    </Popover>
                );
            }
        },
        {
            title: '描述',
            dataIndex: 'remark',
            key: 'remark',
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="编辑">
                        <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
                    </Tooltip>
                    <Popconfirm title="确定删除吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
                        <Tooltip title="删除">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card title="资源池管理" className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('resource:resources:add')) && (
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => showModal()}
            >
                创建资源池
            </Button>
            )
        }>
            <div 
                className="mb-4 p-4 rounded-lg flex flex-wrap gap-4 items-end border transition-colors"
                style={{ 
                    backgroundColor: antdToken.colorFillAlter,
                    borderColor: antdToken.colorBorderSecondary,
                }}
            >
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">资源池名称</div>
                    <Input 
                        placeholder="模糊搜索名称" 
                        className="w-40" 
                        allowClear
                        value={listFilters.name}
                        onChange={e => setListFilters({ ...listFilters, name: e.target.value })}
                    />
                </div>
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">资源池标识</div>
                    <Input 
                        placeholder="模糊搜索标识" 
                        className="w-40" 
                        allowClear
                        value={listFilters.code}
                        onChange={e => setListFilters({ ...listFilters, code: e.target.value })}
                    />
                </div>
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">包含环境</div>
                    <Select
                        placeholder="全部环境"
                        className="w-40"
                        allowClear
                        value={listFilters.env}
                        onChange={val => setListFilters({ ...listFilters, env: val })}
                        options={environments.map((e: any) => ({ label: e.name, value: e.id }))}
                    />
                </div>
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">包含平台</div>
                    <Select
                        placeholder="全部平台"
                        className="w-40"
                        allowClear
                        value={listFilters.platform}
                        onChange={val => setListFilters({ ...listFilters, platform: val })}
                        options={platforms.map((p: any) => ({ label: p.name, value: p.id }))}
                    />
                </div>
                <Button 
                    onClick={() => setListFilters({ name: '', code: '', env: undefined, platform: undefined })}
                    type="text"
                    danger
                >
                    重置
                </Button>
            </div>

            {poolsLoading ? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table
                dataSource={poolData?.data}
                columns={columns}
                loading={poolsLoading}
                rowKey="id"
                scroll={{ x: 1200 }}
            />
                )}

            <Modal
                title={editingPool ? '编辑资源池' : '创建资源池'}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
                width={isMobile ? '95vw' : 900}
                bodyStyle={{ overflowX: 'auto' }}
                style={{ top: 20 }}
            >
                <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入资源池名称' }]}>
                            <Input placeholder="例如: 核心业务网关池" />
                        </Form.Item>
                        <Form.Item label="标识 (Ansible Group)" name="code" rules={[{ required: true, message: '请输入标识' }]}>
                            <Input placeholder="例如: web_gateway" />
                        </Form.Item>
                    </div>

                    <Divider titlePlacement="left" plain><DatabaseOutlined /> 主机编排</Divider>

                    <div className="flex flex-col md:flex-row gap-4">
                        {/* 左侧：主机筛选与待选区 */}
                        <div 
                            className="flex-1 rounded-xl p-4 transition-all"
                            style={{ backgroundColor: antdToken.colorFillQuaternary }}
                        >
                            <div className="text-[10px] font-bold mb-3 opacity-40 uppercase tracking-widest">第一步：定位资源</div>
                            <div className="flex gap-2 mb-4">
                                <Select
                                    placeholder="筛选环境"
                                    className="flex-1"
                                    allowClear
                                    onChange={setSelectedEnv}
                                    options={environments.map((e: any) => ({ label: e.name, value: e.id }))}
                                />
                                <Select
                                    placeholder="筛选平台"
                                    className="flex-1"
                                    allowClear
                                    onChange={setSelectedPlatform}
                                    options={platforms.map((p: any) => ({ label: p.name, value: p.id }))}
                                />
                            </div>

                            <div 
                                className="border rounded-lg h-64 overflow-auto shadow-inner transition-colors"
                                style={{ 
                                    backgroundColor: antdToken.colorBgContainer,
                                    borderColor: antdToken.colorBorderSecondary 
                                }}
                            >
                                <Table
                                    size="small"
                                    showHeader={false}
                                    pagination={false}
                                    loading={hostsLoading}
                                    dataSource={availableHosts.filter(h => !selectedHostIds.includes(h.id))}
                                    rowKey="id"
                                    columns={[
                                        {
                                            title: '主机',
                                            render: (_, h) => (
                                                <div className="flex justify-between items-center w-full group">
                                                    <div>
                                                        <div className="text-sm font-medium">{h.hostname}</div>
                                                        <div className="text-xs text-gray-400">{h.private_ip}</div>
                                                    </div>
                                                    <Button 
                                                        type="link" 
                                                        size="small" 
                                                        icon={<PlusOutlined />}
                                                        onClick={() => setSelectedHostIds([...selectedHostIds, h.id])}
                                                    >
                                                        添加
                                                    </Button>
                                                </div>
                                            )
                                        }
                                    ]}
                                    locale={{ emptyText: (!selectedEnv && !selectedPlatform) ? "请先选择环境或平台" : "该分类下暂无可用主机" }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center">
                            <ArrowRightOutlined className="text-gray-300 text-xl" />
                        </div>

                        {/* 右侧：已选区 */}
                        <div 
                            className="flex-1 rounded-xl p-4 transition-all"
                            style={{ backgroundColor: antdToken.colorPrimaryBg }}
                        >
                            <div 
                                className="text-xs font-bold mb-3 uppercase tracking-widest"
                                style={{ color: antdToken.colorPrimary }}
                            >
                                第二步：已命中主机 ({selectedHostIds.length})
                            </div>
                            
                            <div 
                                className="border rounded-lg h-78 overflow-auto shadow-inner transition-colors"
                                style={{ 
                                    backgroundColor: antdToken.colorBgContainer,
                                    borderColor: antdToken.colorBorderSecondary 
                                }}
                            >
                                {selectedHostIds.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Empty description="尚未添加任何主机" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-2">
                                        {selectedHostIds.map(id => {
                                            const h = allHostsMap.get(id);
                                            return (
                                                <div 
                                                    key={id} 
                                                    className="flex justify-between items-center p-2 rounded-md border border-transparent hover:border-blue-300 transition-all shadow-sm mb-2 mx-2 first:mt-2 last:mb-0"
                                                    style={{ 
                                                        backgroundColor: antdToken.colorBgElevated,
                                                        borderColor: antdToken.colorBorderSecondary
                                                    }}
                                                >
                                                    <div>
                                                        <div className="text-sm font-medium">{h?.hostname || `Unknown (ID: ${id})`}</div>
                                                        <div className="text-[10px] opacity-50 font-mono">{h?.private_ip || '-'}</div>
                                                    </div>
                                                    <Button 
                                                        type="text" 
                                                        danger 
                                                        size="small" 
                                                        icon={<CloseCircleOutlined />} 
                                                        onClick={() => setSelectedHostIds(selectedHostIds.filter(hid => hid !== id))}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {selectedHostIds.length > 0 && (
                                <div className="mt-2 text-right">
                                    <Button type="link" danger size="small" onClick={() => setSelectedHostIds([])}>清空全部</Button>
                                </div>
                            )}
                        </div>
                    </div>

                    <Form.Item label="备注" name="remark" className="mt-4">
                        <Input.TextArea rows={2} placeholder="资源池用途说明..." />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ResourcePoolManagement;
