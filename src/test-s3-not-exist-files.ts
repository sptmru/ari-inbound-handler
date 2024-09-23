
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import https from 'https';

(async () => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }
//   const voicemailDir = config.voicemail.s3directory;
  const voiceMailsNotUploadedToS3 = await VoicemailService.getVoicemailUploadedFilesToS3();
//   const inBoundNumbers = await InboundNumberService.getInboundNumbers();
  for ( const voiceMail of voiceMailsNotUploadedToS3) {

        const filename = (voiceMail.filename != null) ? voiceMail.filename : 'test';
        https.request(filename, { method: 'HEAD' }, (res) => {
            if(res.statusCode != 200) {
               console.log(filename, "file")
            }
          }).on('error', (err) => {
            console.error(err, filename);
          }).end();


  }
  process.exit(0);
})();
