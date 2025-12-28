import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/wallet/store";
import { OAuthLinks } from "@/components/features/oauth";

export default function AccountContent() {
  const { connected, address, balance, provider, disconnect } = useWalletStore();

  return (
    <>
      {/* Wallet Section */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Connected via {provider}</div>
                  <div className="font-mono text-lg">{address}</div>
                </div>
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>

              {balance && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">NEO</div>
                    <div className="text-xl font-bold">{balance.neo}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">GAS</div>
                    <div className="text-xl font-bold">{balance.gas}</div>
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={disconnect}>
                Disconnect Wallet
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No wallet connected</p>
              <p className="text-sm text-gray-400">Connect your wallet using the button in the navigation bar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OAuth Section */}
      <Card>
        <CardHeader>
          <CardTitle>Social Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <OAuthLinks />
        </CardContent>
      </Card>
    </>
  );
}
