export const p256: {
  utils: {
    randomPrivateKey(): Uint8Array;
  };
  getPublicKey(privateKey: Uint8Array, compressed?: boolean): Uint8Array;
};
