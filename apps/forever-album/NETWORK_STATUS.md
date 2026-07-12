# Forever Album network status

Forever Album is network-neutral. MainNet and TestNet hosts may both open it, but the selected network does not change its behavior because the app performs no RPC read, contract call, payment, transaction, NFT mint, oracle request, or remote-storage operation.

The only wallet value used is the currently connected Neo address. That address names a local key (`forever-album:photos:<address>`) inside this browser profile. It does not prove ownership of the local photos and does not make the album available from another browser, profile, device, or network.

No deployment or funded TestNet action is required or authorized for this app. Production verification therefore covers wallet partition changes, local write/read-back, storage failure recovery, encryption/decryption, static build, and HTTP delivery rather than chain execution.

