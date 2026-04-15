import React, { useState } from "react";
import {Button, Card, Table, Form, Modal, Input, Select, Tag, Popconfirm, Space, Tooltip, Divider, App} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {createPlatform, deletePlatform, getPlatforms, updatePlatform, verifyPlatform, syncPlatformAssets, getCredentials} from "../../api/hosts.ts";
import useAppStore from "../../store/useAppStore.ts";
import {DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, CloudDownloadOutlined} from "@ant-design/icons";
import {TableSkeleton} from "../../components/Skeletons";

const PlatformManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const { token, hasPermission } = useAppStore();
    const {message} = App.useApp()
    const [editingRecord, setEditingRecord] = useState<any>(null); // 新建为null
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });
    const [form] = Form.useForm();

    // 查询
    const { data, isLoading } = useQuery({
        queryKey: ['platforms', params],
        queryFn: () => getPlatforms(params),
        enabled: !!token,
    });

    // 修改
    const saveMutation = useMutation({
        mutationFn: (values) => editingRecord ? updatePlatform(editingRecord.id, values) : createPlatform(values),
        onSuccess: () => {
            message.success(editingRecord ? "平台更新完成" : "新平台创建完成");
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        }
    })

    // 删除
    const deleteMutation = useMutation({
        mutationFn: deletePlatform,
        onSuccess: () => {
            message.success("平台删除成功");
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        }
    })

    // 验证
    const verifyMutation = useMutation({
        mutationFn: verifyPlatform,
        onSuccess: (res: any) => {
            const status = res.connectivity_status;
            if (status === 1) {
                message.success("平台连接正常");
            } else {
                message.error(`平台连接异常: ${res.error_message || '未知错误'}`);
            }
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        },
        onError: (err: any) => {
            message.error("请求验证失败", err);
        }
    })

    // 同步资产
    const syncMutation = useMutation({
        mutationFn: syncPlatformAssets,
        onSuccess: (res: any) => {
            message.success(res.message || "资产同步任务已启动");
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
            queryClient.invalidateQueries({ queryKey: ['hosts'] }); // 刷新主机列表
        },
        onError: (err: any) => {
            message.error("同步任务启动失败", err);
        }
    })

    // 获取凭据列表
    const { data: credData } = useQuery({
        queryKey: ['ssh-credentials-all'],
        queryFn: () => getCredentials({ page: 1, size: 100 }),
        enabled: !!token,
    });

    const typeMap: Record<string, { text: string, color: string }> = {
        'aliyun': { text: '阿里云', color: 'orange' },
        'tencent': { text: '腾讯云', color: 'blue' },
        'aws': { text: 'AWS', color: 'gold' },
        'vmware': { text: 'VMware', color: 'cyan' },
        'k8s': { text: 'Kubernetes', color: 'purple' },
        'physical': { text: '传统机房', color: 'default' },
        'other': { text: '其他', color: 'default' },
    };

    const columns = [
        {
            title: '平台名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: '平台类型',
            dataIndex: 'type',
            key: 'type',
            render: (val: string) => {
                const mappedInfo = typeMap[val] || typeMap['other'];
                return <Tag color={mappedInfo.color}>{mappedInfo.text}</Tag>;
            }
        },
        {
            title: '平台描述',
            dataIndex: 'remark',
            key: 'remark',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: '连通性',
            dataIndex: 'connectivity_status',
            key: 'connectivity',
            render: (val: number, record: any) => {
                const statusMap: any = {
                    0: { color: 'default', text: '未验证', icon: <ExclamationCircleOutlined /> },
                    1: { color: 'success', text: '正常', icon: <CheckCircleOutlined /> },
                    2: { color: 'error', text: '异常', icon: <CloseCircleOutlined /> },
                };
                const info = statusMap[val] || statusMap[0];
                return (
                    <Tooltip title={val === 2 ? record.error_message : (record.last_verified_at ? `上次验证: ${new Date(record.last_verified_at).toLocaleString()}` : '尚未验证')}>
                        <Tag color={info.color} icon={info.icon} className="cursor-help">
                            {info.text}
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (val: boolean) => (
                <Tag color={val ? 'success' : 'error'}>
                    {val ? '启用' : '禁用'}
                </Tag>
            )
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {(hasPermission('*') || hasPermission('resource:platforms:sync')) && (
                        <Tooltip title="同步云资产">
                             <Button 
                                type="text" 
                                icon={<CloudDownloadOutlined />} 
                                loading={syncMutation.isPending && syncMutation.variables === record.id}
                                onClick={() => syncMutation.mutate(record.id)} 
                            />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:platforms:verify')) && (
                        <Tooltip title="验证连通性">
                             <Button 
                                type="text" 
                                icon={<SyncOutlined spin={verifyMutation.isPending && verifyMutation.variables === record.id} />} 
                                loading={verifyMutation.isPending && verifyMutation.variables === record.id}
                                onClick={() => verifyMutation.mutate(record.id)} 
                            />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:platforms:edit')) && (
                        <Tooltip title="编辑">
                            <Button type="text" icon={<EditOutlined />} onClick={() => {
                                setEditingRecord(record);
                                form.setFieldsValue(record);
                                setIsModalOpen(true);
                            }} />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:platforms:delete')) && (
                        <Popconfirm title="确定删除吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title="删除">
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title="平台管理" className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('resource:platforms:add')) && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    setEditingRecord(null);
                    form.resetFields();
                    form.setFieldsValue({ type: 'aliyun' })
                    setIsModalOpen(true);
                }}>
                    新增平台
                </Button>
            )
        }>
            {isLoading ? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table
                dataSource={data?.data}
                columns={columns}
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
                title={editingRecord ? "编辑平台" : "新增平台"}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => saveMutation.mutate(values)}
                >
                    <Form.Item label="平台名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="例如: 阿里云-华东1" />
                    </Form.Item>

                    <Form.Item label="平台类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
                        <Select options={Object.entries(typeMap).map(([key, val]) => ({
                            label: val.text, value: key
                        }))} />
                    </Form.Item>

                    <Divider plain style={{ margin: '12px 0' }}>连接配置</Divider>

                    <Form.Item label="Access Key" name="access_key">
                        <Input placeholder="AK / 用户名" />
                    </Form.Item>

                    <Form.Item label="Secret Key" name="secret_key">
                        <Input.Password placeholder="SK / 密码" />
                    </Form.Item>

                    <Form.Item label="API Endpoint" name="api_endpoint">
                        <Input placeholder="云端 API 地址或内网管理地址" />
                    </Form.Item>

                    <Form.Item label="默认 SSH 登录凭据" name="default_credential">
                        <Select 
                            placeholder="选择此平台下主机的默认登录方式"
                            options={credData?.data?.map((c: any) => ({ label: c.name, value: c.id }))}
                            allowClear
                        />
                    </Form.Item>

                    <Form.Item label="启用状态" name="status" valuePropName="checked" initialValue={true}>
                        <Select options={[
                            { label: '启用', value: true },
                            { label: '禁用', value: false },
                        ]} />
                    </Form.Item>

                    <Form.Item label="备注说明" name="remark">
                        <Input.TextArea placeholder="补充说明信息..." rows={2} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    )
}

export default PlatformManagement