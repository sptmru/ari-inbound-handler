import fs from 'fs';
import { logger } from './misc/Logger';
import { dataSource } from './data-source';
import { VoicemailService } from './services/VoicemailService';
import { InboundNumberService } from './services/InboundNumberService';
import { config } from './config/config';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// Create an S3 client
const s3Client = new S3Client({
  credentials: {
    accessKeyId: (config.aws.accesskeyId != null) ? config.aws.accesskeyId: '' ,
    secretAccessKey: (config.aws.secretaccesskey != null) ? config.aws.secretaccesskey: '',
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
  const voicemailDir = config.voicemail.directory;
  const voiceMailsNotUploadedToS3 = await VoicemailService.getVoicemailNotUploadedFilesToS3();
  const inBoundNumbers = await InboundNumberService.getInboundNumbers();
  for ( const voiceMail of voiceMailsNotUploadedToS3) {
    // this block below is added to handle mnt folder files
    let filePath  = `${voicemailDir}/${voiceMail.origmailbox}/INBOX/${voiceMail.filename}.wav`;
    if((voiceMail.filename?.includes('old')) ?? false) {
       filePath  = `${voicemailDir}/${voiceMail.origmailbox}/INBOX/${voiceMail.filename?.replace('old','')}.wav`;
    }
    // this block above is  added to handle mnt folder files
    console.log(`Uploading file from ${filePath} to S3`);
    const court_id = (inBoundNumbers.filter( a => a.voicemail == voiceMail.origmailbox ))[0]?.court_id;
    if(court_id != null) {
      const isFileExist = await VoicemailService.fileExists(filePath); 
      if(isFileExist) {
        const readableStream = fs.createReadStream(filePath);
        const getFileCreatedDate = fs.statSync(filePath);
        const dateOfUpload = `${new Date(getFileCreatedDate.birthtime).toJSON().slice(0, 10).split('-').join('')}`;
        const fileNameToSet = Math.floor(new Date(getFileCreatedDate.birthtime).getTime()/1000);
        const s3filePathKey = `${court_id}/${dateOfUpload}-test/${fileNameToSet}.wav`;
        const fileUrl = `https://${BUCKET}.s3.amazonaws.com/${s3filePathKey}`;
        console.log(`Uploading file from ${filePath} to S3 ${fileUrl}`);
        const params = {
          Bucket: BUCKET, 
          Key: s3filePathKey, 
          Body: readableStream
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
