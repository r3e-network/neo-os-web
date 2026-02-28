import pexpect
import sys

child = pexpect.spawn('neo-go contract deploy -i contracts/build/zNEP17.nef -m contracts/build/zNEP17.manifest.json -r https://testnet1.neo.coz.io:443 -w deploy/wallets/testnet_wallet.json --force', encoding='utf-8')

child.logfile = sys.stdout

try:
    child.expect('password >', timeout=10)
    child.sendline('password')
    child.expect(pexpect.EOF, timeout=30)
except Exception as e:
    print("Error:", str(e))
    sys.exit(1)
