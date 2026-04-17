import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const AnsibleNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { data, isConnectable } = props;
  return (
    <BaseNode
      title={t('pipelineNode.ansibleTask')}
      icon={<PlayCircleOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#EE0000"
    />
  );
};

export default memo(AnsibleNode);
