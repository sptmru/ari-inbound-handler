import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';

import { logger } from '../misc/Logger';
import Mail from 'nodemailer/lib/mailer';

const config = dotenv.config().parsed;
export class MailSender {
  static createTransport() {
    return nodemailer.createTransport({
      host: 'smtp.example.com',
      port: 587,
      secure: false, // upgrade later with STARTTLS
      auth: {
        user: 'username',
        pass: 'password'
      }
    });
  }

  static createMailOptions(): Mail.Options {
    return {
      from: config?.MAIL_FROM || '',
      subject: config?.MAIL_SUBJECT || ''
    };
  }

  static async sendMail(to: string) {
    const transporter = MailSender.createTransport();
    const mail = MailSender.createMailOptions();
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
