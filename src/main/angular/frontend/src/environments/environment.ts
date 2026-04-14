export const environment = {
  production: false,
  apiBaseUrl: import.meta.env['NG_APP_API_BASE_URL'],
  zegoAppId: Number(import.meta.env['NG_APP_ZEGO_APP_ID']),
  zegoServerSecret: import.meta.env['NG_APP_ZEGO_SERVER_SECRET']
};
