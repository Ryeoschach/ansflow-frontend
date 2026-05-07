import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ClusterOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const K8sNode = ({ data, isConnectable, ...props }: NodeProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.k8sDeployment')}
      icon={<ClusterOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor={token.colorPrimary}
    />
  );
};

export default memo(K8sNode);
