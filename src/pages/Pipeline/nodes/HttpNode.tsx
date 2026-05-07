import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ApiOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const HttpNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { data, isConnectable } = props;

  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.httpCall')}
      icon={<ApiOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor={token.colorPrimary}
      defaultBg={token.colorPrimaryBg}
    />
  );
};

export default memo(HttpNode);
