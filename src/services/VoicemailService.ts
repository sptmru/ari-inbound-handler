import fs from 'fs';
import readline from 'readline';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

import { dataSource } from '../data-source';
import { Voicemail } from '../entities/Voicemail';
import { logger } from '../misc/Logger';

async function isDirectory(path: string): Promise<boolean> {
  // fs.stat or fs.lstat are pretty much the same in this case. fs.lstat does not follow symlinks.
  const stats = await fs.promises.lstat(path);
  return stats.isDirectory();
}

async function isFile(path: string): Promise<boolean> {
  const stats = await fs.promises.lstat(path);
  return stats.isFile();
}

export class VoicemailService {
  static async getVoicemailFiles(voicemailDir: string): Promise<{ [directory: string]: string[] } | {}> {
    try {
      const result: { [directory: string]: string[] } = {};
      const baseDir = path.resolve(voicemailDir);
      const folders = await fs.promises.readdir(baseDir);

      for (const folder of folders) {
        const inboxPath = path.join(baseDir, folder, 'INBOX');
        if (fs.existsSync(inboxPath) && (await isDirectory(inboxPath))) {
          const files = await fs.promises.readdir(inboxPath);
          const fileNames = (
            await Promise.all(
              files.map(async file => {
                const filePath = path.join(inboxPath, file);
                if (path.extname(file) === '.txt' && (await isFile(filePath))) return file;
                return null;
              })
            )
          ).filter(Boolean) as string[];
          result[folder] = fileNames.map(file => path.parse(file).name);
        }
      }
      return result;
    } catch (err) {
      logger.error(`Error reading voicemail directory ${voicemailDir}`, err);
      return {};
    }
  }
  static async parseVoicemailTextFile(voicemailDir: string, voicemailFilename: string): Promise<Voicemail> {
    const voicemail = { filename: voicemailFilename };
    const filePath = `${voicemailDir}/${voicemailFilename}.txt`;

    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const splitLine = line.split('=');
      if (splitLine[0]) {
        voicemail[splitLine[0]] = splitLine[1];
      }
    }

    return voicemail as Voicemail;
  }

  static async getVoicemailByFilename(mailbox: string, filename: string): Promise<Voicemail | null> {
    return await dataSource.getRepository(Voicemail).findOne({ where: { filename, origmailbox: mailbox } });
  }

  static async markVoicemailAsSent(voicemail: Voicemail): Promise<void> {
    voicemail.sent = true;
    await dataSource.getRepository(Voicemail).save(voicemail);
  }

  static async addVoicemail(voicemail: Voicemail): Promise<Voicemail | null> {
    try {
      await dataSource.getRepository(Voicemail).save(voicemail);
      return voicemail;
    } catch (err) {
      logger.error(`Error saving voicemail ${voicemail.filename}`, err);
      return null;
    }
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true; // File exists
    } catch (err) {
      return false; // File does not exist
    }
  }
  static convertWavToMp3(wavFilePath: string, mp3FilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(wavFilePath)
        .output(mp3FilePath)
        .on('end', () => {
          console.log('Conversion ended');
          resolve();
        })
        .on('error', (err: any) => {
          console.log('Error occurred: ' + err.message);
          reject();
        })
        .run();
    });
  }
}
