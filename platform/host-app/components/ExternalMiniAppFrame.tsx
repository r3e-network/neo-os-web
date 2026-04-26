import React from "react";

type ExternalMiniAppFrameProps = {
  src: string;
  title: string;
  className?: string;
};

export function ExternalMiniAppFrame({
  src,
  title,
  className,
}: ExternalMiniAppFrameProps) {
  return (
    <div
      className={
        className ||
        "w-full h-[600px] rounded-2xl overflow-hidden bg-black relative border border-gray-200 shadow-sm"
      }
    >
      <iframe
        src={src}
        title={title}
        className="h-full w-full border-0 bg-white"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
      />
    </div>
  );
}
