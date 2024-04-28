import { LiveRecording } from 'ari-client';
import { dataSource } from '../data-source';
import { CallRecording } from '../entities/CallRecording';
import { AriData } from '../types/AriData';
import { logger } from '../misc/Logger';
import { config } from '../config/config';
import { WavService } from './WavService';
import { CallRecordingOptions } from '../types/CallRecordingOptions';

export class CallRecordingService {
  static async recordingFinishedEventHandler(ariData: AriData, recordingOptions: CallRecordingOptions): Promise<void> {
    const { channel, liveRecording } = ariData;
    logger.debug(`Recording finished on channel ${channel.id}`);

    if (!liveRecording) {
      logger.error(`No live recording found for channel ${channel.id}`);
      return;
    }

    const recording = await liveRecording.copyStored({
      destinationRecordingName: `${config.callRecording.directory}/${recordingOptions.name}`
    });
    const recordingFilePath = `${config.callRecording.baseDirectory}/${recording.name}.${recordingOptions.format}`;
    const duration = await WavService.getWavFileDuration(recordingFilePath);

    await this.addCallRecordingToDb({
      callerid_name: channel.caller.name,
      callerid_num: channel.caller.number,
      duration,
      path_to_file: recordingFilePath,
      court_id: 0,
      rdnis: ''
    });
  }

  static async createRecordingChannel(ariData: AriData): Promise<LiveRecording> {
    const { client, channel, appName } = ariData;
    logger.debug(`Starting call recording on channel ${channel.id}`);

    const recordingOptions: CallRecordingOptions = {
      channelId: channel.id,
      name: `${channel.caller.number}-${Date.now()}.wav`,
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

    const liveRecording = await snoopChannel.record(recordingOptions, client.LiveRecording());
    const ariDataWithLiveRecording = { ...ariData, liveRecording };

    liveRecording.once('RecordingFinished', async () => {
      await CallRecordingService.recordingFinishedEventHandler(ariDataWithLiveRecording, recordingOptions);
    });

    return liveRecording;
  }

  static async addCallRecordingToDb(callRecording: CallRecording): Promise<CallRecording | null> {
    logger.debug(`Adding call recording to database: ${callRecording.path_to_file}`);
    return await dataSource.getRepository(CallRecording).save(callRecording);
  }
}
