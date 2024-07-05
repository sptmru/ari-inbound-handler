import { Channel } from 'ari-client';
import { AriData } from './AriData';
import { PromptCitationData } from './PromptCitationData';

export type QueueData = {
  queueNumbers: string[];
  queueChannels: Channel[];
  ariData: AriData;
  promptCitationData?: PromptCitationData;
  success?: boolean;
  isPromptCitationQueue: boolean;
};
