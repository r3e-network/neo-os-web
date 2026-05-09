/**
 * MiniAppPage — React equivalent of MiniAppPage.vue
 *
 * Three-column layout component that renders the left sidebar (navigation, brand,
 * stats), main content area (hero, info tabs, comments, docs), and right sidebar
 * (operation panel).
 *
 * Vue slots are converted to React render props / children:
 * - #content / #hero  -> children (ReactNode)
 * - #operation        -> renderOperation (render prop)
 * - #tab-stats        -> renderTabStats
 * - #tab-history      -> renderTabHistory
 * - #tab-{key}        -> customTabRenderers
 * - #comments         -> renderComments
 * - #docs             -> renderDocs
 */

import React, { useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  MiniAppTemplateConfig,
  TabConfig,
} from "@shared/types/template-config";
import type { StatusMessage } from "../react/hooks/useStatusMessage";
import { AppIcon } from "./AppIcon";
import "./MiniAppPage.scss";

// ============================================================================
// Types
// ============================================================================

export interface Comment {
  id: string;
  author: string;
  text: string;
  time: string;
  likes?: number;
}

export interface MiniAppPageProps {
  name: string;
  config: MiniAppTemplateConfig;
  state: Record<string, unknown>;
  t: (key: string) => string;
  statusMessage?: StatusMessage | null;
  fireworksActive?: boolean;
  sidebarTitle?: string;
  sidebarItems?: Array<{
    label: string;
    value: string | number | boolean | null | undefined;
  }>;
  fallbackMessage?: string;
  onBoundaryError?: (error: Error) => void;
  onBoundaryRetry?: () => void;
  comments?: Comment[];
  focusMode?: boolean;

  // Content slots as children/render props
  children?: ReactNode;
  renderOperation?: () => ReactNode;
  renderTabStats?: () => ReactNode;
  renderTabHistory?: () => ReactNode;
  customTabRenderers?: Record<string, () => ReactNode>;
  renderComments?: () => ReactNode;
  renderDocs?: () => ReactNode;

