import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import useAppStore from '../../../store/useAppStore';
import { buildWebSocketUrl } from '../../../utils/websocket';

interface K8sTerminalProps {
  clusterId: number;
  namespace: string;
  podName: string;
  container?: string;
  onClose?: () => void;
}

const K8sTerminal: React.FC<K8sTerminalProps> = ({
  clusterId,
  namespace,
  podName,
  container,
  onClose,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { token, currentProject } = useAppStore();

  useEffect(() => {
    if (!terminalRef.current || !token) return;

    // 1. 初始化 XTerm
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // 2. 建立 WebSocket
    const host = window.location.host === 'localhost:5173' ? 'localhost:8000' : window.location.host;
    const wsUrl = buildWebSocketUrl(
      `/ws/k8s/${clusterId}/terminal/${namespace}/${podName}/`,
      {
        token,
        project_id: currentProject?.id,
        container,
      },
      host,
    );
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      term.write('\x1b[1;32mConnected to AnsFlow Terminal Service...\x1b[0m\r\n');
      // 发送初始 resize
      const dims = { cols: term.cols, rows: term.rows };
      ws.send(JSON.stringify({ type: 'resize', ...dims }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'terminal') {
        term.write(msg.data);
      } else if (msg.type === 'error') {
        term.write(`\r\n\x1b[1;31mError: ${msg.data}\x1b[0m\r\n`);
      }
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[1;31mConnection closed.\x1b[0m\r\n');
      if (onClose) onClose();
    };

    // 3. 终端输入监听
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal', data }));
      }
    });

    // 4. 窗口大小监听
    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        }));
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [clusterId, namespace, podName, container, token, currentProject?.id]);

  return (
    <div 
      ref={terminalRef} 
      className="w-full h-[500px] bg-[#1e1e1e] rounded-lg overflow-hidden p-2 shadow-inner"
    />
  );
};

export default K8sTerminal;
