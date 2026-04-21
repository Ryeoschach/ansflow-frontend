import React from 'react';
import { Card, Table, Tag, Skeleton, Button } from 'antd';
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
                    className="flex flex-col cursor-pointer hover:text-indigo-500 transition-colors"
                    onClick={() => handleNavigate(record)}
                >
                    <div className="flex items-center gap-2">
                        <Tag color={record.type === 'pipeline' ? 'blue' : 'orange'} className="text-[10px] px-1 py-0 leading-none h-4 border-0 m-0">
                            {record.type === 'pipeline' ? t('dashboard.pipeline') : t('dashboard.task')}
                        </Tag>
                        <span className="font-medium">{text}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono pl-1">{record.id}</span>
                </div>
            )
        },
        {
            title: t('dashboard.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'SUCCESS' ? 'success' : 'error'} className="border-0 m-0">
                    {status}
                </Tag>
            ),
        },
        {
            title: t('dashboard.duration'),
            dataIndex: 'time_label',
            key: 'time_label',
            render: (time: string) => <span className="text-gray-400 text-sm">{time}</span>,
        },
        {
            title: t('dashboard.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Button
                    type="text"
                    size="small"
                    icon={<RightOutlined />}
                    onClick={() => handleNavigate(record)}
                />
            ),
        },
    ];

    return (
        <Card
            title={<span className="font-bold text-base">{t('dashboard.recentPipelineRuns')}</span>}
            className="shadow-sm border-0 h-full"
            styles={{ body: { padding: '0 12px 12px 12px' } }}
        >
            {isLoading ? (
                 <div className="p-4">
                     <Skeleton active title={false} paragraph={{ rows: 6 }} />
                 </div>
            ) : (
                <Table
                    dataSource={dataSource}
                    columns={columns}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                           
                    pagination={false}
                    size="small"
                />
            )}
        </Card>
    );
};

export default RecentTasksTable;
