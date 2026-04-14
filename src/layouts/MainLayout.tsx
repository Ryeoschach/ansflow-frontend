import React, { Suspense } from 'react';
import { Layout, theme } from 'antd';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Outlet } from 'react-router-dom';
import { Footer } from 'antd/es/layout/layout';
import { TableSkeleton } from '../components/Skeletons';
import AppErrorBoundary from '../components/ErrorBoundary';
const { Content } = Layout;

/**
 * 主页面布局组件
 */
const MainLayout: React.FC<{ isLoading?: boolean }> = ({ isLoading }) => {
    const { token } = theme.useToken();
    return (
        <Layout className="min-h-screen">
            {/* 侧边栏 */}
            <Sidebar />

            <Layout>
                {/* 顶部头部 */}
                <Header />

                {/* 内容区域 */}
                <Content
                    style={{
                        backgroundColor: token.colorBgContainer,
                        minHeight: 'calc(100vh - 200px)' // 锁定高度，防止 Footer 跳动
                    }}
                    className="m-6 p-6 rounded-xl shadow-sm overflow-hidden"
                >
                    {isLoading ? (
                        <TableSkeleton />
                    ) : (
                        /* 只在内容区加载，框架不动 */
                        <AppErrorBoundary
                            title="功能模块加载异常"
                            subTitle="当前模块在渲染时发生了运行时错误，请尝试重新刷新页面或跳转至其他页面。"
                        >
                            <Suspense fallback={<TableSkeleton />}>
                                <Outlet />
                            </Suspense>
                        </AppErrorBoundary>
                    )}
                </Content>
                <Footer style={{ textAlign: 'center' }}>
                    Ansflow ©{new Date().getFullYear()} Created by Creed
                </Footer>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
