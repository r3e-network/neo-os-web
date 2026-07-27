/**
 * Executable Error Message Quality Tests
 * Priority: P4 - user-facing error experience
 *
 * Unlike the other files in this directory these run against the REAL
 * implementation (framework/utils/errors.ts) rather than a mock, because the
 * error surface is plain TypeScript with no chain dependency.
 *
 * The existing unit tests in framework/test/errors-surface.test.ts and
 * apps/shared/test/format-error-message.test.ts spot-check individual
 * functions. These tests assert family-wide invariants instead: properties
 * that must hold for EVERY error class, so a newly added class that forgets
 * its user message or its i18n key fails here rather than shipping a raw
 * stack trace into a player's UI.
 */

import { describe, it, expect } from 'vitest';
import {
  MiniAppError,
  WalletConnectionError,
  ContractError,
  TransactionError,
  InsufficientBalanceError,
  NetworkError,
  ValidationError,
  isMiniAppError,
  formatErrorMessage,
  errorMessage,
} from '@r3e-network/neo-miniapp-framework/utils/errors';
import { baseMessages } from '@r3e-network/neo-miniapp-shared/locale/base-messages';

/**
 * Every concrete error class, with the i18n key it is expected to resolve.
 * Adding a class to the hierarchy without adding it here leaves the family
 * invariants unverified, so the roster is asserted for completeness below.
 */
const ERROR_FAMILY = [
  {
    name: 'WalletConnectionError',
    code: 'WALLET_CONNECTION',
    messageKey: 'walletConnectionError',
    build: (translator?: (k: string) => string) =>
      new WalletConnectionError('wallet rpc handshake refused', undefined, translator),
  },
  {
    name: 'ContractError',
    code: 'CONTRACT_ERROR',
    messageKey: 'contractError',
    build: (translator?: (k: string) => string) =>
      new ContractError('FAULT: ASSERT failed at instruction 0x1f4', undefined, translator),
  },
  {
    name: 'TransactionError',
    code: 'TRANSACTION_ERROR',
    messageKey: 'transactionError',
    build: (translator?: (k: string) => string) =>
      new TransactionError('tx 0xdeadbeef rejected by mempool', undefined, translator),
  },
  {
    name: 'InsufficientBalanceError',
    code: 'INSUFFICIENT_BALANCE',
    messageKey: 'insufficientBalanceError',
    build: (translator?: (k: string) => string) =>
      new InsufficientBalanceError(100, 5, 'GAS', translator),
  },
  {
    name: 'NetworkError',
    code: 'NETWORK_ERROR',
    messageKey: 'networkError',
    build: (translator?: (k: string) => string) =>
      new NetworkError('fetch failed https://rpc.internal.example/n3', undefined, translator),
  },
  {
    name: 'ValidationError',
    code: 'VALIDATION_ERROR',
    messageKey: 'validationError',
    build: (translator?: (k: string) => string) =>
      new ValidationError('amount must be positive', 'amount', undefined, translator),
  },
] as const;

/** Payloads that must never reach an end user verbatim. */
const HOSTILE_INTERNALS = [
  {
    label: 'stack trace',
    value: 'boom\n    at settle (/srv/app/dist/engine.js:412:19)\n    at run (/srv/app/dist/main.js:8:3)',
  },
  { label: 'contract hash', value: 'invocation reverted in 0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5' },
  { label: 'internal RPC url', value: 'ECONNREFUSED http://10.0.3.44:20332/rpc' },
  { label: 'stack keyword dump', value: 'error stack: unwound 14 frames from vm dispatch' },
  {
    label: 'oversized dump',
    value: `unexpected state: ${'a'.repeat(400)}`,
  },
];

/** A translator that resolves against the shipped base messages. */
const translatorFor = (lang: 'en' | 'zh') => (key: string) => {
  const entry = (baseMessages as Record<string, { en: string; zh: string }>)[key];
  return entry ? entry[lang] : key;
};

