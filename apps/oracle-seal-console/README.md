# Oracle Seal Console

Local confidential payload sealing tool for Morpheus privacy Oracle and confidential compute.

## What It Does

- reads the current Oracle X25519 public key from the Neo N3 Oracle contract
- encrypts either a JSON payload patch or plain confidential text entirely in the browser
- produces ready-to-paste wrappers for `encrypted_payload`, `encrypted_params`, or `encrypted_token`
- helps users prepare private Oracle and compute requests without hand-rolling ciphertext envelopes

## Notes

- encryption happens locally in the browser with `X25519-HKDF-SHA256-AES-256-GCM`
- no private plaintext is sent to the host while sealing
- the output can be pasted directly into privacy Oracle / privacy compute payloads
