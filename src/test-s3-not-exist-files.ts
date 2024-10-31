
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import type {
    HeadObjectCommandInput,
  } from "@aws-sdk/client-s3";
  import {
      S3Client,
      HeadObjectCommand,
  } from '@aws-sdk/client-s3';
import { config } from './config/config';

  // Create an S3 client
const s3Client = new S3Client({
  region:'us-east-1',
  credentials: {
    accessKeyId: (config.aws.accesskeyId != null) ? config.aws.accesskeyId: '' ,
    secretAccessKey: (config.aws.secretaccesskey != null) ? config.aws.secretaccesskey: '',
  },
});

const BUCKET = 'pts-phone-recordings';

const isUrl = (inputString: string): boolean => {
  try { 
    return Boolean(new URL(inputString)); 
  } catch(e) {
    return false;
  }
}

(async (): Promise<void> => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }

  const voiceMailsNotUploadedToS3 = await VoicemailService.getVoicemailUploadedFilesToS3();
  
  for ( const voiceMail of voiceMailsNotUploadedToS3) {
    const filename = (voiceMail.filename != null) ? voiceMail.filename : 'test';
    
    if(isUrl(filename)) {
      let { pathname } = new URL(filename);
      pathname = pathname.substr(pathname.indexOf('/') + 1);

      try {
        const bucketParams: HeadObjectCommandInput = {
          Bucket: BUCKET,
          Key: pathname,
        };
        const cmd = new HeadObjectCommand(bucketParams);
        await s3Client.send(cmd);
      } catch (error) {
        logger.debug(`Error name: ${error.name}`);
        if (error.name === 'NotFound') {
          logger.error(`File does not exist: ${voiceMail.filename} ${voiceMail.id}`);     
        }
      }
    }
  }
  process.exit(0);
})().then(() => {}).catch(() => {});
