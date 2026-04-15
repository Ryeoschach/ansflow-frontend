import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import React, {useState} from 'react';
import {Button, Card, Modal, Popconfirm, Space, Table, Tooltip, Form, Input, Tag, Select, App} from "antd";
import {createEnvironment, deleteEnvironment, getEnvironments, updateEnvironment} from "../../api/hosts.ts";
import useAppStore from "../../store/useAppStore.ts";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "@ant-design/icons";
import {Environments} from "../../types";
import {TableSkeleton} from "../../components/Skeletons";

const Environment: React.FC = () => {
    const queryClient = useQueryClient();
    const {token, hasPermission} = useAppStore();
    const [params, setParams] = useState({ page: 1, size: 10, search: '' });
    const [editingRecord, setEditingRecord] = useState<Environments | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const {message} = App.useApp();

    // 获取所有环境
    const { data: envData, isLoading: listLoading } = useQuery({
        queryKey: ["environment", params],
        queryFn: () => getEnvironments(params),
        enabled: !!token
    })

    // 创建/更新环境信息
    const saveMutation = useMutation({
        mutationFn: (values) =>  editingRecord? updateEnvironment(editingRecord.id, values) : createEnvironment(values),
        onSuccess: () => {
            message.success(editingRecord? "环境更新完成": "新环境创建成功");
            setIsModalOpen(false);
            queryClient.invalidateQueries({queryKey: ['environment']});
        }
    })

    // 删除环境
    const deleteMutation = useMutation({
        mutationFn: deleteEnvironment,
        onSuccess: () => {
            message.success("环境删除成功");
            queryClient.invalidateQueries({queryKey: ['environment']});
        }
    })

    const typeMap: Record<string, { text: string, color: string }> = {
        'dev': { text: '开发环境', color: 'blue' },
        'prd': { text: '生产环境', color: 'red' },
        'uat': { text: 'UAT', color: 'orange' },
        'test': { text: '测试', color: 'green' },
        'others': { text: 'others', color: 'default' }
    };

    const columns = [
        {
            title: '环境名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: '环境标签',
            dataIndex: 'code',
            key: 'code',
            render: (val: string) => {
                const mappedInfo = typeMap[val] || typeMap['others'];
                return <Tag color={mappedInfo.color}>{mappedInfo.text}</Tag>;
            },
        },
        {
            title: '描述',
            dataIndex: 'remark',
            key: 'remark',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {(hasPermission('*') || hasPermission('resource:environments:edit')) && (
                        <Tooltip title="编辑">
                            {/* 点编辑时：把当前行数据存起来 -> 填充表单 -> 弹窗打开 */}
                            <Button type="text" icon={<EditOutlined />} onClick={() => {
                                setEditingRecord(record);
                                form.setFieldsValue(record);
                                setIsModalOpen(true);
                            }} />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:environments:delete')) && (
                        <Popconfirm title="确定删除吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title="删除">
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        }
    ]

    return (
        <Card
            title="环境管理"
            className="m-4 shadow-sm"
            extra={
                (hasPermission('*') || hasPermission('resource:environments:add')) && (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setEditingRecord(null);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}
                    >
                        新增环境
                    </Button>
                )
            }
        >
            { listLoading? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table
                dataSource={envData?.data}
                columns={columns}
                rowKey="id"
                scroll={{ x: 1200 }}
                pagination={{
                    total: envData?.total,
                    current: params.page,
                    pageSize: params.size,
                    showSizeChanger: true,
                    onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                }}
            />
                )}

            <Modal
                title={editingRecord? "更新环境": "创建新环境"}
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
                    <Form.Item label="环境名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="例如: 测试" />
                    </Form.Item>

                    <Form.Item label="环境标签" name="code" rules={[{ required: true, message: '请选择环境类型' }]}>
                        <Select options={Object.entries(typeMap).map(([key, val]) => ({
                            label: val.text, value: key
                        }))} />
                    </Form.Item>

                    <Form.Item label="备注说明" name="remark">
                        <Input.TextArea placeholder="补充说明信息..." rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    )
}

export default Environment;