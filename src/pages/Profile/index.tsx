import React, { useState, useEffect } from 'react';
import { Card, Tabs, Descriptions, Tag, Space, Button, Form, Input, App, Divider, Avatar, Typography, Upload, Switch, Select, ColorPicker } from 'antd';
import { UserOutlined, SafetyOutlined, LockOutlined, HomeOutlined, EditOutlined, CameraOutlined, BgColorsOutlined } from '@ant-design/icons';
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

  const { isDark, setIsDark, themeKey, setThemeKey, customTheme, setCustomTheme, language, setLanguage, setAvatar } = useAppStore();
  const { i18n } = useTranslation();

  const themeOptions = [
    { key: 'forest', name: t('profile.themeName.forest'), colors: ['#606C38', '#283618', '#FEFAE0'] },
    { key: 'deepsea', name: t('profile.themeName.deepsea'), colors: ['#1B4965', '#0D1B2A', '#E0E1DD'] },
    { key: 'teal', name: t('profile.themeName.teal'), colors: ['#599A8F', '#334752', '#F4F1DE'] },
    { key: 'nordic', name: t('profile.themeName.nordic'), colors: ['#D65454', '#263651', '#F6FBF4'] },
    { key: 'pastel', name: t('profile.themeName.pastel'), colors: ['#9E868D', '#5C4F51', '#DEE9E4'] },
    { key: 'custom', name: '自定义', colors: [customTheme.primary, customTheme.heading || '#1F2937', customTheme.bg] },
  ];

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

          <Divider titlePlacement="start">{t('profile.themeColor') || '配色方案'}</Divider>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {themeOptions.map((opt) => (
              <div
                key={opt.key}
                onClick={() => setThemeKey(opt.key as any)}
                className={`cursor-pointer group relative p-3 rounded-2xl border-2 transition-all duration-300 ${
                  themeKey === opt.key 
                    ? 'border-primary bg-primary/5 shadow-md scale-105' 
                    : 'border-transparent hover:border-gray-200 bg-gray-50/50 dark:bg-slate-800/20'
                }`}
              >
                <div className="flex gap-1.5 mb-2 h-6 items-center">
                   {opt.key === 'custom' ? (
                     <div className="w-full h-full flex items-center justify-center bg-white rounded-md shadow-inner border border-dashed border-gray-300">
                        <BgColorsOutlined className="text-primary text-lg" />
                     </div>
                   ) : (
                     opt.colors.map((c, i) => (
                       <div key={i} className="w-full h-full rounded-md shadow-inner" style={{ backgroundColor: c }} />
                     ))
                   )}
                </div>
                <div className="flex justify-between items-center px-1">
                   <Text className={`text-xs ${themeKey === opt.key ? 'font-bold text-primary' : 'opacity-60'}`}>{opt.name}</Text>
                   {themeKey === opt.key && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                </div>
              </div>
            ))}
          </div>

          {themeKey === 'custom' && (
            <div className="mt-6 p-6 rounded-2xl bg-gray-50 dark:bg-slate-800/30 border border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 mb-6">
                <BgColorsOutlined className="text-primary text-xl" />
                <Text strong className="text-lg">深度自定义调色板</Text>
              </div>
              
              <Tabs 
                size="small"
                items={[
                  {
                    key: 'light',
                    label: '浅色模式',
                    children: (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">品牌主色 (Primary)</Text>
                            <ColorPicker value={customTheme.primary} onChange={(val) => setCustomTheme({ primary: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">页面背景 (Background)</Text>
                            <ColorPicker value={customTheme.bg} onChange={(val) => setCustomTheme({ bg: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">容器背景 (Container)</Text>
                            <ColorPicker value={customTheme.container} onChange={(val) => setCustomTheme({ container: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">标题/导航背景 (Heading)</Text>
                            <ColorPicker value={customTheme.heading} onChange={(val) => setCustomTheme({ heading: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">正文文字 (Text)</Text>
                            <ColorPicker value={customTheme.text} onChange={(val) => setCustomTheme({ text: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">警告色 (Warning)</Text>
                            <ColorPicker value={customTheme.warning} onChange={(val) => setCustomTheme({ warning: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">链接/错误色 (Link)</Text>
                            <ColorPicker value={customTheme.link} onChange={(val) => setCustomTheme({ link: val.toHexString() })} showText />
                          </div>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'dark',
                    label: '深色模式',
                    children: (
                      <div className="space-y-4 pt-2">
                         <div className="grid grid-cols-1 gap-4">
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">深色主色 (Dark Primary)</Text>
                            <ColorPicker value={customTheme.darkPrimary} onChange={(val) => setCustomTheme({ darkPrimary: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">深色背景 (Dark Background)</Text>
                            <ColorPicker value={customTheme.darkBg} onChange={(val) => setCustomTheme({ darkBg: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">深色容器 (Dark Container)</Text>
                            <ColorPicker value={customTheme.darkContainer} onChange={(val) => setCustomTheme({ darkContainer: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">深色标题 (Dark Heading)</Text>
                            <ColorPicker value={customTheme.darkHeading} onChange={(val) => setCustomTheme({ darkHeading: val.toHexString() })} showText />
                          </div>
                          <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Text type="secondary">深色边框 (Dark Border)</Text>
                            <ColorPicker value={customTheme.darkBorder} onChange={(val) => setCustomTheme({ darkBorder: val.toHexString() })} showText />
                          </div>
                        </div>
                      </div>
                    )
                  }
                ]}
              />
              <div className="mt-6 flex justify-end">
                 <Button 
                   size="small" 
                   onClick={() => setCustomTheme({
                     primary: '#606C38', bg: '#FDFCF0', heading: '#283618', text: '#283618', container: '#FFFFFF', warning: '#DDA15E', link: '#BC6C25',
                     darkPrimary: '#ADC178', darkBg: '#0E140A', darkHeading: '#F0F5E1', darkContainer: '#1D2619', darkBorder: '#2D3A26'
                   })}
                 >
                   恢复默认
                 </Button>
              </div>
            </div>
          )}
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