"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { findConflicts } from "@shared/memoryConflicts";
import { MediaView } from "@/components/MediaView";
import { VoiceInput } from "@/components/VoiceInput";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { Checkbox, Toggle } from "@/components/ui/Choice";
import { EmptyState, ErrorNote, Loading, Notice, StatusBadge, describeError } from "@/components/ui/Feedback";
import { TextArea, TextField } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { formatDate, newId } from "@/lib/domain/dates";
import { searchEntries, withRevision, MAX_MEDIA_BYTES } from "@/lib/domain/lifebook";
import { resizePhoto } from "@/lib/media";
import { ValidationError, type LifebookCategory, type LifebookEntry } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

const CATEGORIES: readonly { value: LifebookCategory; icon: IconName }[] = [
  { value: "people", icon: "users" },
  { value: "stories", icon: "book" },
  { value: "favorites", icon: "heart" },
  { value: "everyday", icon: "clock" },
  { value: "milestones", icon: "calendar" },
  { value: "places", icon: "pin" },
  { value: "photos", icon: "camera" },
  { value: "voice", icon: "mic" },
];

function PhotoInput({ onPick, hasMedia }: { onPick: (blob: Blob | null) => void; hasMedia: boolean }) {
  const { t } = usePrefs();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
  return (
    <div className="space-y-2">
      <label className="inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-pill border-2 border-primary-strong px-5 font-extrabold text-primary-strong focus-within:outline focus-within:outline-[3px] focus-within:outline-primary-strong">
        <Icon name="plus" className="h-5 w-5" />
        {hasMedia || preview ? t("life.changePhoto") : t("life.addPhoto")}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setError(null);
            if (!file) return;
            void resizePhoto(file)
              .then((blob) => {
                if (blob.size > MAX_MEDIA_BYTES) throw new ValidationError("media", "mediaTooBig");
                setPreview(URL.createObjectURL(blob));
                onPick(blob);
              })
              .catch((err: unknown) => setError(err instanceof ValidationError ? err : new ValidationError("media", "badMedia")));
          }}
        />
      </label>
      <p className="text-sm text-ink-soft">{t("life.photoHint")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the resized photo */}
      {preview ? <img src={preview} alt="" className="max-h-60 rounded-2xl border border-line object-contain" /> : null}
      {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
    </div>
  );
}

