import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { PlayCircleOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const AnsibleNode = (props: NodeProps) => {
  const { data, isConnectable } = props;
  return (
    <BaseNode
      title="Ansible 任务"
      icon={<PlayCircleOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#EE0000"
    />
  );
};

export default memo(AnsibleNode);
