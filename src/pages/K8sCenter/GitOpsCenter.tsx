import React from 'react';
import GitOpsCenterComponent from './components/GitOpsCenter';
import { Card, Typography, Space, theme } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

/**
 * GitOps 应用中心独立页面
 */
const GitOpsCenterPage: React.FC = () => {
    const { token } = theme.useToken();
    const { t } = useTranslation();
    
    return (
        <div className="p-0">
             <div className="mb-6">
                <Space direction="vertical" size={0}>
                    <Title level={3} style={{ margin: 0 }}>
                        <RocketOutlined style={{ color: token.colorPrimary, marginRight: 8 }} />
                        {t('gitops.pageTitle')}
                    </Title>
                    <Typography.Text type="secondary">
                        {t('gitops.pageSubtitle')}
                    </Typography.Text>
                </Space>
            </div>
            <GitOpsCenterComponent />
        </div>
    );
};

export default GitOpsCenterPage;
