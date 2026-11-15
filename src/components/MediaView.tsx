"use client";

import { useAsyncData } from "@/hooks/useAsyncData";
import type { LifebookMedia } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

/** Shows a stored photo or plays a voice memory. */
export function MediaView({ media, title }: { media: LifebookMedia; title: string }) {
  const { t } = usePrefs();
  const { repo } = useReadySession();
  const url = useAsyncData(() => repo.lifebookMediaUrl(media), [repo, media.path, media.dataUrl]);
  if (url.loading && !url.data) return <p className="text-ink-soft">{t("life.mediaLoading")}</p>;
  if (url.error || !url.data) return null;
  return media.kind === "photo" ? (
    // eslint-disable-next-line @next/next/no-img-element -- user media from Storage or a data URL; next/image cannot optimise it
    <img src={url.data} alt={t("life.mediaAlt", { title })} className="max-h-80 w-full rounded-2xl border border-line object-contain" />
  ) : (
    <audio controls preload="metadata" src={url.data} className="w-full">
      {title}
    </audio>
  );
}

