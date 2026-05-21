import React from 'react';
import GitOpsCenterComponent from './components/GitOpsCenter';
import { Card, Typography, Space, theme } from 'antd';
import { RocketOutlined } from '@ant-design/icons';

const { Title } = Typography;

/**
 * GitOps 应用中心独立页面
 */
const GitOpsCenterPage: React.FC = () => {
    const { token } = theme.useToken();
    
    return (
        <div className="p-0">
             <div className="mb-6">
                <Space direction="vertical" size={0}>
                    <Title level={3} style={{ margin: 0 }}>
                        <RocketOutlined style={{ color: token.colorPrimary, marginRight: 8 }} />
                        GitOps 应用中心
                    </Title>
                    <Typography.Text type="secondary">
                        基于 Git 仓库同步 K8s 集群状态，实现声明式部署与自动巡检
                    </Typography.Text>
                </Space>
            </div>
            <GitOpsCenterComponent />
        </div>
    );
};

export default GitOpsCenterPage;
