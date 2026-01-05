const STYLE_ID = "neo-miniapp-viewport-styles";

const MINIAPP_VIEWPORT_CSS = `
html,
body {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

#root,
#app,
#__next,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body,
page {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.mobile-container {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100% !important;
  box-sizing: border-box !important;
}

.aspect-wrapper {
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  aspect-ratio: unset !important;
  box-sizing: border-box !important;
}

.app-layout {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.app-content {
  flex: 1 !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
`;

export function injectMiniAppViewportStyles(iframe: HTMLIFrameElement): void {
  const doc = iframe.contentDocument;
  if (!doc?.head) return;
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MINIAPP_VIEWPORT_CSS;
  doc.head.appendChild(style);
}
