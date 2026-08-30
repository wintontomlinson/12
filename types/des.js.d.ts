/**
 * `des.js` ships no type definitions and there is no @types package.
 *
 * Only the surface we actually use is declared. See `api/_src/lib/des.ts` for
 * why a pure-JS DES is required instead of node:crypto.
 */
declare module 'des.js' {
  export interface CipherOptions {
    type: 'encrypt' | 'decrypt';
    key: Buffer | number[];
    iv?: Buffer | number[];
    /**
     * When false the cipher neither adds nor removes padding, handing back
     * every decrypted block verbatim. We need this so the final block is not
     * silently discarded; padding is stripped by hand instead.
     */
    padding?: boolean;
  }

  export interface Cipher {
    update(data: Buffer | number[]): number[];
    final(): number[];
  }

  export const DES: {
    create(options: CipherOptions): Cipher;
    new (options: CipherOptions): Cipher;
  };

  export const EDE: {
    create(options: CipherOptions): Cipher;
  };

  export const CBC: {
    instantiate(cipher: unknown): { create(options: CipherOptions): Cipher };
  };
}
