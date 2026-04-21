import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import React, {useState} from 'react';
import {Button, Card, Modal, Popconfirm, Space, Table, Tooltip, Form, Input, Tag, Select, App} from "antd";
import {createEnvironment, deleteEnvironment, getEnvironments, updateEnvironment} from "../../api/hosts.ts";
import useAppStore from "../../store/useAppStore.ts";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "@ant-design/icons";
import {Environments} from "../../types";
import {TableSkeleton} from "../../components/Skeletons";
import { useTranslation } from 'react-i18next';

const Environment: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const {token, hasPermission} = useAppStore();
    const [params, setParams] = useState({ page: 1, size: 10, search: '' });
    const [editingRecord, setEditingRecord] = useState<Environments | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const {message} = App.useApp();

    const { data: envData, isLoading: listLoading } = useQuery({
        queryKey: ["environment", params],
        queryFn: () => getEnvironments(params),
        enabled: !!token
    })

    const saveMutation = useMutation({
        mutationFn: (values) =>  editingRecord? updateEnvironment(editingRecord.id, values) : createEnvironment(values),
        onSuccess: () => {
            message.success(editingRecord? t('environment.envUpdated') : t('environment.envCreated'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({queryKey: ['environment']});
        }
    })

    const deleteMutation = useMutation({
        mutationFn: deleteEnvironment,
        onSuccess: () => {
            message.success(t('environment.envDeleted'));
            queryClient.invalidateQueries({queryKey: ['environment']});
        }
    })

    const typeMap: Record<string, { text: string, color: string }> = {
        'dev': { text: t('environment.typeDev'), color: 'blue' },
        'prd': { text: t('environment.typePrd'), color: 'red' },
        'uat': { text: 'UAT', color: 'orange' },
        'test': { text: t('environment.typeTest'), color: 'green' },
        'others': { text: 'others', color: 'default' }
    };

    const columns = [
        {
            title: t('environment.envName'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: t('environment.envLabel'),
            dataIndex: 'code',
            key: 'code',
            render: (val: string) => {
                const mappedInfo = typeMap[val] || typeMap['others'];
                return <Tag color={mappedInfo.color}>{mappedInfo.text}</Tag>;
            },
        },
        {
            title: t('environment.description'),
            dataIndex: 'remark',
            key: 'remark',
            ellipsis: true,
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: t('environment.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {(hasPermission('*') || hasPermission('resource:environments:edit')) && (
                        <Tooltip title={t('environment.edit')}>
                            <Button type="text" icon={<EditOutlined />} onClick={() => {
                                setEditingRecord(record);
                                form.setFieldsValue(record);
                                setIsModalOpen(true);
                            }} />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:environments:delete')) && (
                        <Popconfirm title={t('environment.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title={t('environment.delete')}>
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
            title={t('environment.title')}
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
                        {t('environment.addEnv')}
                    </Button>
                )
            }
        >
            { listLoading? (
                <TableSkeleton />
            ) : (
            <Table
                dataSource={envData?.data}
                columns={columns}
                rowKey="id"
                scroll={{ x: 'max-content' }}
               
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
                title={editingRecord? t('environment.updateEnv') : t('environment.createEnv')}
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
                    <Form.Item label={t('environment.envName')} name="name" rules={[{ required: true, message: t('environment.nameRequired') }]}>
                        <Input placeholder={t('environment.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item label={t('environment.envLabel')} name="code" rules={[{ required: true, message: t('environment.codeRequired') }]}>
                        <Select options={Object.entries(typeMap).map(([key, val]) => ({
                            label: val.text, value: key
                        }))} />
                    </Form.Item>

                    <Form.Item label={t('environment.remarkLabel')} name="remark">
                        <Input.TextArea placeholder={t('environment.remarkPlaceholder')} rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    )
}

export default Environment;
