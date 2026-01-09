import React, { useEffect, useState } from "react";
import { useWalletStore } from "@/lib/wallet/store";
import { PasswordDialog } from "@/components/features/wallet/PasswordDialog";
import { PasswordCache } from "@/lib/wallet/password-cache";

export function WalletDialogProvider({ children }: { children: React.ReactNode }) {
  const { passwordCallback, submitPassword, cancelPasswordRequest } = useWalletStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (passwordCallback) {
      // Check cache asynchronously
      const checkCache = async () => {
        const cached = await PasswordCache.get();
        if (cached) {
          submitPassword(cached);
          return;
        }
        setOpen(true);
      };
      checkCache();
    } else {
      setOpen(false);
    }
  }, [passwordCallback, submitPassword]);

  const handleSubmit = async (password: string, remember: boolean) => {
    if (remember) {
      PasswordCache.set(password);
    }
    // We wrap in promise just to satisfy the Dialog interface,
    // but the store action is synchronous (it just resolves the callback).
    // The Async logic is waiting in the store's signMessage method.
    submitPassword(password);
  };

  const handleClose = () => {
    // If closed without submit, reject the promise
    if (open && passwordCallback) {
      cancelPasswordRequest();
    }
    setOpen(false);
  };

  return (
    <>
      {children}
      <PasswordDialog
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title="Confirm Transaction"
        description="Please enter your social account password to authorize this action."
      />
    </>
  );
}
