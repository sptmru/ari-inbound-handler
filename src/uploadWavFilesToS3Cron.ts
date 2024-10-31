import fs from 'fs';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import microtime from 'microtime';


const s3Client = new S3Client({
  region:'us-east-1',
  credentials: {
    accessKeyId: (config.aws.accesskeyId != null) ? config.aws.accesskeyId: '' ,
    secretAccessKey: (config.aws.secretaccesskey != null) ? config.aws.secretaccesskey: '',
  },
});

(async (): Promise<void> => {
  try {
    await dataSource.initialize();
    logger.debug('Data Source initialized');
  } catch (err) {
    logger.error('Error during Data Source initialization', err);
  }
  const voicemailDir = config.voicemail.s3directory;
  const voiceMailsNotUploadedToS3 = await VoicemailService.getVoicemailNotUploadedFilesToS3();
  const inBoundNumbers = await InboundNumberService.getInboundNumbers();
  for ( const voiceMail of voiceMailsNotUploadedToS3) {
    const filePath  = `${voicemailDir}/${voiceMail.origmailbox}/INBOX/${voiceMail.filename}.wav`;
    logger.info(`Uploading file from ${filePath} to S3`);
    const courtId = (inBoundNumbers.filter( a => a.voicemail == voiceMail.origmailbox ))[0]?.court_id;
    if(courtId != null) {
      const isFileExist = await VoicemailService.fileExists(filePath); 
      if(isFileExist) {
        const readableStream = fs.createReadStream(filePath);
        const dateOfUpload = `${new Date(voiceMail.origdate).toJSON().slice(0, 10).split('-').join('')}`;
        const fileNameToSet = microtime.now(voiceMail.origtime)
        const s3filePathKey = `voicemail/${courtId}/${dateOfUpload}/${fileNameToSet}.wav`;
        const fileUrl = `https://${config.aws.s3Bucket}.s3.amazonaws.com/${s3filePathKey}`;
        logger.info(`Uploading file from ${filePath} to S3 ${fileUrl}`);
        const params = {
          Bucket: config.aws.s3Bucket, 
          Key: s3filePathKey, 
          Body: readableStream,
          Region: 'us-east-1',
        };   
        try {
          await s3Client.send(new PutObjectCommand(params));
          await VoicemailService.updateFileNameToS3UrlAndMarkAsUploaded(fileUrl, voiceMail)
          logger.info(`File uploaded to S3: ${fileUrl}`);
        }
        catch (err) {
          logger.error(`Error: upload failed for file ${voiceMail.filename} — error ${err.code}: ${err.message}`);
        }  
      } else {
        logger.error(`File with path ${filePath} not exist`)
      }
    } else {
      logger.error(`Court id not found for ${voiceMail.origmailbox}`)
    }
  }
  process.exit(0);
})().then(() => {}).catch(() => {});
