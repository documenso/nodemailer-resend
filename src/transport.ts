// https://github.com/documenso/documenso/blob/9bdff9a61fee6e84e76fdc1bc2fb92529f6a3b79/packages/email/transports/resend.ts
import { type SentMessageInfo, type Transport } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import { Resend } from 'resend';

import { version as VERSION } from '../package.json';
import { ResendTransportOptions } from './types/transport';

export const RESEND_ERROR_CODES_BY_KEY = {
  missing_required_field: 422,
  invalid_access: 422,
  invalid_parameter: 422,
  invalid_region: 422,
  rate_limit_exceeded: 429,
  missing_api_key: 401,
  invalid_api_Key: 403,
  invalid_from_address: 403,
  validation_error: 403,
  not_found: 404,
  method_not_allowed: 405,
  application_error: 500,
  internal_server_error: 500,
} as const;

/**
 * Transport for sending email via the Resend SDK.
 */
export class ResendTransport implements Transport<SentMessageInfo> {
  public name = 'ResendMailTransport';
  public version = VERSION;

  private _client: Resend;

  public static makeTransport(options: Partial<ResendTransportOptions>) {
    return new ResendTransport(options);
  }

  constructor(options: Partial<ResendTransportOptions>) {
    const { apiKey = '' } = options;

    this._client = new Resend(apiKey);
  }

  public send(mail: MailMessage, callback: (_err: Error | null, _info: SentMessageInfo) => void) {
    if (!mail.data.to || !mail.data.from) {
      return callback(new Error('Missing required fields "to" or "from"'), null);
    }

    this._client.emails
      .send({
        subject: mail.data.subject ?? '',
        from: this.toResendFromAddress(mail.data.from),
        to: this.toResendAddresses(mail.data.to),
        cc: this.toResendAddresses(mail.data.cc),
        bcc: this.toResendAddresses(mail.data.bcc),
        html: mail.data.html?.toString() || '',
        text: mail.data.text?.toString() || '',
        attachments: this.toResendAttachments(mail.data.attachments),
      })
      .then((response) => {
        if (response.error) {
          const statusCode = RESEND_ERROR_CODES_BY_KEY[response.error.name] ?? 500;

          throw new Error(`[${statusCode}]: ${response.error.name} ${response.error.message}`);
        }

        callback(null, response.data);
      })
      .catch((error) => {
        callback(error, null);
      });
  }

  public toResendAddresses(addresses: Mail.Options['to']) {
    if (!addresses) {
      return [];
    }

    if (typeof addresses === 'string') {
      return [addresses];
    }

    if (Array.isArray(addresses)) {
      return addresses.map((address) => {
        if (typeof address === 'string') {
          return address;
        }

        return address.address;
      });
    }

    return [addresses.address];
  }

  public toResendFromAddress(address: Mail.Options['from']) {
    if (!address) {
      return '';
    }

    if (typeof address === 'string') {
      return address;
    }

    return `${address.name} <${address.address}>`;
  }

  public toResendAttachments(attachments: Mail.Options['attachments']) {
    if (!attachments) {
      return [];
    }

    return attachments.map((attachment) => {
      if (!attachment.filename || !attachment.content) {
        throw new Error('Attachment is missing filename or content');
      }

      if (typeof attachment.content === 'string') {
        return {
          filename: attachment.filename,
          content: Buffer.from(attachment.content),
        };
      }

      if (attachment.content instanceof Buffer) {
        return {
          filename: attachment.filename,
          content: attachment.content,
        };
      }

      throw new Error('Attachment content must be a string or a buffer');
    });
  }
}
