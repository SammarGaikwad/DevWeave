import { apiClient } from './apiClient';

export interface UserSettings {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface GithubSettings {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
  linkedAt: string | null;
  tokenMasked: string | null;
  clientIdMasked: string;
  callbackUrl: string;
}

export interface JenkinsSettings {
  url: string;
  username: string;
  tokenMasked: string;
  defaultJob: string;
}

export interface DatabaseSettings {
  type: string;
  connectionStringMasked: string;
  pooling: string;
}

export interface EnvironmentSettings {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  jwtExpiresIn: string;
}

export interface PlatformSettingsOverview {
  user: UserSettings;
  integrations: {
    github: GithubSettings;
    jenkins: JenkinsSettings;
    database: DatabaseSettings;
  };
  environment: EnvironmentSettings;
}

export const settingsService = {
  async getOverview(): Promise<PlatformSettingsOverview> {
    const res = await apiClient.get<{ success: boolean; data: PlatformSettingsOverview }>('/v1/settings/overview');
    return res.data;
  },
};
