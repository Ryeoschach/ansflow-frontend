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

  const { isDark, setIsDark, themeKey, setThemeKey, designTokens, setDesignTokens, language, setLanguage, setAvatar } = useAppStore();
  const { i18n } = useTranslation();

  const themeOptions = [
    { key: 'forest', name: t('profile.themeName.forest'), colors: ['#606C38', '#283618', '#FDFCF0'] },
    { key: 'deepsea', name: t('profile.themeName.deepsea'), colors: ['#1B4965', '#0D1B2A', '#F8F9FA'] },
    { key: 'teal', name: t('profile.themeName.teal'), colors: ['#599A8F', '#334752', '#FDFBF7'] },
    { key: 'nordic', name: t('profile.themeName.nordic'), colors: ['#D65454', '#263651', '#F9FBFC'] },
    { key: 'pastel', name: t('profile.themeName.pastel'), colors: ['#9E868D', '#5C4F51', '#F8F9F9'] },
    { key: 'cyberpunk', name: t('profile.themeName.cyberpunk'), colors: ['#D4AF37', '#050505', '#141414'] },
    { key: 'custom', name: '自定义', colors: [designTokens.colors.primary, designTokens.colors.textPrimary, designTokens.colors.bgLayout] },
  ];

  const { data: userInfo, isLoading, refetch } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => getMe() as any,
  });

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

  const updateTokenColor = (key: keyof typeof designTokens.colors, val: string) => {
    setDesignTokens({
      colors: {
        ...designTokens.colors,
        [key]: val
      }
    });
  };

  const ColorPickerRow = ({ label, tokenKey, value }: { label: string, tokenKey: keyof typeof designTokens.colors, value: string }) => (
    <div className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors group">
      <div className="flex flex-col">
        <Text className="text-xs font-medium">{label}</Text>
        <Text className="text-[10px] opacity-40 font-mono uppercase">{tokenKey}</Text>
      </div>
      <ColorPicker value={value} onChange={(val) => updateTokenColor(tokenKey, val.toHexString())} showText />
    </div>
  );

  const tabItems = [
    {
      key: 'basic',
      label: (<span><UserOutlined />{t('profile.basicInfo')}</span>),
      children: (
        <Card className="mt-4 ans-card">
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center gap-2">
              <Upload showUploadList={false} beforeUpload={() => false} onChange={handleAvatarChange} accept="image/*">
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
                  <Space><Text strong>{userInfo?.username}</Text>{userInfo?.is_superuser && <Tag color="red">Admin</Tag>}</Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.roles')}>
                  {userInfo?.roles?.length > 0 ? userInfo.roles.map((role: string) => <Tag key={role}>{role}</Tag>) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.permissions')}>
                  <Text type="secondary">{userInfo?.permissions?.length || 0} {t('profile.permissionsCount')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.lastLogin')}><Text type="secondary">-</Text></Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Card>
      ),
    },
    {
      key: 'security',
      label: (<span><SafetyOutlined />{t('profile.securitySettings')}</span>),
      children: (
        <Card className="mt-4 max-w-lg ans-card">
          <Divider>{t('profile.changePassword')}</Divider>
          <Form form={passwordForm} layout="vertical" onFinish={(values) => updatePasswordMutation.mutate(values)}>
            <Form.Item label={t('profile.currentPassword')} name="old_password" rules={[{ required: true, message: t('profile.currentPasswordRequired') }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('profile.currentPassword')} />
            </Form.Item>
            <Form.Item label={t('profile.newPassword')} name="new_password" rules={[{ required: true, message: t('profile.newPasswordRequired') }, { min: 6, message: t('profile.passwordMinLength') }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('profile.newPassword')} />
            </Form.Item>
            <Form.Item label={t('profile.confirmPassword')} name="confirm_password" dependencies={['new_password']} rules={[{ required: true, message: t('profile.confirmPasswordRequired') }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('new_password') === value) { return Promise.resolve(); } return Promise.reject(new Error(t('profile.passwordMismatch'))); }, }), ]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('profile.confirmPassword')} />
            </Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={updatePasswordMutation.isPending}>{t('profile.updatePassword')}</Button></Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'preferences',
      label: (<span><EditOutlined />{t('profile.preferences')}</span>),
      children: (
        <Card className="mt-4 max-w-lg ans-card">
          <Descriptions column={1} size="small" title={t('profile.preferencesTitle')}>
            <Descriptions.Item label={t('profile.darkMode')}>
              <Switch checked={isDark} checkedChildren="🌙" unCheckedChildren="☀️" onChange={(checked) => setIsDark(checked)} />
            </Descriptions.Item>
            <Descriptions.Item label={t('profile.language')}>
              <Select value={language} onChange={(l) => { i18n.changeLanguage(l); setLanguage(l); }} style={{ width: 140 }} options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]} />
            </Descriptions.Item>
          </Descriptions>

          <Divider titlePlacement="start">{t('profile.themeColor') || '配色方案'}</Divider>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {themeOptions.map((opt) => (
              <div
                key={opt.key}
                onClick={() => setThemeKey(opt.key as any)}
                className={`cursor-pointer group relative p-3 rounded-2xl border-2 transition-all duration-300 ${
                  themeKey === opt.key ? 'border-primary bg-primary/5 shadow-md scale-105' : 'border-transparent hover:border-gray-200 bg-gray-50/50 dark:bg-slate-800/20'
                }`}
              >
                <div className="flex gap-1.5 mb-2 h-6 items-center">
                   {opt.key === 'custom' ? (
                     <div className="w-full h-full flex items-center justify-center bg-white rounded-md shadow-inner border border-dashed border-gray-300">
                        <BgColorsOutlined className="text-primary text-lg" />
                     </div>
                   ) : (
                     opt.colors.map((c, i) => (<div key={i} className="w-full h-full rounded-md shadow-inner" style={{ backgroundColor: c }} />))
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
            <div className="mt-6 p-6 rounded-2xl bg-ans-bg-layout/50 border border-ans-border animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 mb-6">
                <BgColorsOutlined className="text-primary text-xl" />
                <Text strong className="text-lg">全量 Token 深度编辑器</Text>
              </div>
              
              <Tabs 
                size="small"
                className="custom-tabs-compact"
                items={[
                  {
                    key: 'light',
                    label: '浅色模式',
                    children: (
                      <div className="grid grid-cols-1 gap-1 pt-2">
                        <ColorPickerRow label="品牌主色" tokenKey="primary" value={designTokens.colors.primary} />
                        <ColorPickerRow label="布局背景" tokenKey="bgLayout" value={designTokens.colors.bgLayout} />
                        <ColorPickerRow label="容器背景" tokenKey="bgContainer" value={designTokens.colors.bgContainer} />
                        <ColorPickerRow label="正文文字" tokenKey="textPrimary" value={designTokens.colors.textPrimary} />
                        <ColorPickerRow label="次级文字" tokenKey="textSecondary" value={designTokens.colors.textSecondary} />
                        <ColorPickerRow label="全局边框" tokenKey="border" value={designTokens.colors.border} />
                        <Divider className="my-2" />
                        <ColorPickerRow label="成功状态" tokenKey="statusSuccess" value={designTokens.colors.statusSuccess} />
                        <ColorPickerRow label="警告状态" tokenKey="statusWarning" value={designTokens.colors.statusWarning} />
                        <ColorPickerRow label="错误状态" tokenKey="statusError" value={designTokens.colors.statusError} />
                      </div>
                    )
                  },
                  {
                    key: 'dark',
                    label: '深色模式',
                    children: (
                      <div className="grid grid-cols-1 gap-1 pt-2">
                        <ColorPickerRow label="深色主色" tokenKey="darkPrimary" value={designTokens.colors.darkPrimary} />
                        <ColorPickerRow label="深色布局背景" tokenKey="darkBgLayout" value={designTokens.colors.darkBgLayout} />
                        <ColorPickerRow label="深色容器背景" tokenKey="darkBgContainer" value={designTokens.colors.darkBgContainer} />
                        <ColorPickerRow label="深色标题文字" tokenKey="darkTextPrimary" value={designTokens.colors.darkTextPrimary} />
                        <ColorPickerRow label="深色次级文字" tokenKey="darkTextSecondary" value={designTokens.colors.darkTextSecondary} />
                        <ColorPickerRow label="深色边框" tokenKey="darkBorder" value={designTokens.colors.darkBorder} />
                        <Divider className="my-2" />
                        <ColorPickerRow label="深色成功色" tokenKey="darkStatusSuccess" value={designTokens.colors.darkStatusSuccess} />
                        <ColorPickerRow label="深色警告色" tokenKey="darkStatusWarning" value={designTokens.colors.darkStatusWarning} />
                        <ColorPickerRow label="深色错误色" tokenKey="darkStatusError" value={designTokens.colors.darkStatusError} />
                      </div>
                    )
                  }
                ]}
              />
              <div className="mt-6 flex justify-end">
                 <Button 
                   size="small" 
                   onClick={() => setDesignTokens({
                     colors: {
                       primary: '#606C38', bgLayout: '#FDFCF0', bgContainer: '#FFFFFF', textPrimary: '#283618', textSecondary: 'rgba(40,54,24,0.65)', border: 'rgba(0,0,0,0.06)', statusSuccess: '#52c41a', statusWarning: '#faad14', statusError: '#ff4d4f',
                       darkPrimary: '#ADC178', darkBgLayout: '#0E140A', darkBgContainer: '#1D2619', darkTextPrimary: '#F0F5E1', darkTextSecondary: 'rgba(240,245,225,0.45)', darkBorder: 'rgba(255,255,255,0.08)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#ffc53d', darkStatusError: '#ff7875'
                     }
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
    <div className="p-4 bg-ans-bg-layout min-h-full">
      <Card className="ans-card" title={<Space><HomeOutlined style={{ color: 'var(--ans-primary)' }} /><span className="text-ans-text-primary font-bold">{t('profile.title')}</span></Space>}>
        <Tabs defaultActiveKey="basic" items={tabItems} className="custom-tabs-modern" />
      </Card>
    </div>
  );
};

export default Profile;