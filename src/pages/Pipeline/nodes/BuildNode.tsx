import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ContainerOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import BaseNode from './BaseNode';

const BuildNode = (props: NodeProps) => {
  const { token } = theme.useToken();
  const { data, isConnectable } = props; // Destructure data and isConnectable from props
  return (
    <BaseNode
      {...props} // Keep existing props spreading
      title="Docker 构建"
      icon={<ContainerOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#2496ED"
      defaultBg={token.colorInfoBg}
    />
  );
};

export default memo(BuildNode);
