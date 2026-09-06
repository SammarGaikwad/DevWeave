export type ConnectionStatus = 'not_connected' | 'connecting' | 'connected' | 'error' | 'disconnected';

export interface GitHubIntegrationStatus {
  status: ConnectionStatus;
  connected?: boolean;
  username?: string;
  avatarUrl?: string;
  connectedAt?: string;
  connectedAccount?: {
    username: string;
    avatarUrl?: string;
    connectedAt: string;
    scopes?: string[];
  };
  errorMessage?: string;
}
