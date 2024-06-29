import nodemailer from 'nodemailer';

import { logger } from '../misc/Logger';
import Mail from 'nodemailer/lib/mailer';
import { config } from '../config/config';

export class MailService {
  static createTransport(): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.username,
        pass: config.smtp.password,
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });
  }

  static createMailOptions(text: string, subject: string, attachments?: string[]): Mail.Options {
    return {
      from: config.smtp.mailFrom,
      subject,
      text,
      attachments: attachments?.map(attachment => ({ path: attachment })),
    };
  }

  static async sendMail(to: string, text: string, subject: string, attachments?: string[]): Promise<boolean> {
    const transporter = MailService.createTransport();
    const mail = MailService.createMailOptions(text, subject, attachments);
    mail.to = to;

    try {
      const result = await transporter.sendMail(mail);
      logger.debug(`Mail to ${to} was sent, server responded with ${result.response}`);

      return true;
    } catch (error) {
      logger.error(`Got error ${error} when trying to send email to ${to}`);

      return false;
    }
  }
}
