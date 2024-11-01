import { exit } from 'process';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import { InboundNumberService } from './services/InboundNumberService';
import { MailService } from './services/MailService';
import { config } from './config/config';


void (async (): Promise<void> => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }

  const voicemailDir = config.voicemail.directory;
  const voicemailFileNames = await VoicemailService.getVoicemailFiles(voicemailDir);

  for (const [dirName, files] of Object.entries(voicemailFileNames)) {
    for (const voicemailInitialFileName of files as string[]) { 
      logger.debug(`Processing voicemail ${voicemailInitialFileName} in ${dirName}`);
      const voicemailFileName = VoicemailService.generateRandomFilename();
      const voicemailData = await VoicemailService.parseVoicemailTextFile(
        `${voicemailDir}/${dirName}/INBOX`,
        voicemailFileName,
        voicemailInitialFileName
      );
      
      await VoicemailService.deleteFile(`${voicemailDir}/${dirName}/INBOX/${voicemailInitialFileName}.txt`);
      await VoicemailService.deleteFile(`${voicemailDir}/${dirName}/INBOX/${voicemailInitialFileName}.WAV`);
      await VoicemailService.deleteFile(`${voicemailDir}/${dirName}/INBOX/${voicemailInitialFileName}.gsm`);

      logger.debug(`Renaming voicemail ${voicemailInitialFileName} to ${voicemailFileName}`);
      await VoicemailService.renameFile(
        `${voicemailDir}/${dirName}/INBOX/${voicemailInitialFileName}.wav`, 
        `${voicemailDir}/${dirName}/INBOX/${voicemailFileName}.wav`
      );

      const voicemail = await VoicemailService.addVoicemail(voicemailData);
      if (!voicemail) {
        logger.error(`Error adding voicemail ${voicemailFileName} (initial name: ${voicemailInitialFileName}) to database`);
        continue;
      }

      const inboundNumberData = await InboundNumberService.getInboundNumberByVoicemail(voicemail.origmailbox);
      logger.debug(`Converting voicemail ${voicemailFileName} to mp3`);
      await VoicemailService.convertWavToMp3(
        `${voicemailDir}/${dirName}/INBOX/${voicemailFileName}.wav`,
        `${voicemailDir}/${dirName}/INBOX/${voicemailFileName}.mp3`
      );

      if (inboundNumberData) {
        logger.debug(`Sending voicemail ${voicemailFileName} to ${inboundNumberData.phone}`);
        const emails = InboundNumberService.getListOfEmails(inboundNumberData);
        for (const email of emails) {
          const emailText = `CallerID: ${voicemail.callerid}\nCalled number: ${inboundNumberData.phone}`;
          const subject = `${inboundNumberData.court_name} New Voicemail From ${voicemail.callerid}`;
          await MailService.sendMail(email, emailText, subject, [
            `${voicemailDir}/${dirName}/INBOX/${voicemailFileName}.wav`,
          ]);
        }
        await VoicemailService.markVoicemailAsSent(voicemail);
        logger.debug(`Voicemail ${voicemailFileName} sent to ${inboundNumberData.phone}`);
        await VoicemailService.deleteFile(`${voicemailDir}/${dirName}/INBOX/${voicemailFileName}.mp3`);
      }
    }
  }
  exit(0);
})();
