import React from 'react';
import { Card, Tabs, Descriptions, Tag, Space, Button, Form, Input, App, Divider, Avatar, Typography } from 'antd';
import { UserOutlined, SafetyOutlined, LockOutlined, HomeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { getMe } from '../../api/user';

const { Text } = Typography;

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [passwordForm] = Form.useForm();

  const { data: userInfo, isLoading, refetch } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => getMe() as any,
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (values: any) => {
      // TODO: 调用后端修改密码接口
      return Promise.resolve();
    },
    onSuccess: () => {
      message.success(t('profile.passwordUpdateSuccess'));
      passwordForm.resetFields();
    },
    onError: (err: any) => {
      message.error(err?.message || t('profile.passwordUpdateFailed'));
    },
  });

  const tabItems = [
    {
      key: 'basic',
      label: (
        <span>
          <UserOutlined />
          {t('profile.basicInfo')}
        </span>
      ),
      children: (
        <Card className="mt-4">
          <div className="flex items-start gap-6">
            <Avatar size={80} icon={<UserOutlined />} className="bg-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('profile.username')}>
                  <Space>
                    <Text strong>{userInfo?.username}</Text>
                    {userInfo?.is_superuser && <Tag color="red">Admin</Tag>}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.roles')}>
                  {userInfo?.roles?.length > 0
                    ? userInfo.roles.map((role: string) => <Tag key={role}>{role}</Tag>)
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.permissions')}>
                  <Text type="secondary">{userInfo?.permissions?.length || 0} {t('profile.permissionsCount')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.lastLogin')}>
                  <Text type="secondary">-</Text>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Card>
      ),
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyOutlined />
          {t('profile.securitySettings')}
        </span>
      ),
      children: (
        <Card className="mt-4 max-w-lg">
          <Divider orientation="left">{t('profile.changePassword')}</Divider>
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={(values) => updatePasswordMutation.mutate(values)}
          >
            <Form.Item
              label={t('profile.currentPassword')}
              name="old_password"
              rules={[{ required: true, message: t('profile.currentPasswordRequired') }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('profile.currentPassword')} />
            </Form.Item>
            <Form.Item
              label={t('profile.newPassword')}
              name="new_password"
              rules={[
                { required: true, message: t('profile.newPasswordRequired') },
                { min: 6, message: t('profile.passwordMinLength') },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('profile.newPassword')} />
            </Form.Item>
            <Form.Item
              label={t('profile.confirmPassword')}
              name="confirm_password"
              dependencies={['new_password']}
              rules={[
                { required: true, message: t('profile.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('profile.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('profile.confirmPassword')} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={updatePasswordMutation.isPending}>
                {t('profile.updatePassword')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card
        title={
          <Space>
            <HomeOutlined />
            {t('profile.title')}
          </Space>
        }
      >
        <Tabs defaultActiveKey="basic" items={tabItems} />
      </Card>
    </div>
  );
};

export default Profile;