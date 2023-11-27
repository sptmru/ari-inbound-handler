import fs from 'fs';
import readline from 'readline';
import path from 'path';

import { Voicemail } from '../entities/Voicemail';
import { logger } from '../misc/Logger';

export class VoicemailService {
  static async getVoicemailFiles(voicemailDir: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(voicemailDir);
      return files.filter(file => file.endsWith('.txt')).map(file => path.basename(file, '.txt'));
    } catch (err) {
      logger.error(`Error reading voicemail directory ${voicemailDir}`, err);
      return [];
    }
  }
  static async parseVoicemailTextFile(filePath: string): Promise<Voicemail> {
    const voicemail = {};

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
}
