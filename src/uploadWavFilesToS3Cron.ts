import fs from 'fs';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import microtime from 'microtime';



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
  const voicemailDir = config.voicemail.s3directory;
  const voiceMailsNotUploadedToS3 = await VoicemailService.getVoicemailNotUploadedFilesToS3();
  console.log(voiceMailsNotUploadedToS3, "voiceMailsNotUploadedToS3")
  const inBoundNumbers = await InboundNumberService.getInboundNumbers();
  for ( const voiceMail of voiceMailsNotUploadedToS3) {
    const filePath  = `${voicemailDir}/${voiceMail.origmailbox}/INBOX/${voiceMail.filename}.wav`;
    console.log(`Uploading file from ${filePath} to S3`);
    const court_id = (inBoundNumbers.filter( a => a.voicemail == voiceMail.origmailbox ))[0]?.court_id;
    if(court_id != null) {
      const isFileExist = await VoicemailService.fileExists(filePath); 
      if(isFileExist) {
        const readableStream = fs.createReadStream(filePath);
        const dateOfUpload = `${new Date(voiceMail.origdate).toJSON().slice(0, 10).split('-').join('')}`;
        const fileNameToSet = microtime.now(voiceMail.origtime)
        const s3filePathKey = `voicemail/${court_id}/${dateOfUpload}/${fileNameToSet}.wav`;
        const fileUrl = `https://${BUCKET}.s3.amazonaws.com/${s3filePathKey}`;
        console.log(`Uploading file from ${filePath} to S3 ${fileUrl}`);
        const params = {
          Bucket: BUCKET, 
          Key: s3filePathKey, 
          Body: readableStream,
          Region: 'us-east-1'
        };   
        try {
          s3Client.send(new PutObjectCommand(params));
          await VoicemailService.updateFileNameToS3UrlAndMarkAsUploaded(fileUrl, voiceMail)
          console.log("file is uploaded", fileUrl );
        }
        catch (err) {
          console.log(`Error: Upload Failed for file ${voiceMail.filename}`, err.code, err.message);
        }  
      } else {
        console.log(`File with path ${filePath} not exist`)
      }
    } else {
      console.log(`court id not found for ${ voiceMail.origmailbox}`)
    }
  }
  process.exit(0);
})();
