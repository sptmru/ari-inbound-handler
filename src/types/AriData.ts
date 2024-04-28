import { Channel, Client, Playback, ChannelDtmfReceived, LiveRecording } from 'ari-client';

export type AriData = {
  dtmfReceiveEvent?: ChannelDtmfReceived;
  playback?: Playback;
  channel: Channel;
  client: Client;
  appName: string;
  trunkName: string;
  callerId: string;
  liveRecording?: LiveRecording;
};
