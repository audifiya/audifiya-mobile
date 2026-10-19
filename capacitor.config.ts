import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.audifiya.app',
  appName: 'AudiFiya',
  // Static SPA build produced by `npm run electron:prepare` (copies the Vite output to ./app-web)
  webDir: 'app-web',
  plugins: {
    // Sends fetch/XHR through the native HTTP stack, so remote APIs aren't blocked by CORS.
    CapacitorHttp: {
      enabled: true,
    },
    // Capacitor 8: injects --safe-area-inset-* CSS variables on Android (this is the default).
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
