import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const HttpNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { data, isConnectable } = props;

  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.httpCall')}
      icon={<ApiOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#8E44AD"
      defaultBg="#f9f0ff"
    />
  );
};

export default memo(HttpNode);
