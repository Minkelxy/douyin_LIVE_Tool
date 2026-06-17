export interface Danmu {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  color?: string;
  isReply?: boolean;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface ConnectionState {
  status: ConnectionStatus;
  platform: string;
}
