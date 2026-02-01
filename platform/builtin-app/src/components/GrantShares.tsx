import React, { useEffect, useState, useCallback } from "react";
import { ExternalLink, ThumbsUp, ThumbsDown, MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import styles from "./BuiltinApp.module.css";

type GrantSharesProposal = {
    offchain_id: string;
    onchain_id?: number;
    title: string;
    state: string;
    votes_amount_accept: number;
    votes_amount_reject: number;
    discussion_url: string;
    offchain_creation_timestamp: string;
    offchain_comments_count: number;
};

type APIResponse = {
    total: number;
    items: GrantSharesProposal[];
};

function decodeTitle(base64: string): string {
    try {
        return decodeURIComponent(escape(window.atob(base64)));
    } catch (e) {
        return base64;
    }
}

function StatusBadge({ state }: { state: string }) {
    let className = styles.badge;
    let icon = <Clock size={12} />;

    switch (state) {
        case "executed":
            className += " " + styles.badgeExecuted;
            icon = <CheckCircle2 size={12} />;
            break;
        case "active":
        case "review":
        case "voting":
            className += " " + styles.badgeActive;
            icon = <AlertCircle size={12} />;
            break;
        case "cancelled":
        case "rejected":
        case "expired":
            className += " " + styles.badgeCancelled;
            icon = <XCircle size={12} />;
            break;
        case "discussion":
            className += " " + styles.badgeDiscussion;
            icon = <MessageSquare size={12} />;
            break;
        default:
            className += " " + styles.badgeDiscussion;
    }

    return (
        <div className={className}>
            {icon}
            <span>{state}</span>
        </div>
    );
}

export function GrantSharesPanel({ sdk }: { sdk: any }) {
    const [proposals, setProposals] = useState<GrantSharesProposal[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProposals = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                "https://api.prod.grantshares.io/api/proposal/all?page=0&page-size=50&order-attr=state-updated&order-asc=0"
            );
            if (!res.ok) throw new Error("Failed to fetch proposals");
            const data: APIResponse = await res.json();
            setProposals(data.items);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    return (
        <div className={styles.section}>
            <div className={styles.header}>
                <div className={styles.sectionTitle}>Latest Proposals</div>
                <button
                    onClick={fetchProposals}
                    className={styles.buttonSecondary}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className={`${styles.status} ${styles.statusError}`}>
                    {error}
                </div>
            )}

            <div className={styles.proposalList}>
                {proposals.map((p) => (
                    <div key={p.offchain_id} className={styles.proposalCard}>
                        <div className={styles.proposalHeader}>
                            <div>
                                <h3 className={styles.proposalTitle}>{decodeTitle(p.title)}</h3>
                                <div className={styles.proposalMeta}>
                                    <span className={styles.metaItem}>#{p.onchain_id ?? "?"}</span>
                                    <span className={styles.metaItem}>{new Date(p.offchain_creation_timestamp).toLocaleDateString()}</span>
                                    <a
                                        href={p.discussion_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={styles.discussionLink}
                                    >
                                        Discussion <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>
                            <StatusBadge state={p.state} />
                        </div>

                        <div className={styles.proposalStats}>
                            <div className={`${styles.statItem} ${styles.statAccept}`}>
                                <ThumbsUp size={14} />
                                <span>{p.votes_amount_accept}</span>
                            </div>
                            <div className={`${styles.statItem} ${styles.statReject}`}>
                                <ThumbsDown size={14} />
                                <span>{p.votes_amount_reject}</span>
                            </div>
                            <div className={`${styles.statItem} ${styles.statComments}`}>
                                <MessageSquare size={14} />
                                <span>{p.offchain_comments_count}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {!loading && proposals.length === 0 && !error && (
                    <div className={styles.emptyState}>No proposals found.</div>
                )}
            </div>
        </div>
    );
}
