import React from 'react';
import { Table, Tag, Skeleton, Button, Space } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface RecentTasksTableProps {
    data: any;
    isLoading: boolean;
}

const RecentTasksTable: React.FC<RecentTasksTableProps> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dataSource = data?.recentTasks || [];

    const handleNavigate = (record: any) => {
        if (record.type === 'pipeline') {
            navigate(`/v1/pipeline/runs/${record.raw_id}`);
        } else {
            navigate(`/v1/task/executions?id=${record.raw_id}`);
        }
    };

    const columns = [
        {
            title: t('dashboard.taskName'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string, record: any) => (
                <div
                    className="flex flex-col cursor-pointer transition-colors group"
                    onClick={() => handleNavigate(record)}
                >
                    <Space size={8}>
                        <div 
                            className="text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-tighter"
                            style={{ 
                                backgroundColor: record.type === 'pipeline' ? 'color-mix(in srgb, var(--ans-primary), transparent 92%)' : 'rgba(0,0,0,0.05)',
                                color: record.type === 'pipeline' ? 'var(--ans-primary)' : 'var(--ans-text-secondary)',
                                border: `1px solid ${record.type === 'pipeline' ? 'color-mix(in srgb, var(--ans-primary), transparent 85%)' : 'rgba(0,0,0,0.1)'}`
                            }}
                        >
                            {record.type === 'pipeline' ? t('dashboard.pipeline') : t('dashboard.task')}
                        </div>
                        <span className="font-bold text-sm text-ans-text-primary group-hover:text-primary transition-colors">{text}</span>
                    </Space>
                    <span className="text-[10px] text-ans-text-secondary opacity-40 font-mono pl-0.5 mt-0.5">{record.id}</span>
                </div>
            )
        },
        {
            title: t('dashboard.status'),
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => {
                const isSuccess = status === 'SUCCESS' || status === 'success';
                return (
                    <Tag 
                        className="border-0 m-0 text-[10px] font-extrabold px-2 py-0"
                        style={{ 
                            backgroundColor: isSuccess ? 'color-mix(in srgb, var(--ans-success), transparent 90%)' : 'color-mix(in srgb, var(--ans-error), transparent 90%)',
                            color: isSuccess ? 'var(--ans-success)' : 'var(--ans-error)'
                        }}
                    >
                        {status.toUpperCase()}
                    </Tag>
                );
            },
        },
        {
            title: t('dashboard.duration'),
            dataIndex: 'time_label',
            key: 'time_label',
            width: 120,
            render: (time: string) => <span className="text-ans-text-secondary text-xs opacity-60 italic">{time}</span>,
        },
        {
            title: '',
            key: 'action',
            width: 40,
            render: (_: any, record: any) => (
                <Button
                    type="text"
                    size="small"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    icon={<RightOutlined style={{ fontSize: 12, color: 'var(--ans-primary)' }} />}
                    onClick={() => handleNavigate(record)}
                />
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className="p-4">
                <Skeleton active title={false} paragraph={{ rows: 6 }} />
            </div>
        );
    }

    return (
        <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={false}
            size="middle"
            className="ans-table-clean"
        />
    );
};

export default RecentTasksTable;