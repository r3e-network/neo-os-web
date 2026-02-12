import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About Secret Tokens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-erobo-ink-soft">
        <p>
          Secret tokens allow MiniApps to access confidential data stored in the TEE (Trusted Execution Environment).
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tokens are encrypted and stored securely</li>
          <li>Each token can be scoped to a specific MiniApp</li>
          <li>Revoked tokens cannot be restored</li>
          <li>Token secrets are only shown once at creation</li>
        </ul>
      </CardContent>
    </Card>
  );
}
