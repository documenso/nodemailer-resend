import { Stream } from 'node:stream';
import type Mail from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import { describe, expect, it, vi } from 'vitest';

import { ResendTransport } from './transport';

const sendViaTransport = async (transport: ResendTransport, mailData: Mail.Options) => {
  const sendSpy = vi.fn().mockResolvedValue({ data: { id: 'fake-id' }, error: null });

  (transport as unknown as { _client: { emails: { send: typeof sendSpy } } })._client = {
    emails: { send: sendSpy },
  };

  await new Promise<void>((resolve, reject) => {
    transport.send({ data: mailData } as unknown as MailMessage, (err) =>
      err ? reject(err) : resolve(),
    );
  });

  return sendSpy.mock.calls[0][0];
};

const BASE_MAIL_DATA: Mail.Options = {
  from: { name: 'Test User', address: 'test@example.com' },
  to: 'recipient@example.com',
  subject: 'Test subject',
  html: '<p>hi</p>',
  text: 'hi',
};

describe('ResendTransport', () => {
  describe('send', () => {
    it('should pass replyTo to the Resend API when set', async () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const payload = await sendViaTransport(transport, {
        ...BASE_MAIL_DATA,
        replyTo: 'reply@example.com',
      });

      expect(payload.replyTo).toEqual(['reply@example.com']);
    });

    it('should pass replyTo address objects to the Resend API when set', async () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const payload = await sendViaTransport(transport, {
        ...BASE_MAIL_DATA,
        replyTo: { name: 'Reply User', address: 'reply@example.com' },
      });

      expect(payload.replyTo).toEqual(['reply@example.com']);
    });

    it('should omit replyTo when it is not set', async () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const payload = await sendViaTransport(transport, BASE_MAIL_DATA);

      expect(payload.replyTo).toBeUndefined();
    });

    it('should pass custom headers to the Resend API when set', async () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const payload = await sendViaTransport(transport, {
        ...BASE_MAIL_DATA,
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Other-Header': 'other-value',
        },
      });

      expect(payload.headers).toEqual({
        'X-Custom-Header': 'custom-value',
        'X-Other-Header': 'other-value',
      });
    });

    it('should omit headers when they are not set', async () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const payload = await sendViaTransport(transport, BASE_MAIL_DATA);

      expect(payload.headers).toBeUndefined();
    });
  });

  describe('toResendHeaders', () => {
    it('should return undefined when headers are not set', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const result = transport.toResendHeaders(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined when headers are empty', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const result = transport.toResendHeaders({});

      expect(result).toBeUndefined();
    });

    it('should pass through string values', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const result = transport.toResendHeaders({ 'X-Test': 'value' });

      expect(result).toEqual({ 'X-Test': 'value' });
    });

    it('should join array values with a comma', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const result = transport.toResendHeaders({ 'X-Test': ['a', 'b'] });

      expect(result).toEqual({ 'X-Test': 'a, b' });
    });

    it('should unwrap prepared header values', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const result = transport.toResendHeaders({ 'X-Test': { prepared: true, value: 'value' } });

      expect(result).toEqual({ 'X-Test': 'value' });
    });

    it('should convert key-value entry arrays and combine duplicate keys', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const result = transport.toResendHeaders([
        { key: 'X-Test', value: 'a' },
        { key: 'X-Test', value: 'b' },
        { key: 'X-Other', value: 'c' },
      ]);

      expect(result).toEqual({ 'X-Test': 'a, b', 'X-Other': 'c' });
    });

    // Plain JS consumers are not bound by the type contract and nodemailer's own
    // MIME builder tolerates non-string values by coercing them, so the transport
    // should match that behaviour rather than dropping or crashing.
    it('should coerce numeric header values from untyped callers to strings', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const headers = { 'X-Test': 123 } as unknown as Mail.Options['headers'];

      const result = transport.toResendHeaders(headers);

      expect(result).toEqual({ 'X-Test': '123' });
    });

    it('should coerce non-string values in key-value entry arrays to strings', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const headers = [{ key: 'X-Test', value: 123 }] as unknown as Mail.Options['headers'];

      const result = transport.toResendHeaders(headers);

      expect(result).toEqual({ 'X-Test': '123' });
    });

    it('should skip nullish header values from untyped callers', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const headers = {
        'X-Null': null,
        'X-Undefined': undefined,
        'X-Kept': 'value',
      } as unknown as Mail.Options['headers'];

      const result = transport.toResendHeaders(headers);

      expect(result).toEqual({ 'X-Kept': 'value' });
    });

    it('should return undefined when all header values are nullish', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const headers = { 'X-Null': null } as unknown as Mail.Options['headers'];

      const result = transport.toResendHeaders(headers);

      expect(result).toBeUndefined();
    });
  });

  describe('toResendAddresses', () => {
    it('should convert undefined to an array', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const addresses = undefined;

      const result = transport.toResendAddresses(addresses);

      expect(result).toEqual([]);
    });

    it('should convert a string to an array', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const addresses = 'test@example.com';

      const result = transport.toResendAddresses(addresses);

      expect(result).toEqual([addresses]);
    });

    it('should convert a address to an array', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const addresses = { name: 'test', address: 'test@example.com' };

      const result = transport.toResendAddresses(addresses);

      expect(result).toEqual([addresses.address]);
    });

    it('should return an array as is', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const addresses = ['test@example.com', 'test2@example.com'];

      const result = transport.toResendAddresses(addresses);

      expect(result).toEqual(addresses);
    });

    it('should extract addresses from an array of objects', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const addresses = [
        { name: 'test', address: 'test@example.com' },
        { name: 'test2', address: 'test2@example.com' },
      ];

      const result = transport.toResendAddresses(addresses);

      expect(result).toEqual(['test@example.com', 'test2@example.com']);
    });
  });

  describe('toResendFromAddress', () => {
    it('should return an empty string if no address is provided', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const address = undefined;

      const result = transport.toResendFromAddress(address);

      expect(result).toEqual('');
    });

    it('should return a string as is', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const address = 'test@example.com';

      const result = transport.toResendFromAddress(address);

      expect(result).toEqual(address);
    });

    it('should format an object as "name <address>"', () => {
      const transport = new ResendTransport({ apiKey: 'test-api-key' });

      const address = { name: 'Test User', address: 'test@example.com' };

      const result = transport.toResendFromAddress(address);

      expect(result).toEqual('Test User <test@example.com>');
    });

    describe('toResendAttachments', () => {
      it('should return an empty array if no attachments are provided', () => {
        const transport = new ResendTransport({ apiKey: 'test-api-key' });

        const attachments = undefined;

        const result = transport.toResendAttachments(attachments);

        expect(result).toEqual([]);
      });

      it('should format an array of string attachments', () => {
        const transport = new ResendTransport({ apiKey: 'test-api-key' });

        const attachments = [
          {
            filename: 'test.txt',
            content: 'Test content',
          },
          {
            filename: 'test2.txt',
            content: 'Test content 2',
          },
        ];

        const result = transport.toResendAttachments(attachments);

        expect(result).toEqual([
          {
            filename: 'test.txt',
            content: Buffer.from('Test content'),
          },
          {
            filename: 'test2.txt',
            content: Buffer.from('Test content 2'),
          },
        ]);
      });

      it('should format an array of buffer attachments', () => {
        const transport = new ResendTransport({ apiKey: 'test-api-key' });

        const attachments = [
          {
            filename: 'test.txt',
            content: Buffer.from('Test content'),
          },
          {
            filename: 'test2.txt',
            content: Buffer.from('Test content 2'),
          },
        ];

        const result = transport.toResendAttachments(attachments);

        expect(result).toEqual([
          {
            filename: 'test.txt',
            content: Buffer.from('Test content'),
          },
          {
            filename: 'test2.txt',
            content: Buffer.from('Test content 2'),
          },
        ]);
      });

      it('should throw an error if an attachment is missing a filename', () => {
        const transport = new ResendTransport({ apiKey: 'test-api-key' });

        const attachments = [
          {
            content: Buffer.from('Test content'),
          },
        ];

        expect(() => transport.toResendAttachments(attachments)).toThrowError(
          'Attachment is missing filename or content',
        );
      });

      it('should throw an error if an attachment is missing contents', () => {
        const transport = new ResendTransport({ apiKey: 'test-api-key' });

        const attachments = [
          {
            filename: 'test1.txt',
          },
        ];

        expect(() => transport.toResendAttachments(attachments)).toThrowError(
          'Attachment is missing filename or content',
        );
      });

      it('should throw an error if an attachment uses a stream for contents', () => {
        const transport = new ResendTransport({ apiKey: 'test-api-key' });

        const attachments = [
          {
            filename: 'test1.txt',
            content: Stream.Readable.from('Test content'),
          },
        ];

        expect(() => transport.toResendAttachments(attachments)).toThrowError(
          'Attachment content must be a string or a buffer',
        );
      });
    });
  });
});
