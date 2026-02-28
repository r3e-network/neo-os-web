package main

import (
	"fmt"
	"log"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

func main() {
	wif := "***REMOVED***"
	password := "password"

	w, err := wallet.NewWallet("deploy/wallets/testnet_wallet.json")
	if err != nil {
		log.Fatal(err)
	}

	pk, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		log.Fatal(err)
	}

	acc := wallet.NewAccountFromPrivateKey(pk)
	if err := acc.Encrypt(password, w.Scrypt); err != nil {
		log.Fatal(err)
	}
	acc.Label = "deployer"

	w.AddAccount(acc)
	if err := w.Save(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Wallet successfully created at deploy/wallets/testnet_wallet.json")
}
