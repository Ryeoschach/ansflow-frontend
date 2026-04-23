/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GITHUB_CLIENT_ID: string;
    readonly VITE_GITHUB_REDIRECT_URI: string;
    readonly VITE_WECHAT_APPID: string;
    readonly VITE_WECHAT_REDIRECT_URI: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
