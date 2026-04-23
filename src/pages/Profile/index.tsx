import React, { useState, useEffect } from 'react';
import { Card, Tabs, Descriptions, Tag, Space, Button, Form, Input, App, Divider, Avatar, Typography, Upload, message, Switch, Select } from 'antd';
import { UserOutlined, SafetyOutlined, LockOutlined, HomeOutlined, EditOutlined, CameraOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { getMe } from '../../api/user';
import request from '../../utils/requests';

const { Text } = Typography;

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { message: antMessage } = App.useApp();
  const [passwordForm] = Form.useForm();
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const queryClient = useQueryClient();

  const { isDark, setIsDark, language, setLanguage, setAvatar } = useAppStore();
  const { i18n } = useTranslation();

  const { data: userInfo, isLoading, refetch } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => getMe() as any,
  });

  // 监听 getMe 返回，设置头像
  useEffect(() => {
    if (userInfo?.avatar) {
      setAvatarUrl(userInfo.avatar);
      setAvatar(userInfo.avatar);
    }
  }, [userInfo]);

  const updatePasswordMutation = useMutation({
    mutationFn: (values: any) => {
      return request.post('/account/me/password/', values);
    },
    onSuccess: () => {
      antMessage.success(t('profile.passwordUpdateSuccess'));
      passwordForm.resetFields();
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || t('profile.passwordUpdateFailed'));
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return request.patch('/account/me/avatar/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res: any) => {
      setAvatarUrl(res.avatar);
      setAvatar(res.avatar);
      queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      antMessage.success(t('profile.avatarUpdateSuccess'));
    },
    onError: (err: any) => {
      antMessage.error(err?.response?.data?.message || t('profile.avatarUpdateFailed'));
    },
  });

  const handleAvatarChange = (info: any) => {
    if (info.file.status === 'done') {
      return;
    }
    const file = info.file.originFileObj || info.file;
    if (file) {
      uploadAvatarMutation.mutate(file);
    }
  };

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
            <div className="flex flex-col items-center gap-2">
              <Upload
                showUploadList={false}
                beforeUpload={() => false}
                onChange={handleAvatarChange}
                accept="image/*"
              >
                <div className="relative cursor-pointer group">
                  <Avatar size={100} icon={<UserOutlined />} src={avatarUrl || userInfo?.avatar} className="bg-amber-500" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity">
                    <CameraOutlined className="text-white text-xl" />
                  </div>
                </div>
              </Upload>
              <Text type="secondary" className="text-xs">{t('profile.clickToUploadAvatar')}</Text>
            </div>
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
          <Divider>{t('profile.changePassword')}</Divider>
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
    {
      key: 'preferences',
      label: (
        <span>
          <EditOutlined />
          {t('profile.preferences')}
        </span>
      ),
      children: (
        <Card className="mt-4 max-w-lg">
          <Descriptions column={1} size="small" title={t('profile.preferencesTitle')}>
            <Descriptions.Item label={t('profile.darkMode')}>
              <Switch
                checked={isDark}
                checkedChildren="🌙"
                unCheckedChildren="☀️"
                onChange={(checked) => setIsDark(checked)}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('profile.language')}>
              <Select
                value={language}
                onChange={(l) => {
                  i18n.changeLanguage(l);
                  setLanguage(l);
                }}
                style={{ width: 140 }}
                options={[
                  { value: 'zh-CN', label: '中文' },
                  { value: 'en-US', label: 'English' },
                ]}
              />
            </Descriptions.Item>
          </Descriptions>
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