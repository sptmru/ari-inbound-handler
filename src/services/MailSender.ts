import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';

import { logger } from '../misc/Logger';
import Mail from 'nodemailer/lib/mailer';

const config = dotenv.config().parsed;
export class MailSender {
  static createTransport() {
    return nodemailer.createTransport({
      host: config?.SMTP_HOST || 'smtp.example.com',
      port: Number(config?.SMTP_PORT) || 587,
      secure: Boolean(config?.SMTP_SECURE) || false, // upgrade later with STARTTLS
      auth: {
        user: config?.SMTP_USERNAME || 'username',
        pass: config?.SMTP_PASSWORD || 'password'
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });
  }

  static createMailOptions(text: string, attachments?: string[]): Mail.Options {
    return {
      from: config?.MAIL_FROM || '',
      subject: config?.MAIL_SUBJECT || '',
      text,
      attachments: attachments?.map(attachment => ({ filename: attachment }))
    };
  }

  static async sendMail(to: string, text: string, attachments?: string[]): Promise<boolean> {
    const transporter = MailSender.createTransport();
    const mail = MailSender.createMailOptions(text, attachments);
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