  // Event callbacks
  onTabChange?: (tabKey: string) => void;
  onSubmitComment?: (text: string) => void;
  onLikeComment?: (commentId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BRAND_ICON = "puzzle";
const DEFAULT_DOCS_ICON = "docs";

// ============================================================================
// Component
// ============================================================================

export function MiniAppPage({
  name,
  config,
  state: _state,
  t,
  statusMessage = null,
  fireworksActive = false,
  sidebarTitle: _sidebarTitle,
  sidebarItems = [],
  fallbackMessage,
  onBoundaryError,
  onBoundaryRetry,
  comments = [],
  focusMode = false,
  children,
  renderOperation,
  renderTabStats,
  renderTabHistory,
  customTabRenderers,
  renderComments,
  renderDocs,
  onTabChange,
  onSubmitComment,
  onLikeComment,
}: MiniAppPageProps) {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  const brandIcon = useMemo(
    () => config.tabs[0]?.icon ?? DEFAULT_BRAND_ICON,
    [config.tabs],
  );
  const defaultTabKey = useMemo(
    () =>
      config.tabs.find((tab) => tab.default)?.key ?? config.tabs[0]?.key ?? "",
    [config.tabs],
  );
  const [activeTab, setActiveTabState] = useState(defaultTabKey);
  const [newComment, setNewComment] = useState("");

  const allTabs = useMemo(() => {
    const tabs = [...config.tabs];
    if (!tabs.some((tab) => tab.key === "docs")) {
      tabs.push({ key: "docs", labelKey: "docs", icon: DEFAULT_DOCS_ICON });
    }
    return tabs;
  }, [config.tabs]);

  const setActiveTab = useCallback(
    (key: string) => {
      setActiveTabState(key);
      onTabChange?.(key);
    },
    [onTabChange],
  );

  // Info tabs computation
  const infoTabs = useMemo(() => {
    const tabs: Array<{ key: string; labelKey: string }> = [];
    if (sidebarItems.length > 0 || renderTabStats)
      tabs.push({ key: "stats", labelKey: "stats" });
    if (renderTabHistory) tabs.push({ key: "history", labelKey: "history" });
    config.tabs
      .filter(
        (tab) =>
          !tab.default &&
          tab.key !== "stats" &&
          tab.key !== "history" &&
          tab.key !== "docs",
      )
      .forEach((tab) => {
        if (customTabRenderers?.[tab.key]) {
          tabs.push({ key: tab.key, labelKey: tab.labelKey });
        }
      });
    return tabs;
  }, [
    sidebarItems.length,
    renderTabStats,
    renderTabHistory,
    config.tabs,
    customTabRenderers,
  ]);

  const [activeInfoTab, setActiveInfoTab] = useState(
    infoTabs[0]?.key ?? "stats",
  );
  const customInfoTabs = useMemo(
    () =>
      infoTabs.filter((tab) => tab.key !== "stats" && tab.key !== "history"),
    [infoTabs],
  );
  const hasInfoContent = infoTabs.length > 0;
  const hasOperationPanel = typeof renderOperation === "function";

  const submitComment = useCallback(() => {
    if (newComment.trim()) {
      onSubmitComment?.(newComment.trim());
      setNewComment("");
    }
  }, [newComment, onSubmitComment]);

  // Docs
  const docSteps = useMemo(() => {
    const steps: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const step = t(`step${i}`);
      if (step && step !== `step${i}`) steps.push(step);
    }
    return steps;
  }, [t]);

  const docFeatureCount =
    (config as MiniAppTemplateConfig & { docFeatureCount?: number })
      .docFeatureCount ?? 3;
  const docFeatures = useMemo(() => {
    const features: Array<{ name: string; desc: string }> = [];
    for (let i = 1; i <= docFeatureCount; i++) {
      const featureName = t(`feature${i}Name`);
      const desc = t(`feature${i}Desc`);
      if (featureName && featureName !== `feature${i}Name`) {
        features.push({
          name: featureName,
          desc: desc !== `feature${i}Desc` ? desc : "",
        });
      }
    }
    return features;
  }, [t, docFeatureCount]);

  // --------------------------------------------------------------------------
  // Error Boundary (simple wrapper)
  // --------------------------------------------------------------------------

  const renderContent = () => {
    try {
      return children;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onBoundaryError?.(error);
      return (
        <div className="error-boundary" role="alert">
          <p>{fallbackMessage || t("errorFallback")}</p>
          {onBoundaryRetry && (
            <button type="button" onClick={onBoundaryRetry}>
              {t("retry")}
            </button>
          )}
        </div>
      );
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div
      className={`miniapp-page theme-${name}${focusMode ? " miniapp-page--focus" : ""}`}
    >
      {/* Atmospheric background */}
      <div className="page-atmosphere" aria-hidden="true">
        <div className="atmo-grain" />
        <div className="atmo-gradient" />
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div className={`status-toast ${statusMessage.type}`} role="alert">
          <span className="toast-dot" />
          <span>{statusMessage.msg}</span>
        </div>
      )}

      {/* Fireworks overlay */}
      {fireworksActive && (
        <div className="fireworks-container" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => {
            const colors = [
              "#ff6b6b",
              "#ffd93d",
              "#6bcb77",
              "#4d96ff",
              "#ff6bd6",
              "#a855f7",
            ];
            const x = 10 + Math.random() * 80;
            const y = 10 + Math.random() * 60;
            const delay = Math.random() * 0.5;
            const color = colors[i % colors.length];
            return (
              <div
                key={i}
                className={`firework firework-${i + 1}`}
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    animationDelay: `${delay}s`,
                    "--firework-color": color,
                  } as React.CSSProperties
                }
              >
                {Array.from({ length: 8 }, (_, j) => (
                  <div key={j} className={`spark spark-${j + 1}`} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* THREE-COLUMN LAYOUT */}
      <div
        className={`page-grid${hasOperationPanel ? "" : " page-grid--no-operation"}${focusMode ? " page-grid--focus" : ""}`}
      >
        {/* LEFT SIDEBAR */}
        {!focusMode && (
          <aside className="sidebar-left" aria-label={t("navigationSidebar")}>
            <div className="sidebar-brand">
              <div className="brand-mark">
                <AppIcon name={brandIcon} size={22} className="app-icon" />
              </div>
              <div className="brand-text">
                <span className="brand-name">{t("title")}</span>
                <span className="brand-tag">{t("neoN3")}</span>
              </div>
            </div>

            <nav
              className="sidebar-nav"
              role="tablist"
              aria-orientation="vertical"
            >
              {allTabs.map((tab, idx) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`nav-item${activeTab === tab.key ? " active" : ""}`}
                  style={{ "--delay": `${idx * 40}ms` } as React.CSSProperties}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-label={t(tab.labelKey)}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <AppIcon
                    name={tab.icon ?? DEFAULT_BRAND_ICON}
                    size={18}
                    className="nav-icon app-icon"
                  />
                  <span className="nav-label">{t(tab.labelKey)}</span>
                  {activeTab === tab.key && <span className="nav-indicator" />}
                </button>
              ))}
            </nav>

            {sidebarItems.length > 0 && (
              <div className="sidebar-stats">
                <div className="stats-divider" />
                {sidebarItems.map((item, i) => (
                  <div
                    key={`stat-${i}`}
                    className="stat-row"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <span className="stat-label">{item.label}</span>
                    <span className="stat-value">
                      {item.value ?? t("notAvailable")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* MIDDLE -- Main Content */}
        <main className="content-main" role="main">
          <section className="section-hero">{renderContent()}</section>

          {hasOperationPanel && (
            <section
              className="section-mobile-operation"
              aria-label={t("operationsPanel")}
            >
              <div className="operation-panel">{renderOperation()}</div>
            </section>
          )}

          {!focusMode && hasInfoContent && (
            <section className="section-info">
              {infoTabs.length > 1 && (
                <div className="info-tabs">
                  {infoTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`info-tab${activeInfoTab === tab.key ? " active" : ""}`}
                      role="tab"
                      aria-selected={activeInfoTab === tab.key}
                      aria-controls={`tab-panel-${tab.key}`}
                      aria-label={t(tab.labelKey)}
                      onClick={() => setActiveInfoTab(tab.key)}
                    >
                      {t(tab.labelKey)}
                    </button>
                  ))}
                </div>
              )}
              <div className="info-content">
                {activeInfoTab === "stats" && (
                  <div
                    id="tab-panel-stats"
                    role="tabpanel"
                    aria-labelledby="tab-stats"
                  >
                    {renderTabStats
                      ? renderTabStats()
                      : sidebarItems.length > 0 && (
                          <div className="auto-stats-grid">
                            {sidebarItems.map((item, i) => (
                              <div
                                key={`auto-stat-${i}`}
                                className="auto-stat-card"
                                style={{ "--i": i } as React.CSSProperties}
                              >
                                <span className="auto-stat-value">
                                  {item.value ?? t("notAvailable")}
                                </span>
                                <span className="auto-stat-label">
                                  {item.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                  </div>
                )}
                {activeInfoTab === "history" && (
                  <div
                    id="tab-panel-history"
                    role="tabpanel"
                    aria-labelledby="tab-history"
                  >
                    {renderTabHistory?.()}
                  </div>
                )}
                {customInfoTabs.map((tab) =>
                  activeInfoTab === tab.key ? (
                    <div
                      key={tab.key}
                      id={`tab-panel-${tab.key}`}
                      role="tabpanel"
                      aria-labelledby={`tab-${tab.key}`}
                    >
                      {customTabRenderers?.[tab.key]?.()}
                    </div>
                  ) : null,
                )}
              </div>
            </section>
          )}

          {!focusMode && (
            <section className="section-comments">
              {renderComments ? (
                renderComments()
              ) : (
                <>
                  <div className="comments-header">
                    <h3 className="comments-title">{t("commentsTitle")}</h3>
                    <span className="comments-count">{comments.length}</span>
                  </div>
                  <div className="comments-input">
                    <label htmlFor="comment-input" className="sr-only">
                      {t("commentPlaceholder")}
                    </label>
                    <input
                      id="comment-input"
                      className="comment-input"
                      value={newComment}
                      placeholder={t("commentPlaceholder")}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyUp={(e) => {
                        if (e.key === "Enter") submitComment();
                      }}
                    />
                    <button
                      type="button"
                      className="comment-submit"
                      disabled={!newComment.trim()}
                      aria-label={t("postComment")}
                      onClick={submitComment}
                    >
                      {t("post")}
                    </button>
                  </div>
                  {comments.length === 0 ? (
                    <div className="comments-empty">
                      <span>{t("noComments")}</span>
                    </div>
                  ) : (
                    <div className="comments-list">
                      {comments.map((comment) => (
                        <div key={comment.id} className="comment-item">
                          <div className="comment-avatar">
                            {comment.author?.[0] || "?"}
                          </div>
                          <div className="comment-body">
                            <div className="comment-meta">
                              <span className="comment-author">
                                {comment.author}
                              </span>
                              <span className="comment-time">
                                {comment.time}
                              </span>
                            </div>
                            <p className="comment-text">{comment.text}</p>
                            <div className="comment-actions">
                              <button
                                type="button"
                                className="comment-action"
                                aria-label={t("likeComment")}
                                onClick={() => onLikeComment?.(comment.id)}
                              >
                                &#9825; {comment.likes || 0}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {!focusMode && (
            <section className="section-docs">
              {renderDocs ? (
                renderDocs()
              ) : (
                <details className="docs-accordion">
                  <summary className="docs-title">
                    {t("docSubtitle") || t("subtitle")}
                  </summary>
                  <div className="docs-content">
                    <p className="docs-description">
                      {t("docDescription") || ""}
                    </p>
                    {docSteps.length > 0 && (
                      <div className="docs-steps">
                        <h4>{t("howToPlay")}</h4>
                        <ol>
                          {docSteps.map((step, i) => (
                            <li key={`${step}-${i}`}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {docFeatures.length > 0 && (
                      <div className="docs-features">
                        <h4>{t("keyFeatures")}</h4>
                        {docFeatures.map((feat) => (
                          <div key={feat.name} className="docs-feature">
                            <strong>{feat.name}</strong>
                            <span>{feat.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </section>
          )}
        </main>

        {hasOperationPanel && (
          <aside className="sidebar-right" aria-label={t("operationsPanel")}>
            <div className="operation-panel">{renderOperation()}</div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default MiniAppPage;
