import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface LogTerminalProps {
  logs?: string; // 初始/历史日志
  incrementalLog?: string; // 实时追加的单行日志
  fontSize?: number;
  autoScroll?: boolean;
}

const LogTerminal: React.FC<LogTerminalProps> = ({
  logs,
  incrementalLog,
  fontSize = 12,
  autoScroll = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. 初始化 XTerm
    const term = new Terminal({
      cursorInactiveStyle: 'none',
      theme: {
        background: '#020617', // slate-950
        foreground: '#cbd5e1', // slate-300
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: fontSize,
      scrollback: 10000,
      disableStdin: true,
      convertEol: true, // 关键：自动转换换行符
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // 2. 写入初始日志
    if (logs) {
      term.write(logs);
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // 监听字体变化
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = fontSize;
      fitAddonRef.current?.fit();
    }
  }, [fontSize]);

  // 监听增量日志
  useEffect(() => {
    if (incrementalLog && xtermRef.current) {
      xtermRef.current.write(incrementalLog);
      if (autoScroll) {
        xtermRef.current.scrollToBottom();
      }
    }
  }, [incrementalLog, autoScroll]);

  // 监听历史日志重载（比如切换节点时）
  useEffect(() => {
      if (logs && xtermRef.current) {
          xtermRef.current.clear();
          xtermRef.current.write(logs);
      }
  }, [logs]);

  return (
    <div 
      ref={terminalRef} 
      className="absolute inset-0 p-2 custom-scrollbar"
    />
  );
};

export default LogTerminal;
