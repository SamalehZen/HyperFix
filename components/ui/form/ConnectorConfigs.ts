import { ConnectorProvider, ConnectorConfig } from './types';

export const CONNECTOR_CONFIGS: Record<ConnectorProvider, ConnectorConfig> = {
  google_drive: {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Connectez votre Drive pour indexer des documents',
    icon: 'google-drive',
    color: '#4285F4',
    enabled: false,
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    description: 'Connectez Notion pour rechercher pages et bases',
    icon: 'notion',
    color: '#000000',
    enabled: false,
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Connectez Slack pour retrouver messages et fichiers',
    icon: 'slack',
    color: '#4A154B',
    enabled: false,
  },
  github: {
    id: 'github',
    name: 'GitHub',
    description: 'Connectez GitHub pour rechercher du code',
    icon: 'github',
    color: '#181717',
    enabled: false,
  },
};

export const CONNECTOR_ICONS: Record<ConnectorProvider, string> = {
  google_drive: '📁',
  notion: '📝',
  slack: '💬',
  github: '🐙',
};
