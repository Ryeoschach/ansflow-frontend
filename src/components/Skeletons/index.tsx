import {Skeleton, Space, Layout, theme} from 'antd';
const { Sider, Header, Content, Footer } = Layout;
import React from 'react';

/**
 * 1. 侧边栏菜单骨架
 */
export const MenuSkeleton: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
    return (
        <div className="px-2">
            <div className="flex flex-col gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className={`px-4 py-3 flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3'}`}>
                        <Skeleton.Avatar active size="small" shape="square" className="shrink-0" />
                        {!collapsed && <Skeleton.Button active size="small" className="w-24" />}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * 2. 通用管理页面（表格）骨架
 */
export const TableSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col gap-6">
            {/* 顶部的搜索栏/按钮区域 */}
            <div className="flex justify-between items-center mb-4">
                <Space>
                    <Skeleton.Input active size="medium" style={{ width: 200 }} />
                    <Skeleton.Button active size="medium" style={{ width: 80 }} />
                </Space>
                <Skeleton.Button active size="medium" style={{ width: 100 }} />
            </div>

            {/* 模拟表格数据行 */}
            <Skeleton active paragraph={{ rows: 12 }} />
        </div>
    );
};

/**
 * 3. 详情/日志区域占位
 */
export const LogSkeleton: React.FC = () => {
    return (
        <div style={{ padding: '20px' }}>
            {[1, 2, 3].map((i) => (
                <div key={i} className="mb-6">
                    <Skeleton.Button active size="small" style={{ width: 150, marginBottom: 8 }} />
                    <Skeleton active title={false} paragraph={{ rows: 4 }} />
                </div>
            ))}
        </div>
    );
};



/**
 * 4. 全局框架级别骨架 (用于 App.tsx 首屏初始化)
 */
export const GlobalPageSkeleton: React.FC<{ isDark?: boolean, collapsed?: boolean }> = ({ collapsed }) => {
    const { token } = theme.useToken();
    return (
        <Layout className="min-h-screen">
            {/* 模拟侧边栏 */}
            <Sider
                width={240}
                collapsedWidth={80}
                collapsed={collapsed}
                className="sticky top-0 left-0 h-screen overflow-hidden"
                style={{ 
                    background: token.colorBgContainer, 
                    borderRight: `1px solid ${token.colorBorderSecondary}` 
                }}
            >
                {/* 模拟 Logo 区域 */}
                <div 
                  className="h-16 flex items-center justify-center m-4 rounded-lg"
                  style={{ background: token.colorBgLayout }}
                >
                    <Skeleton.Button active size="small" className={collapsed ? 'w-8' : 'w-20'} />
                </div>

                {/* 模拟菜单列表 */}
                <MenuSkeleton collapsed={collapsed} />
            </Sider>
            <Layout>
                {/* 顶部头部骨架 */}
                <Header
                    className="p-0 flex items-center justify-between sticky top-0 z-10"
                    style={{ 
                        background: token.colorBgContainer, 
                        borderBottom: `1px solid ${token.colorBorderSecondary}` 
                    }}
                >
                    <div className="flex items-center">
                        <div className="ml-2">
                            <Skeleton.Button active className="w-12 h-12" style={{ borderRadius: 0 }} />
                        </div>
                        <div className="ml-2">
                            <Skeleton.Button active className="w-32" size="small" />
                        </div>
                    </div>
                    {/* 右侧 Dropdown 和 主题切换 */}
                    <div className="px-6 flex items-center gap-4">
                        <Skeleton.Button active className="w-24" size="small" />
                        <Space className="px-2" size={8}>
                            <Skeleton.Avatar active size="small" />
                        </Space>
                    </div>
                </Header>
                {/* 内容区域骨架 */}
                <Content 
                    className="m-6 p-6 rounded-xl shadow-sm overflow-hidden min-h-70"
                    style={{ background: token.colorBgContainer }}
                >
                    <TableSkeleton />
                </Content>
                <Footer className="text-center py-6">
                    <Skeleton.Button active className="w-48" size="small" />
                </Footer>
            </Layout>
        </Layout>
    );
};

/**
 * 5. 指标卡片 (Statistic Cards) 骨架
 */
export const StatsSkeleton: React.FC = () => {
    return (
        <div className="py-2">
            <Skeleton active title={false} paragraph={{ rows: 2, width: ['60%', '40%'] }} />
        </div>
    );
};