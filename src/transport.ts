// https://github.com/documenso/documenso/blob/9bdff9a61fee6e84e76fdc1bc2fb92529f6a3b79/packages/email/transports/resend.ts
import { type SentMessageInfo, type Transport } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import { Resend } from 'resend';

import { version as VERSION } from '../package.json';
import { ResendTransportOptions } from './types/transport';

/**
 * A single address as this transport sends it: an address string, or an object that has
 * an `address`.
 */
type ResendAddress = string | { name?: string; address: string };

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
    // Failures have always been reported with `null` as the info, which the nodemailer
    // callback type does not allow for.
    const noInfo = null as unknown as SentMessageInfo;

    if (!mail.data.to || !mail.data.from) {
      return callback(new Error('Missing required fields "to" or "from"'), noInfo);
    }

    const replyTo = this.toResendAddresses(mail.data.replyTo);

    this._client.emails
      .send({
        subject: mail.data.subject ?? '',
        from: this.toResendFromAddress(mail.data.from),
        to: this.toResendAddresses(mail.data.to),
        cc: this.toResendAddresses(mail.data.cc),
        bcc: this.toResendAddresses(mail.data.bcc),
        replyTo: replyTo.length > 0 ? replyTo : undefined,
        headers: this.toResendHeaders(mail.data.headers),
        html: mail.data.html?.toString() || '',
        text: mail.data.text?.toString() || '',
        attachments: this.toResendAttachments(mail.data.attachments),
      })
      .then((response) => {
        if (response.error) {
          // The status is missing when the request never reached the Resend API.
          const statusCode = response.error.statusCode ?? 500;

          throw new Error(`[${statusCode}]: ${response.error.name} ${response.error.message}`);
        }

        callback(null, {
          ...response.data,
          // Resend sets the Message-ID header itself, the email id is what identifies the
          // message afterwards.
          messageId: response.data.id,
          envelope: mail.message.getEnvelope(),
        });
      })
      .catch((error) => {
        callback(error, noInfo);
      });
  }

  /**
   * Flattens nodemailer address input into single addresses, in order. The input can be
   * an address string, an address object, an address group or a list of any of these,
   * nested lists included. Entries without an address are skipped.
   */
  private flattenAddresses(addresses: Mail.Options['to']): ResendAddress[] {
    const flattened: ResendAddress[] = [];

    // Walked with a stack instead of recursion so that a deeply nested list can not
    // exhaust the call stack. Every list is walked once, which ends a list that contains
    // itself.
    const pending: Mail.Options['to'][] = [addresses];
    const seen = new WeakSet<object>();

    while (pending.length > 0) {
      const current = pending.pop();

      if (!current) {
        continue;
      }

      if (typeof current === 'string') {
        flattened.push(current);
        continue;
      }

      if (Array.isArray(current)) {
        if (seen.has(current)) {
          continue;
        }

        seen.add(current);

        for (let index = current.length - 1; index >= 0; index--) {
          pending.push(current[index]);
        }

        continue;
      }

      if (current.group) {
        pending.push(current.group);
        continue;
      }

      if (current.address) {
        flattened.push({ name: current.name, address: current.address });
      }
    }

    return flattened;
  }

  public toResendAddresses(addresses: Mail.Options['to']) {
    return this.flattenAddresses(addresses).map((address) =>
      typeof address === 'string' ? address : address.address,
    );
  }

  public toResendFromAddress(address: Mail.Options['from']): string {
    const [from] = this.flattenAddresses(address);

    if (!from) {
      return '';
    }

    if (typeof from === 'string') {
      return from;
    }

    return from.name ? `${from.name} <${from.address}>` : from.address;
  }

  /**
   * Normalizes nodemailer mail headers into the flat `Record<string, string>`
   * shape accepted by the Resend API.
   *
   * Repeated values for the same header key are combined into a single
   * comma-separated value since the API cannot repeat a header key.
   *
   * Values are defensively coerced to strings and nullish values are skipped,
   * mirroring nodemailer's own tolerance for untyped (plain JS) callers.
   *
   * Returns `undefined` when there are no headers so the field is omitted
   * from the API payload entirely.
   */
  public toResendHeaders(headers: Mail.Options['headers']): Record<string, string> | undefined {
    if (!headers) {
      return undefined;
    }

    const normalized: Record<string, string> = {};

    const appendHeader = (key: string, value: unknown) => {
      if (value === null || value === undefined) {
        return;
      }

      const stringValue = String(value);

      normalized[key] = normalized[key] ? `${normalized[key]}, ${stringValue}` : stringValue;
    };

    if (Array.isArray(headers)) {
      for (const { key, value } of headers) {
        appendHeader(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            appendHeader(key, item);
          }

          continue;
        }

        if (typeof value === 'object' && value !== null) {
          appendHeader(key, value.value);
          continue;
        }

        appendHeader(key, value);
      }
    }

    if (Object.keys(normalized).length === 0) {
      return undefined;
    }

    return normalized;
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
