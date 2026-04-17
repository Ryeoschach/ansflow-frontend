import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ClusterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const K8sNode = ({ data, isConnectable, ...props }: NodeProps) => {
  const { t } = useTranslation();
  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.k8sDeployment')}
      icon={<ClusterOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#326CE5"
    />
  );
};

export default memo(K8sNode);
