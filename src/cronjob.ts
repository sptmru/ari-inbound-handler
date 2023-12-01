import * as dotenv from 'dotenv';
import fs from 'fs';

import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import { InboundNumberService } from './services/InboundNumberService';
import { MailService } from './services/MailService';

const config = dotenv.config().parsed;

(async () => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }

  const voicemailDir = config?.VOICEMAIL_DIRECTORY || '';

  const voicemailFileNames = await VoicemailService.getVoicemailFiles(voicemailDir);

  if (voicemailFileNames !== null) {
    for (const [dirName, files] of Object.entries(voicemailFileNames)) {
      for (const voicemailFile of files as string[]) {
        const voicemailAlreadySent = await VoicemailService.fileExists(
          `${voicemailDir}/${dirName}/INBOX/${voicemailFile}.sent`
        );
        if (voicemailAlreadySent) {
          continue;
        }
        const voicemailData = await VoicemailService.parseVoicemailTextFile(
          `${voicemailDir}/${dirName}/INBOX`,
          voicemailFile
        );
        let voicemail = await VoicemailService.getVoicemailByFilename(dirName, voicemailFile);
        if (voicemail === null) {
          await fs.promises.writeFile(`${voicemailDir}/${dirName}/INBOX/${voicemailFile}.sent`, '');
          voicemail = await VoicemailService.addVoicemail(voicemailData);
          if (voicemail === null) continue;
          const inboundNumberData = await InboundNumberService.getInboundNumberByVoicemail(voicemail.origmailbox);
          await VoicemailService.convertWavToMp3(
            `${voicemailDir}/${dirName}/INBOX/${voicemailFile}.wav`,
            `${voicemailDir}/${dirName}/INBOX/${voicemailFile}.mp3`
          );
          if (inboundNumberData) {
            const emails = InboundNumberService.getListOfEmails(inboundNumberData);
            for (const email of emails) {
              const emailText = `CallerID: ${voicemail.callerid}\nCalled number: ${inboundNumberData.phone}`;
              const subject = `${inboundNumberData.court_name} New Voicemail From ${voicemail.callerid}`;
              await MailService.sendMail(email, emailText, subject, [
                `${voicemailDir}/${dirName}/INBOX/${voicemailFile}.wav`
              ]);
            }
          }
        }
      }
    }
  }
  process.exit(0);
})();
