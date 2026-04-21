import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import { InboxOutlined, CloudServerOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { TableSkeleton } from '../../../components/Skeletons';

const ImageRegistries = lazy(() => import('../ImageRegistries'));
const Artifactory = lazy(() => import('../Artifactory'));
const Artifacts = lazy(() => import('../Artifacts'));

const ArtifactRepository: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('registries');

  const tabItems = [
    {
      key: 'registries',
      label: (
        <span>
          <CloudServerOutlined />
          {t('artifactRepository.dockerRegistry')}
        </span>
      ),
      children: (
        <Suspense fallback={<TableSkeleton />}>
          <div className="p-4">
            <ImageRegistries />
          </div>
        </Suspense>
      ),
    },
    {
      key: 'artifactory',
      label: (
        <span>
          <DatabaseOutlined />
          {t('artifactRepository.artifactory')}
        </span>
      ),
      children: (
        <Suspense fallback={<TableSkeleton />}>
          <div className="p-4">
            <Artifactory />
          </div>
        </Suspense>
      ),
    },
    {
      key: 'products',
      label: (
        <span>
          <InboxOutlined />
          {t('artifactRepository.products')}
        </span>
      ),
      children: (
        <Suspense fallback={<TableSkeleton />}>
          <div className="p-4">
            <Artifacts />
          </div>
        </Suspense>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card
        title={
          <span>
            <InboxOutlined className="mr-2" />
            {t('artifactRepository.title')}
          </span>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={tabItems}
          defaultActiveKey="registries"
        />
      </Card>
    </div>
  );
};

export default ArtifactRepository;
