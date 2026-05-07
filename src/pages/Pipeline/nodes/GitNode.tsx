import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GithubOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const GitNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.codePull')}
      icon={<GithubOutlined />}
      defaultColor={token.colorPrimary}
      defaultBg={token.colorBgElevated}
    />
  );
};

export default memo(GitNode);
