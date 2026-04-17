import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ContainerOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const BuildNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { data, isConnectable } = props;
  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.dockerBuild')}
      icon={<ContainerOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#2496ED"
      defaultBg={token.colorInfoBg}
    />
  );
};

export default memo(BuildNode);
