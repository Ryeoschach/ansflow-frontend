import React from 'react';
import { Card, Table, Tag, Skeleton, Button } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface RecentTasksTableProps {
    data: any;
    isLoading: boolean;
}

const RecentTasksTable: React.FC<RecentTasksTableProps> = ({ data, isLoading }) => {
    const navigate = useNavigate();
    // const { token } = theme.useToken();
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
            title: '任务名称',
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
                            {record.type === 'pipeline' ? '流水线' : '任务'}
                        </Tag>
                        <span className="font-medium">{text}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono pl-1">{record.id}</span>
                </div>
            )
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: string) => (
                <Tag color={status === 'SUCCESS' ? 'success' : 'error'} className="border-0 m-0">
                    {status}
                </Tag>
            ),
        },
        {
            title: '耗时',
            dataIndex: 'time_label',
            key: 'time_label',
            width: 100,
            render: (time: string) => <span className="text-gray-400 text-sm">{time}</span>,
        },
        {
            title: '操作',
            key: 'action',
            width: 60,
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
            title={<span className="font-bold text-base">最近执行流水</span>} 
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
                    scroll={{ x: 1200 }}
                    pagination={false}
                    size="small"
                />
            )}
        </Card>
    );
};

export default RecentTasksTable;
