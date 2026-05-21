import React from 'react';
import Editor from '@monaco-editor/react';
import { theme } from 'antd';

interface K8sYamlEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
}

const K8sYamlEditor: React.FC<K8sYamlEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  height = "100%",
}) => {
  const { token } = theme.useToken();
  const isDark = (token as any).mode === 'dark' || (token as any).colorBgContainer === '#141414';

  return (
    <div className="h-full w-full border border-solid border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <Editor
        height={height}
        defaultLanguage="yaml"
        theme={isDark ? 'vs-dark' : 'light'}
        value={value}
        onChange={onChange}
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          renderWhitespace: 'boundary',
        }}
      />
    </div>
  );
};

export default K8sYamlEditor;
