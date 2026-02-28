import pexpect
import sys

child = pexpect.spawn('neo-go contract invokefunction -r https://testnet1.neo.coz.io:443 -w deploy/wallets/testnet_wallet.json 0xaede1524afa3206436a665aff09668c36720d319 deposit hash160:NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu hash160:d2a4cff31913016155e38e474a2c06d08be276cf int:100000000 bytes:0000000000000000000000000000000000000000000000000000000000000000 -- NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu:Global', encoding='utf-8')

child.logfile = sys.stdout

try:
    child.expect('password >', timeout=10)
    child.sendline('password')
    child.expect('Relay transaction', timeout=10)
    child.sendline('y')
    child.expect(pexpect.EOF, timeout=30)
except Exception as e:
    print("Error:", str(e))
    sys.exit(1)
