import { ThemeColors } from '../theme/types';

export function crowdInfo(load: string) {
  switch (load) {
    case 'SEA':
      return { label: 'Seats available', color: (colors: ThemeColors) => colors.accent };
    case 'SDA':
      return { label: 'Standing available', color: (colors: ThemeColors) => colors.yellow };
    case 'LSD':
      return { label: 'Limited standing', color: (colors: ThemeColors) => colors.red };
    default:
      return { label: 'Crowd unknown', color: (colors: ThemeColors) => colors.tx3 };
  }
}

export function operatorInfo(operator: string) {
  switch (operator) {
    case 'SBST':
      return {
        card: '#F0EAEC',
        badge: '#E2D9E9',
        accent: '#8B7EC8',
        text: '#261C39',
        mutedText: '#5E409D'
      };
    case 'SMRT':
      return {
        card: '#FFFCF0',
        badge: '#FFFFFF',
        accent: '#9F9D96',
        text: '#100F0F',
        mutedText: '#575653'
      };
    case 'TTS':
      return {
        card: '#EDEECF',
        badge: '#DDE2B2',
        accent: '#879A39',
        text: '#252D09',
        mutedText: '#536907'
      };
    case 'GAS':
      return {
        card: '#FFE7CE',
        badge: '#FED3AF',
        accent: '#DA702C',
        text: '#40200D',
        mutedText: '#9D4310'
      };
    default:
      return {
        card: '#DDF1E4',
        badge: '#BFE8D9',
        accent: '#3AA99F',
        text: '#122F2C',
        mutedText: '#1C6C66'
      };
  }
}