function EntryForm({
  initial,
  previous,
  people,
  isElder,
  onDone,
  onCancel,
}: {
  initial: LifebookEntry;
  previous: LifebookEntry | null;
  people: readonly LifebookEntry[];
  isElder: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const [draft, setDraft] = useState(initial);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const needsMedia = draft.category === "photos" || draft.category === "voice";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (needsMedia && !blob && !draft.media) throw new ValidationError("media", "required");
      const media = blob ? await repo.saveLifebookMedia(elderId, draft.id, blob, draft.category === "voice" ? "audio" : "photo") : (draft.media ?? null);
      const next = withRevision(previous, { ...draft, media, updatedAt: new Date().toISOString() }, actor.name, new Date());
      await repo.saveLifebookEntry(elderId, next);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const linkable = people.filter((p) => p.id !== draft.id);
  return (
    <Card>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <h3 className="text-lg font-extrabold">{t(`life.cat.${draft.category}`)}</h3>
        {draft.category === "photos" ? <PhotoInput hasMedia={Boolean(draft.media)} onPick={setBlob} /> : null}
        {draft.category === "voice" ? <VoiceInput onRecorded={setBlob} /> : null}
        {needsMedia && draft.media && !blob ? <MediaView media={draft.media} title={draft.title} /> : null}
        <TextField label={t(`life.titleLabel.${draft.category}`)} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} required />
        {draft.category === "people" ? (
          <TextField label={t("life.relationship")} hint={t("life.relationshipHint")} value={draft.relationship ?? ""} onChange={(e) => setDraft({ ...draft, relationship: e.target.value })} maxLength={60} />
        ) : null}
        <TextArea label={t("life.detail")} hint={t(`life.detailHint.${draft.category}`)} rows={4} value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} maxLength={2000} required={!needsMedia} />
        {draft.category !== "everyday" ? (
          <TextField label={t("life.when")} hint={t("life.whenHint")} value={draft.when ?? ""} onChange={(e) => setDraft({ ...draft, when: e.target.value })} maxLength={60} />
        ) : null}
        {draft.category !== "people" && linkable.length > 0 ? (
          <fieldset className="space-y-1">
            <legend className="font-bold">{t("life.linkPeople")}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {linkable.map((p) => {
                const linked = draft.people?.includes(p.id) ?? false;
                return (
                  <Checkbox
                    key={p.id}
                    label={p.relationship ? `${p.title} (${p.relationship})` : p.title}
                    checked={linked}
                    onChange={(on) => setDraft({ ...draft, people: on ? [...(draft.people ?? []), p.id] : (draft.people ?? []).filter((id) => id !== p.id) })}
                  />
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {isElder ? (
          <Toggle label={t("life.share")} description={t("life.shareHint")} checked={draft.shareWithCircle === true} onChange={(shareWithCircle) => setDraft({ ...draft, shareWithCircle })} />
        ) : null}
        {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" icon="check" busy={busy}>
            {t("common.save")}
          </Button>
          <Button variant="quiet" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EntryCard({ entry, people, canWrite, onEdit, onChanged }: { entry: LifebookEntry; people: readonly LifebookEntry[]; canWrite: boolean; onEdit: () => void; onChanged: () => void }) {
  const { t, locale } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mine = entry.source.byUid === actor.uid;
  const sourceLabel = mine ? t("life.source.you") : entry.source.type === "self" ? t("life.source.elder") : t("life.source.circle", { name: entry.source.byName });
  const about = (entry.people ?? []).map((id) => people.find((p) => p.id === id)?.title).filter(Boolean);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xl font-extrabold">{entry.title}</p>
          {entry.relationship || entry.when ? <p className="font-bold text-ink-soft">{[entry.relationship, entry.when].filter(Boolean).join(" · ")}</p> : null}
        </div>
        {entry.confirmed ? (
          <StatusBadge tone="ok" icon="check">
            {t("life.confirmed")}
          </StatusBadge>
        ) : (
          <StatusBadge tone="warn" icon="question">
            {t("life.pending")}
          </StatusBadge>
        )}
      </div>
      {entry.media ? <MediaView media={entry.media} title={entry.title} /> : null}
      {entry.detail ? <p className="whitespace-pre-wrap">{entry.detail}</p> : null}
      {about.length > 0 ? <p className="text-ink-soft">{t("life.aboutPeople", { names: about.join(", ") })}</p> : null}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="info" className="h-4 w-4" />
          {sourceLabel}
        </span>
        {canWrite ? <span>· {entry.shareWithCircle === false ? t("life.private") : t("life.shared")}</span> : null}
      </p>
      {canWrite && entry.history && entry.history.length > 0 ? (
        <details className="rounded-2xl border border-line p-3">
          <summary className="min-h-[2.5rem] cursor-pointer font-bold text-primary-strong">{t("life.history")}</summary>
          <ul className="space-y-2 pt-2">
            {entry.history.map((h) => (
              <li key={h.at} className="text-sm">
                <p className="font-bold text-ink-soft">{t("life.historyItem", { date: formatDate(h.at.slice(0, 10), locale), name: h.byName })}</p>
                <p>
                  {h.title} — {h.detail}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {canWrite ? (
        <>
          {entry.confirmed ? (
            <>
              <Toggle label={t("life.aiAllowed")} description={t("life.aiAllowedDesc")} checked={entry.aiAllowed} disabled={busy} onChange={(aiAllowed) => void run(() => repo.saveLifebookEntry(elderId, { ...entry, aiAllowed }))} />
              <Toggle label={t("life.share")} description={t("life.shareHint")} checked={entry.shareWithCircle !== false} disabled={busy} onChange={(shareWithCircle) => void run(() => repo.saveLifebookEntry(elderId, { ...entry, shareWithCircle }))} />
            </>
          ) : (
            <p className="font-bold">{t("life.confirmPrompt")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {entry.confirmed ? null : (
              <Button icon="check" busy={busy} onClick={() => void run(() => repo.saveLifebookEntry(elderId, { ...entry, confirmed: true, aiAllowed: true, updatedAt: new Date().toISOString() }))}>
                {t("life.confirm")}
              </Button>
            )}
            <Button variant="secondary" icon="edit" onClick={onEdit}>
              {t(entry.confirmed ? "common.edit" : "life.correct")}
            </Button>
            <Button variant="danger" icon="trash" busy={busy} onClick={() => void run(() => repo.deleteLifebookEntry(elderId, entry.id))}>
              {t("common.delete")}
            </Button>
          </div>
        </>
      ) : null}
      {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
    </Card>
  );
}

export default function LifebookPage() {
  const { t } = usePrefs();
  const { repo, elderId, elder, actor } = useReadySession();
  const allowed = usePolicy();
  const canWrite = allowed("lifebook:write");
  const canContribute = allowed("lifebook:contribute");
  const canSee = canWrite || canContribute || allowed("lifebook:read");
  const [category, setCategory] = useState<LifebookCategory>("people");
  const [editing, setEditing] = useState<LifebookEntry | null>(null);
  const [query, setQuery] = useState("");
  const entries = useAsyncData(() => (canSee ? repo.listLifebook(elderId) : Promise.resolve([])), [repo, elderId, canSee]);
  const isElder = actor.role === "elder";
  const all = useMemo(() => entries.data ?? [], [entries.data]);
  const conflicts = useMemo(() => (isElder ? findConflicts(all.map((e) => ({ ...e, relationship: e.relationship, when: e.when }))) : []), [all, isElder]);

  if (!canSee) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("error.noAccessBody")} />;

  const people = all.filter((e) => e.category === "people" && e.confirmed);
  const pending = all.filter((e) => !e.confirmed);
  const visible = all.filter((e) => e.confirmed || !isElder);
  const shown = query.trim() ? searchEntries(visible, query) : visible.filter((e) => e.category === category);
  const previousOf = (entry: LifebookEntry) => all.find((e) => e.id === entry.id) ?? null;
  const startNew = () => {
    const now = new Date().toISOString();
    setEditing({
      id: newId(),
      category,
      title: "",
      detail: "",
      source: { type: isElder ? "self" : "circle", byUid: actor.uid, byName: actor.name },
      confirmed: isElder,
      aiAllowed: isElder,
      // Private until the elder chooses to share it.
      shareWithCircle: false,
      createdAt: now,
      updatedAt: now,
    });
  };
  const closeForm = () => {
    setEditing(null);
    entries.reload();
  };
  const titleOf = (id: string) => all.find((e) => e.id === id)?.title ?? "";

  return (
    <>
      <PageHeader title={t("life.title")} subtitle={isElder ? t("life.subtitle") : t("life.subtitleMember", { name: elder?.preferredName ?? "" })} />

      {isElder && elder && !elder.consent.aiPersonalization ? (
        <Notice icon="shield">
          <p>{t("life.aiOffNote")}</p>
        </Notice>
      ) : null}
      {!isElder && canContribute ? (
        <Notice icon="info">
          <p>{t("life.contributeNote", { name: elder?.preferredName ?? "" })}</p>
        </Notice>
      ) : null}

      {entries.loading && !entries.data ? <Loading /> : null}
      {entries.error ? <ErrorNote error={entries.error} onRetry={entries.reload} /> : null}

      {conflicts.length > 0 && !editing ? (
        <Notice icon="question" tone="warn">
          <p className="font-bold">{t("life.conflictsTitle")}</p>
          <ul className="list-disc pl-5">
            {conflicts.map((c) => (
              <li key={c.ids.join()}>{t(c.field === "relationship" ? "life.conflictRelationship" : "life.conflictWhen", { title: titleOf(c.ids[0]) })}</li>
            ))}
          </ul>
          <p>{t("life.conflictsBody")}</p>
        </Notice>
      ) : null}

      {isElder && pending.length > 0 && !editing ? (
        <Section title={t("life.pendingTitle")} id="life-pending">
          <p className="text-ink-soft">{t("life.pendingBody")}</p>
          <ul className="space-y-3">
            {pending.map((entry) => (
              <EntryCard key={entry.id} entry={entry} people={people} canWrite onEdit={() => setEditing(entry)} onChanged={entries.reload} />
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="max-w-xl">
        <TextField label={t("life.search")} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {query.trim() ? null : (
        <nav aria-label={t("life.categories")}>
          <ul className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = c.value === category;
              return (
                <li key={c.value}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategory(c.value);
                      setEditing(null);
                    }}
                    className={`inline-flex min-h-tap items-center gap-2 rounded-pill border-2 px-4 font-extrabold ${active ? "border-primary-strong bg-primary-strong text-white" : "border-line bg-surface text-ink"}`}
                  >
                    <Icon name={c.icon} className="h-5 w-5" />
                    {t(`life.cat.${c.value}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Section
        title={query.trim() ? t("life.searchResults", { q: query.trim() }) : t(`life.cat.${category}`)}
        id="life-entries"
        action={
          (canWrite || canContribute) && !editing && !query.trim() ? (
            <Button icon="plus" onClick={startNew}>
              {t("life.add")}
            </Button>
          ) : null
        }
      >
        {query.trim() ? null : <p className="text-ink-soft">{t(`life.catDesc.${category}`)}</p>}
        {editing ? <EntryForm key={editing.id} initial={editing} previous={previousOf(editing)} people={people} isElder={isElder} onCancel={() => setEditing(null)} onDone={closeForm} /> : null}
        {entries.data && shown.length === 0 && !editing ? (
          query.trim() ? <p className="text-ink-soft">{t("life.noResults", { q: query.trim() })}</p> : <EmptyState icon="book" title={t("life.emptyTitle")} body={t("life.emptyBody")} />
        ) : null}
        {shown.length > 0 ? (
          <ul className="space-y-3">
            {shown.map((entry) => (
              <EntryCard key={entry.id} entry={entry} people={people} canWrite={canWrite} onEdit={() => setEditing(entry)} onChanged={entries.reload} />
            ))}
          </ul>
        ) : null}
      </Section>

      <Notice>
        <p>{t("life.notMedical")}</p>
      </Notice>
    </>
  );
}
