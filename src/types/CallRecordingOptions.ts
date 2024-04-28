export type CallRecordingOptions = {
  channelId: string;
  name: string;
  format: string;
  maxDurationSeconds?: number | undefined;
  maxSilenceSeconds?: number | undefined;
  ifExists?: string | undefined;
  beep?: boolean | undefined;
  terminateOn?: string | undefined;
};
