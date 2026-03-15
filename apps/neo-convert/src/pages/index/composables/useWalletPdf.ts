import jsPDF from "jspdf";
import type { NeoAccount } from "@/services/neo";

export function useWalletPdf(t: (key: string) => string) {
  const generate = (account: NeoAccount, addressQr: string, wifQr: string) => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const centerX = width / 2;

    const neoGreen = "#00E599";
    const neoDark = "#121212";
    const neoGrey = "#1F2937";

    // Background Fill
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, width, height, "F");

    // Top Banner
    doc.setFillColor(neoDark);
    doc.rect(0, 0, width, 40, "F");

    // Center Fold Line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([5, 5], 0);
    doc.line(centerX, 40, centerX, height - 20);
    doc.setLineDashPattern([], 0);

    // Header Content
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(t("paperWalletTitle"), centerX, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(neoGreen);
    doc.text(t("paperWalletTagline"), centerX, 32, { align: "center" });

    // LEFT SIDE: PUBLIC
    const leftX = centerX / 2;
    const contentStart = 60;

    doc.setFillColor(235, 255, 245);
    doc.setDrawColor(neoGreen);
    doc.roundedRect(20, contentStart, centerX - 40, height - 100, 5, 5, "FD");

    doc.setTextColor(0, 150, 80);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(t("paperWalletPublicTitle"), leftX, contentStart + 15, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(t("paperWalletPublicNote"), leftX, contentStart + 22, { align: "center" });

    doc.addImage(addressQr, "PNG", leftX - 35, contentStart + 30, 70, 70);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("courier", "bold");
    doc.text(account.address, leftX, contentStart + 115, { align: "center" });

    // RIGHT SIDE: PRIVATE
    const rightX = centerX + centerX / 2;

    doc.setFillColor(255, 240, 240);
    doc.setDrawColor(200, 50, 50);
    doc.roundedRect(centerX + 20, contentStart, centerX - 40, height - 100, 5, 5, "FD");

    doc.setTextColor(200, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(t("paperWalletPrivateTitle"), rightX, contentStart + 15, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(t("paperWalletPrivateNote"), rightX, contentStart + 22, { align: "center" });

    doc.addImage(wifQr, "PNG", rightX - 35, contentStart + 30, 70, 70);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("courier", "bold");
    const wifSplit = doc.splitTextToSize(account.wif, 80);
    doc.text(wifSplit, rightX, contentStart + 115, { align: "center" });

    // Footer
    doc.setFillColor(neoGrey);
    doc.rect(0, height - 20, width, 20, "F");
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(t("paperWalletFooter"), centerX, height - 8, { align: "center" });

    doc.save(`neo-wallet-${account.address.slice(0, 8)}.pdf`);
  };

  return { generate };
}
