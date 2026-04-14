import { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Typography, Space } from 'antd';
import { ReloadOutlined, BugOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

interface Props {
  children?: ReactNode;
  title?: string;
  subTitle?: string;
  isGlobal?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * [Robustness Engine] 错误边界捕获器
 * 拦截 React 渲染树中的 JavaScript 运行异常，防止出现白屏。
 */
class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级 UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 1. 捕获错误详情
    this.setState({ errorInfo });
    console.error("[AnsFlow Critical Error]:", error, errorInfo);

    // 2. 自动化告警：将崩溃信息一键上报至后端
    try {
        const token = localStorage.getItem('token');
        fetch('/api/v1/system/health/report_error/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                error: error.message,
                stack: error.stack,
                url: window.location.href
            })
        });
    } catch (e) {
        // 告警本身如果也失败了，就不要再触发告警了，保持界面安静
        console.error("Failed to report crash:", e);
    }
  }

  private handleReset = () => {
    // 尝试重置应用状态
    this.setState({ hasError: false, error: null, errorInfo: null });
    // 如果是全局错误，强制刷新
    if (this.props.isGlobal) {
        window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
            className="flex items-center justify-center p-12 min-h-100"
            style={{ height: this.props.isGlobal ? '100vh' : 'auto' }}
        >
          <Result
            status="error"
            title={this.props.title || "应用模块加载异常"}
            subTitle={this.props.subTitle || "系统检测到运行时逻辑冲突或由于底层 API 异常导致的渲染中断。"}
            extra={[
              <Space key="actions" size="large">
                <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={this.handleReset}
                    className="rounded-lg shadow-lg"
                >
                  立即重置并重试
                </Button>
                <Button
                    icon={<BugOutlined />}
                    onClick={() => console.dir(this.state.error)}
                    className="rounded-lg"
                >
                  查看错误控制台
                </Button>
              </Space>
            ]}
          >
            <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-left max-w-150 mt-8">
              <Paragraph>
                 <Text strong type="danger">Error Stack Trace:</Text>
              </Paragraph>
              <Paragraph className="font-mono text-[11px] opacity-70">
                 {this.state.error?.toString()}
              </Paragraph>
              <Text type="secondary" className="text-[10px]">
                 (如果多次重试无效，请清除缓存或联系 AnsFlow 系统管理员)
              </Text>
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
