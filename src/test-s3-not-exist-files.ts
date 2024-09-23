
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import type {
    HeadObjectCommandInput,
    HeadObjectCommandOutput,
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
      secretAccessKey: (config.aws.secretaccesskey != null) ? config.aws.secretaccesskey: ''
    },
  });

  const BUCKET = 'pts-phone-recordings';

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
                const { pathname } = new URL(filename);
                const [,, key] = pathname.split('/')
                try {
                    const bucketParams: HeadObjectCommandInput = {
                      Bucket: BUCKET,
                      Key: key,
                    };
                    const cmd = new HeadObjectCommand(bucketParams);
                    await s3Client.send(cmd);
                  } catch (error) {
                    if (error.$metadata?.httpStatusCode === 404) {
                      console.log(`file not exist`, voiceMail.filename, voiceMail.id)
                      // doesn't exist and permission policy includes s3:ListBucket
                    } 
                  }
            }
           
          

  }
  process.exit(0);
})();
