import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

const API_HOST = (extra.apiHost as string) || '149.202.84.78';
const API_PORT = (extra.apiPort as string) || '8164';

export const API_BASE_URL = `http://${API_HOST}:${API_PORT}/api`;
