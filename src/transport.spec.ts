import { Stream } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { ResendTransport } from './transport';

describe('ResendTransport', () => {
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
