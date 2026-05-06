import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface K8sStreamingLogsProps {
  clusterId: number;
  namespace: string;
  podName: string;
  container?: string;
  tailLines?: number;
}

const K8sStreamingLogs: React.FC<K8sStreamingLogsProps> = ({
  clusterId,
  namespace,
  podName,
  container,
  tailLines = 100,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      disableStdin: true,
      cursorInactiveStyle: 'none',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host === 'localhost:5173' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}://${host}/ws/k8s/${clusterId}/logs/${namespace}/${podName}/?tail_lines=${tailLines}${container ? `&container=${container}` : ''}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      term.write('\x1b[1;32mFetching logs from AnsFlow Log Service...\x1b[0m\r\n');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'log') {
        // 将 \n 转换为 \r\n 以确保 xterm 正确换行
        term.write(msg.data.replace(/\n/g, '\r\n'));
      } else if (msg.type === 'error') {
        term.write(`\r\n\x1b[1;31mError: ${msg.data}\x1b[0m\r\n`);
      }
    };

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [clusterId, namespace, podName, container, tailLines]);

  return (
    <div 
      ref={terminalRef} 
      className="w-full h-[600px] bg-[#0d1117] rounded-lg overflow-hidden p-2"
    />
  );
};

export default K8sStreamingLogs;
