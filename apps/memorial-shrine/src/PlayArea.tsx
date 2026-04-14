/**
 * PlayArea.tsx — Memorial Shrine
 *
 * Full interactive memorial console: stats bar, obituary banner,
 * memorial grid with TombstoneCards, create form, and tribute panel.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TombstoneCard from "./pages/index/components/TombstoneCard";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, bool } = useStateBindings(state);

  const memorials = (state.memorials?.get() ?? []) as Array<{ id: number; name?: string; [key: string]: unknown }>;
  const visitedMemorials = (state.visitedMemorials?.get() ?? []) as Array<{ id: number; [key: string]: unknown }>;
  const recentObituaries = (state.recentObituaries?.get() ?? []) as Array<{ id: number; name: string; text: string }>;
  const selectedMemorial = state.selectedMemorial?.get() as { id: number; name?: string; [key: string]: unknown } | null;
  const memorialCount = num("memorialCount");
  const tributeCount = num("tributeCount");
  const obituaryCount = num("obituaryCount");
  const isSubmitting = bool("isSubmitting");
  const isPaying = bool("isPaying");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhotoHash, setFormPhotoHash] = useState("");
  const [formRelationship, setFormRelationship] = useState("");
  const [formBirthYear, setFormBirthYear] = useState("");
  const [formDeathYear, setFormDeathYear] = useState("");
  const [formBiography, setFormBiography] = useState("");
  const [formObituary, setFormObituary] = useState("");

  const [tributeMessage, setTributeMessage] = useState("");
  const [tributeOfferingType, setTributeOfferingType] = useState("0");
  const [tributeOfferingCost, setTributeOfferingCost] = useState("1");

  const handleCreate = async () => {
    await dispatch("createMemorial", {
      name: formName,
      photoHash: formPhotoHash,
      relationship: formRelationship,
      birthYear: parseInt(formBirthYear, 10) || 0,
      deathYear: parseInt(formDeathYear, 10) || 0,
      biography: formBiography,
      obituary: formObituary,
    });
    setShowCreateForm(false);
    setFormName(""); setFormPhotoHash(""); setFormRelationship("");
    setFormBirthYear(""); setFormDeathYear(""); setFormBiography(""); setFormObituary("");
  };

  const handlePayTribute = async (memorialId: number) => {
    await dispatch("payTribute", memorialId, parseInt(tributeOfferingType, 10), parseInt(tributeOfferingCost, 10), tributeMessage);
    setTributeMessage("");
  };

  return (
    <div className="memorial-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{memorialCount}</span>
          <span className="stat-label">{t("memorials") || "Memorials"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{tributeCount}</span>
          <span className="stat-label">{t("myTributes") || "Tributes"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{obituaryCount}</span>
          <span className="stat-label">{t("obituaries") || "Obituaries"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{visitedMemorials.length}</span>
          <span className="stat-label">{t("visited") || "Visited"}</span>
        </div>
      </div>

      {/* Header */}
      <div className="header" aria-hidden="true">
        <span className="title">{t("title") || "Memorial Shrine"}</span>
        <span className="tagline">{t("tagline") || "Eternal Remembrance"}</span>
        <span className="subtitle">{t("subtitle") || "On-chain memorials"}</span>
      </div>

      {/* Obituary Banner */}
      {recentObituaries.length > 0 && (
        <div className="obituary-banner">
          <span className="banner-title">{t("obituaries") || "Obituaries"}</span>
          <div className="banner-scroll">
            {recentObituaries.map((ob) => (
              <button key={ob.id} type="button" className="obituary-item" aria-label={ob.name}
                onClick={() => dispatch("openMemorial", ob.id)}>
                <span className="name">{ob.name}</span>
                <span className="text">{ob.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Memorial Detail */}
      {selectedMemorial && (
        <NeoCard variant="erobo" className="detail-card">
          <div className="detail-header">
            <span className="detail-name">{selectedMemorial.name || t("unnamed") || "Unnamed"}</span>
            {selectedMemorial.birthYear && selectedMemorial.deathYear && (
              <span className="detail-years">{String(selectedMemorial.birthYear)}-{String(selectedMemorial.deathYear)}</span>
            )}
          </div>
          {selectedMemorial.biography && (
            <p className="detail-bio">{String(selectedMemorial.biography)}</p>
          )}
          <div className="tribute-form">
            <span className="tribute-title">{t("payTribute") || "Pay Tribute"}</span>
            <NeoInput value={tributeMessage} label={t("tributeMessage") || "Message"} placeholder={t("tributeMessagePlaceholder") || "Your tribute..."} onChange={setTributeMessage} />
            <div className="tribute-row">
              <NeoInput value={tributeOfferingType} label={t("offeringType") || "Offering Type"} placeholder="0" onChange={setTributeOfferingType} />
              <NeoInput value={tributeOfferingCost} label={t("offeringCost") || "Cost"} placeholder="1" onChange={setTributeOfferingCost} />
            </div>
            <NeoButton variant="primary" loading={isPaying} onClick={() => handlePayTribute(selectedMemorial.id)} aria-label={t("payTribute") || "Pay Tribute"}>
              {t("payTribute") || "Pay Tribute"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Create Memorial */}
      <NeoButton variant="secondary" onClick={() => setShowCreateForm(!showCreateForm)} aria-label={t("createMemorial") || "Create Memorial"}>
        {showCreateForm ? (t("cancel") || "Cancel") : (t("createMemorial") || "Create Memorial")}
      </NeoButton>

      {showCreateForm && (
        <NeoCard variant="erobo" className="create-form-card">
          <div className="create-form">
            <NeoInput value={formName} label={t("memorialName") || "Name"} placeholder={t("namePlaceholder") || "Full name"} onChange={setFormName} />
            <NeoInput value={formPhotoHash} label={t("photoHash") || "Photo Hash"} placeholder={t("photoHashPlaceholder") || "IPFS hash"} onChange={setFormPhotoHash} />
            <NeoInput value={formRelationship} label={t("relationship") || "Relationship"} placeholder={t("relationshipPlaceholder") || "e.g. Father, Friend"} onChange={setFormRelationship} />
            <div className="year-row">
              <NeoInput value={formBirthYear} label={t("birthYear") || "Birth Year"} placeholder="1940" onChange={setFormBirthYear} />
              <NeoInput value={formDeathYear} label={t("deathYear") || "Death Year"} placeholder="2024" onChange={setFormDeathYear} />
            </div>
            <NeoInput value={formBiography} type="textarea" label={t("biography") || "Biography"} placeholder={t("biographyPlaceholder") || "Life story..."} onChange={setFormBiography} />
            <NeoInput value={formObituary} type="textarea" label={t("obituary") || "Obituary"} placeholder={t("obituaryPlaceholder") || "Obituary text..."} onChange={setFormObituary} />
            <NeoButton variant="primary" loading={isSubmitting} onClick={handleCreate} aria-label={t("submit") || "Submit"}>
              {t("submit") || "Submit"}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Memorial Grid */}
      {memorials.length > 0 ? (
        <div className="memorials-grid">
          {memorials.map((memorial) => (
            <TombstoneCard key={memorial.id} memorial={memorial} onClick={() => dispatch("openMemorial", memorial.id)} t={t} />
          ))}
        </div>
      ) : (
        <div className="empty-memorials"><p>{t("noMemorials") || "No memorials yet."}</p></div>
      )}
    </div>
  );
}
