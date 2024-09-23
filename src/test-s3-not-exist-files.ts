
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import axios from 'axios';


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
            const isUrl = filename => {
                try { return Boolean(new URL(filename)); }
                catch(e){ return false; }
            }
            if(isUrl(filename)) {
                await axios.get(filename).catch(function (error) {
                    if(error.status == '404') {
                        console.log(filename);
                    }
                            });
            }
          

  }
  process.exit(0);
})();
