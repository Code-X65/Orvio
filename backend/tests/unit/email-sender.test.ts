import { describe, expect, it, vi } from 'vitest';
import { ConsoleEmailSender } from '../../src/modules/email/console-sender.js';
import { BrevoEmailSender } from '../../src/modules/email/brevo-sender.js';

describe('Email Senders', () => {
  describe('ConsoleEmailSender', () => {
    it('executes send without throwing in test environment', async () => {
      const sender = new ConsoleEmailSender();
      await expect(
        sender.send({
          to: [{ email: 'test@example.com', name: 'Test User' }],
          subject: 'Test Subject',
          htmlContent: '<p>Test</p>',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('BrevoEmailSender', () => {
    it('handles successful API request to Brevo', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: '<abc@brevo.com>' }),
      });
      globalThis.fetch = mockFetch;

      const sender = new BrevoEmailSender('test-api-key', 'support@orvio.com', 'Orvio');
      await sender.send({
        to: [{ email: 'recipient@example.com', name: 'Recipient' }],
        subject: 'Welcome',
        htmlContent: '<p>Welcome</p>',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'api-key': 'test-api-key',
          }),
        })
      );
    });

    it('throws AppError when Brevo returns non-2xx status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });
      globalThis.fetch = mockFetch;

      const sender = new BrevoEmailSender('invalid-key', 'support@orvio.com', 'Orvio');
      await expect(
        sender.send({
          to: [{ email: 'recipient@example.com' }],
          subject: 'Welcome',
          htmlContent: '<p>Welcome</p>',
        })
      ).rejects.toThrow('Brevo email delivery failed with status 401: Unauthorized');
    });
  });
});
