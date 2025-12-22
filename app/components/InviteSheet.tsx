"use client";

import { useState } from "react";
import { QrcodeCanvas } from "react-qrcode-pretty";

interface InviteSheetProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
  isHost?: boolean;
}

export default function InviteSheet({
  roomCode,
  isOpen,
  onClose,
  isHost = false,
}: InviteSheetProps) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const shareUrl = `${window.location.origin}/join?code=${roomCode}`;

  const handleShareLink = async () => {
    const shareData = {
      title: "Join my Popqiz game!",
      text: `Join my Popqiz game! Room code: ${roomCode}`,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name !== "AbortError") {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface rounded-t-3xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          {/* Handle */}
          <div className="flex justify-center">
            <div className="w-12 h-1 bg-text-secondary/30 rounded-full" />
          </div>

          {/* Room Code */}
          <div className="text-center space-y-2">
            <p className="text-text-secondary-dark text-sm">Room Code</p>
            <button
              onClick={handleCopyCode}
              className="text-4xl font-bold text-text-primary-dark tracking-wider active:scale-95"
            >
              {roomCode}
            </button>
            {codeCopied && (
              <p className="text-sm text-success font-medium animate-pulse">
                Code copied!
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center border-2 border-text-secondary/20 p-4">
              <QrcodeCanvas
                value={shareUrl}
                variant={{
                  eyes: "fluid",
                  body: "fluid",
                }}
                color={{
                  eyes: "#1F2937",
                  body: "#1F2937",
                }}
                padding={20}
                margin={0}
                bgColor="#FFFFFF"
                size={176}
              />
            </div>
          </div>

          {/* Share Link Button */}
          <button
            onClick={handleShareLink}
            className="w-full bg-brand text-white text-lg font-semibold py-4 px-6 rounded-2xl shadow-lg active:scale-[0.98]"
          >
            {copied ? "Link Copied!" : "Share Link"}
          </button>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="w-full bg-surface text-text-primary-dark text-lg font-medium py-4 px-6 rounded-2xl border-2 border-text-secondary/20 active:scale-[0.98]"
          >
            {linkCopied ? "Link Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </>
  );
}