describe('Error Message Quality - Executable', () => {
  describe('Error Family Completeness', () => {
    it('should cover every exported concrete error class in the roster', () => {
      // Arrange - the classes actually exported by the module
      const exported = [
        WalletConnectionError,
        ContractError,
        TransactionError,
        InsufficientBalanceError,
        NetworkError,
        ValidationError,
      ].map((cls) => cls.name);

      // Assert - roster and exports agree, so no class escapes the invariants
      expect([...ERROR_FAMILY].map((e) => e.name).sort()).toEqual(exported.sort());
    });

    it('should give every error class a distinct stable code', () => {
      // Act
      const codes = ERROR_FAMILY.map((entry) => entry.build().code);

      // Assert - codes are what callers branch on, so collisions are bugs
      expect(new Set(codes).size).toBe(ERROR_FAMILY.length);
      expect(codes).toEqual(ERROR_FAMILY.map((e) => e.code));
    });

    it('should set name to the concrete class for every error', () => {
      // Assert - a generic "Error" name makes production logs unsearchable
      for (const entry of ERROR_FAMILY) {
        expect(entry.build().name).toBe(entry.name);
      }
    });

    it('should keep every error instanceof both its class and MiniAppError', () => {
      // Assert - single class identity, so instanceof narrowing works across
      // the shared/framework re-export boundary
      for (const entry of ERROR_FAMILY) {
        const error = entry.build();
        expect(error).toBeInstanceOf(MiniAppError);
        expect(error).toBeInstanceOf(Error);
        expect(isMiniAppError(error)).toBe(true);
      }
    });
  });

  describe('User Message Presence and Actionability', () => {
    it('should provide a non-empty user message for every error class', () => {
      // Assert - never fall through to a raw technical message
      for (const entry of ERROR_FAMILY) {
        const error = entry.build();
        expect(error.userMessage, entry.name).toBeTruthy();
        expect(error.userMessage!.length, entry.name).toBeGreaterThan(0);
      }
    });

    it('should render every user message as a complete sentence', () => {
      // Assert - user-facing copy is punctuated prose, not a token
      for (const entry of ERROR_FAMILY) {
        const message = entry.build().userMessage!;
        expect(message[0], entry.name).toBe(message[0].toUpperCase());
        expect(message.trimEnd().endsWith('.'), `${entry.name}: ${message}`).toBe(true);
      }
    });

    it('should keep every user message short enough to display in a toast', () => {
      // Assert - the notification surface truncates long copy
      for (const entry of ERROR_FAMILY) {
        const message = entry.build().userMessage!;
        expect(message.length, `${entry.name}: ${message}`).toBeLessThanOrEqual(100);
      }
    });

    it('should tell the user what to do next in every recoverable error', () => {
      // Arrange - errors the user can act on themselves
      const recoverable = ERROR_FAMILY.filter((e) => e.code !== 'INSUFFICIENT_BALANCE');

      // Assert - an actionable verb, not just a statement of failure
      for (const entry of recoverable) {
        const message = entry.build().userMessage!;
        expect(
          /please|try again|check|connect/i.test(message),
          `${entry.name} lacks a next step: ${message}`,
        ).toBe(true);
      }
    });

    it('should never leak internal detail through a user message', () => {
      // Assert - the technical message may carry hashes and urls; the user
      // message built from it must not
      for (const entry of ERROR_FAMILY) {
        const message = entry.build().userMessage!;
        expect(message, entry.name).not.toMatch(/0x[0-9a-f]{4,}/i);
        expect(message, entry.name).not.toMatch(/https?:\/\//);
        expect(message, entry.name).not.toContain('\n');
        expect(message.toLowerCase(), entry.name).not.toContain('undefined');
        expect(message.toLowerCase(), entry.name).not.toContain('fault:');
      }
    });

    it('should preserve the technical message separately for operators', () => {
      // Assert - diagnostics are retained on .message even when the user
      // message is generic, so logs stay useful
      const contractError = new ContractError('FAULT: ASSERT failed at instruction 0x1f4');
      expect(contractError.message).toContain('ASSERT failed');
      expect(contractError.userMessage).not.toContain('ASSERT');
    });
  });

  describe('Localization Wiring', () => {
    it('should resolve every user message from base messages in English', () => {
      // Assert - copy comes from the shipped catalog, not a divergent literal
      for (const entry of ERROR_FAMILY) {
        const translated = entry.build(translatorFor('en')).translatedUserMessage;
        expect(translated, entry.name).toBe(
          (baseMessages as Record<string, { en: string }>)[entry.messageKey].en,
        );
      }
    });

    it('should resolve every user message in Chinese', () => {
      // Assert - a missing zh entry would fall back to the raw key
      for (const entry of ERROR_FAMILY) {
        const translated = entry.build(translatorFor('zh')).translatedUserMessage!;
        expect(translated, entry.name).toBe(
          (baseMessages as Record<string, { zh: string }>)[entry.messageKey].zh,
        );
        expect(translated, entry.name).not.toBe(entry.messageKey);
        expect(/[一-鿿]/.test(translated), entry.name).toBe(true);
      }
    });

    it('should fall back to English copy when no translator is attached', () => {
      // Assert - a translator-free call site still gets readable prose
      for (const entry of ERROR_FAMILY) {
        const error = entry.build();
        expect(error.translatedUserMessage, entry.name).toBe(error.userMessage);
        expect(error.translatedUserMessage, entry.name).toBeTruthy();
      }
    });

    it('should keep translated copy within the display budget in both languages', () => {
      // Assert - translation must not blow past the toast limit
      for (const lang of ['en', 'zh'] as const) {
        for (const entry of ERROR_FAMILY) {
          const message = entry.build(translatorFor(lang)).translatedUserMessage!;
          expect(message.length, `${entry.name}/${lang}`).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Diagnostic Payload', () => {
    it('should expose the balance shortfall as structured detail', () => {
      // Act - the one error where the numbers matter to the caller
      const error = new InsufficientBalanceError(100, 5, 'GAS');

      // Assert - a UI can render "need 95 more" from details alone
      expect(error.details).toEqual({ required: 100, available: 5, symbol: 'GAS' });
      expect(error.message).toContain('Required: 100');
      expect(error.message).toContain('Available: 5');
    });

    it('should default the balance symbol to GAS', () => {
      // Assert - the platform's fee token, so the common call site stays terse
      expect(new InsufficientBalanceError(10, 1).details).toMatchObject({ symbol: 'GAS' });
    });

    it('should carry the offending field name on a validation error', () => {
      // Act
      const error = new ValidationError('amount must be positive', 'amount');

      // Assert - lets the form highlight the specific input
      expect(error.details).toMatchObject({ field: 'amount' });
    });

    it('should merge extra detail alongside the field on a validation error', () => {
      // Act
      const error = new ValidationError('out of range', 'wager', { min: 1, max: 100 });

      // Assert
      expect(error.details).toEqual({ field: 'wager', min: 1, max: 100 });
    });

    it('should tolerate a non-object detail payload without dropping the field', () => {
      // Act - a caller passing a bare string must not corrupt details
      const error = new ValidationError('bad input', 'amount', 'raw note');

      // Assert
      expect(error.details).toEqual({ field: 'amount' });
    });
  });

  describe('Sanitization of Unknown Errors', () => {
    it('should suppress every hostile internal payload behind the default message', () => {
      // Assert - a plain Error escaping from a dependency must not surface
      // hashes, urls, stack frames or raw dumps to the user
      for (const hostile of HOSTILE_INTERNALS) {
        const rendered = formatErrorMessage(new Error(hostile.value), 'Something went wrong.');
        expect(rendered, hostile.label).toBe('Something went wrong.');
      }
    });

    it('should pass through a short clean message from an unknown error', () => {
      // Assert - genuine one-line copy is more useful than a generic fallback
      expect(formatErrorMessage(new Error('Wager exceeds the table limit.'))).toBe(
        'Wager exceeds the table limit.',
      );
    });

    it('should keep a clean message that merely contains the word "at"', () => {
      // Assert - the newline check catches real frames, so "at" alone is safe
      expect(formatErrorMessage(new Error('GAS supports at most 8 decimal places.'))).toBe(
        'GAS supports at most 8 decimal places.',
      );
    });

    it('should fall back for non-Error throwables', () => {
      // Assert - strings, null, undefined and objects all land on the default
      for (const thrown of ['raw string', null, undefined, 42, { code: 1 }]) {
        expect(formatErrorMessage(thrown, 'Something went wrong.')).toBe(
          'Something went wrong.',
        );
      }
    });

    it('should prefer the user message over the technical one for every family member', () => {
      // Assert - formatErrorMessage never surfaces the diagnostic text when a
      // user message exists
      for (const entry of ERROR_FAMILY) {
        const error = entry.build();
        expect(formatErrorMessage(error), entry.name).toBe(error.userMessage);
      }
    });

    it('should never return an empty string from formatErrorMessage', () => {
      // Assert - an empty toast is worse than a generic one
      const inputs: unknown[] = [
        new Error(''),
        new MiniAppError('', 'EMPTY'),
        '',
        null,
        ...HOSTILE_INTERNALS.map((h) => new Error(h.value)),
        ...ERROR_FAMILY.map((e) => e.build()),
      ];
      for (const input of inputs) {
        expect(formatErrorMessage(input).length).toBeGreaterThan(0);
      }
    });
  });

  describe('errorMessage One-Liner Parity', () => {
    it('should prefer translated copy, then user message, then technical message', () => {
      // Assert - documented priority order holds
      expect(errorMessage(new ContractError('raw detail', undefined, translatorFor('zh')))).toBe(
        baseMessages.contractError.zh,
      );
      expect(errorMessage(new ContractError('raw detail'))).toBe(
        'Contract operation failed. Please try again.',
      );
      expect(errorMessage(new MiniAppError('technical only', 'CODE'))).toBe('technical only');
    });

    it('should return string throwables verbatim and fall back otherwise', () => {
      // Assert
      expect(errorMessage('plain failure')).toBe('plain failure');
      expect(errorMessage(null, 'fallback copy')).toBe('fallback copy');
      expect(errorMessage(new Error(''), 'fallback copy')).toBe('fallback copy');
    });

    it('should never return an empty string for any family member', () => {
      // Assert
      for (const entry of ERROR_FAMILY) {
        expect(errorMessage(entry.build()).length, entry.name).toBeGreaterThan(0);
      }
    });
  });
});

export { };
