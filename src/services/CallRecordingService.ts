import { LiveRecording } from 'ari-client';
import { dataSource } from '../data-source';
import { CallRecording } from '../entities/CallRecording';
import { AriData } from '../types/AriData';
import { logger } from '../misc/Logger';

export class CallRecordingService {
  static async createRecordingChannel(ariData: AriData): Promise<LiveRecording> {
    const { client, channel, appName } = ariData;
    const recordingOptions = {
      channelId: channel.id,
      name: `${Date.now()}`, // TODO: add a unique identifier (for example, phone number)
      format: 'wav',
      maxDurationSeconds: 0,
      maxSilenceSeconds: 0,
      ifExists: 'overwrite'
    };

    const snoopChannel = await client.channels.snoopChannelWithId({
      channelId: channel.id,
      snoopId: `${channel.id}-snoop`,
      app: appName,
      spy: 'both'
    });

    const liveRecording = client.LiveRecording();
    await snoopChannel.record(recordingOptions, liveRecording);
    logger.debug(`Recording started on channel ${channel.id}`);

    return liveRecording;
  }

  static async addCallRecordingToDb(callRecording: CallRecording): Promise<CallRecording | null> {
    return await dataSource.getRepository(CallRecording).save(callRecording);
  }
}
