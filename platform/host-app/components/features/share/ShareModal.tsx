"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Link2, QrCode, Twitter, MessageCircle, Download, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The shareable URL */
    url: string;
    /** App or page title */
    title: string;
    /** Optional description for social sharing */
    description?: string;
    /** Optional app icon URL */
    iconUrl?: string;
    /** Locale for i18n */
    locale?: string;
}

const translations = {
    en: {
        shareTitle: "Share",
        copyLink: "Copy Link",
        copied: "Copied!",
        scanQR: "Scan QR Code",
        downloadQR: "Download QR",
        shareVia: "Share via",
        openInBrowser: "Open in Browser",
    },
    zh: {
        shareTitle: "分享",
        copyLink: "复制链接",
        copied: "已复制!",
        scanQR: "扫描二维码",
        downloadQR: "下载二维码",
        shareVia: "通过以下方式分享",
        openInBrowser: "在浏览器中打开",
    },
};

export function ShareModal({
    isOpen,
    onClose,
    url,
    title,
    description = "",
    iconUrl,
    locale = "en",
}: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"link" | "qr">("link");
    const qrRef = useRef<SVGSVGElement>(null);

    const t = translations[locale as keyof typeof translations] || translations.en;

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    }, [url]);

    const handleDownloadQR = useCallback(() => {
        if (!qrRef.current) return;

        const svg = qrRef.current;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
            canvas.width = 512;
            canvas.height = 512;
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, 512, 512);

                const link = document.createElement("a");
                link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
            }
        };

        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
    }, [title]);

    const handleShareTwitter = useCallback(() => {
        const text = `${title}${description ? ` - ${description}` : ""}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, "_blank", "noopener,noreferrer");
    }, [url, title, description]);

    const handleShareTelegram = useCallback(() => {
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        window.open(telegramUrl, "_blank", "noopener,noreferrer");
    }, [url, title]);

    const handleNativeShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text: description,
                    url,
                });
            } catch (err) {
                // User cancelled or error
            }
        }
    }, [url, title, description]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            return () => document.removeEventListener("keydown", handleEscape);
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[420px] bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl border border-white/10 dark:border-white/5 z-[10000] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                {iconUrl && (
                                    <img src={iconUrl} alt="" className="w-8 h-8 rounded-lg" />
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">{t.shareTitle}</h2>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{title}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Tab switcher */}
                        <div className="flex border-b border-black/5 dark:border-white/5">
                            <button
                                onClick={() => setActiveTab("link")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === "link"
                                    ? "text-neo border-b-2 border-neo"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Link2 className="w-4 h-4" />
                                {t.copyLink}
                            </button>
                            <button
                                onClick={() => setActiveTab("qr")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === "qr"
                                    ? "text-neo border-b-2 border-neo"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <QrCode className="w-4 h-4" />
                                {t.scanQR}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {activeTab === "link" ? (
                                <div className="space-y-4">
                                    {/* URL input with copy button */}
                                    <div className="flex items-center gap-2 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                                        <input
                                            type="text"
                                            value={url}
                                            readOnly
                                            className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
                                        />
                                        <button
                                            onClick={handleCopy}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied
                                                ? "bg-neo text-black"
                                                : "bg-neo/20 text-neo hover:bg-neo hover:text-black"
                                                }`}
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            {copied ? t.copied : t.copyLink}
                                        </button>
                                    </div>

                                    {/* Social share buttons */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground font-medium">{t.shareVia}</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleShareTwitter}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] rounded-xl transition-colors"
                                            >
                                                <Twitter className="w-4 h-4" />
                                                <span className="text-xs font-semibold">Twitter</span>
                                            </button>
                                            <button
                                                onClick={handleShareTelegram}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] rounded-xl transition-colors"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                <span className="text-xs font-semibold">Telegram</span>
                                            </button>
                                            {"share" in navigator && (
                                                <button
                                                    onClick={handleNativeShare}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-neo/10 hover:bg-neo/20 text-neo rounded-xl transition-colors"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    <span className="text-xs font-semibold">More</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center space-y-4">
                                    {/* QR Code */}
                                    <div className="p-4 bg-white rounded-2xl shadow-lg">
                                        <QRCodeSVG
                                            ref={qrRef}
                                            value={url}
                                            size={200}
                                            level="H"
                                            includeMargin
                                            imageSettings={iconUrl ? {
                                                src: iconUrl,
                                                height: 40,
                                                width: 40,
                                                excavate: true,
                                            } : undefined}
                                        />
                                    </div>

                                    <p className="text-xs text-muted-foreground text-center">
                                        {t.scanQR}
                                    </p>

                                    {/* Download QR button */}
                                    <button
                                        onClick={handleDownloadQR}
                                        className="flex items-center gap-2 px-4 py-2 bg-neo/10 hover:bg-neo/20 text-neo rounded-xl transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span className="text-sm font-semibold">{t.downloadQR}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default ShareModal;
