"use client";

import { useState } from "react";
import Link from "next/link";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate, newId } from "@/lib/domain/dates";
import type { HelpRequest } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  ErrorNote,
  Loading,
  Notice,
  StatusBadge,
  describeError,
} from "./ui/Feedback";
import { TextArea } from "./ui/Field";

const RECENT_MS = 24 * 60 * 60 * 1000;

function timeOf(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The elder's "I'd like some help" card. Nothing is ever sent automatically:
 * only pressing Send creates a request, and only members the elder allowed
 * to receive help are told. Not an emergency service.
 */
export function HelpRequestCard() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const data = useAsyncData(async () => {
    const [requests, circle] = await Promise.all([
      repo.listHelpRequests(elderId, 5),
      repo.listCircle(elderId),
    ]);
    return {
      requests,
      helpers: circle.filter(
        (m) => m.status === "active" && m.permissions.receiveHelp,
      ),
    };
  }, [repo, elderId]);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      data.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (data.loading && !data.data) return <Loading />;
  if (data.error) return <ErrorNote error={data.error} onRetry={data.reload} />;
  const helpers = data.data?.helpers ?? [];
  const latest = data.data?.requests.find(
    (r) =>
      r.status !== "resolved" &&
      Date.now() - Date.parse(r.createdAt) < RECENT_MS,
  );

  const send = () =>
    run(async () => {
      const request: HelpRequest = {
        id: newId(),
        createdAt: new Date().toISOString(),
        message,
        status: "open",
        acknowledgedBy: null,
        acknowledgedAt: null,
      };
      await repo.saveHelpRequest(elderId, request);
      setWriting(false);
      setMessage("");
    });

  return (
    <Card className="space-y-3">
      <p className="text-lg font-extrabold">{t("help.title")}</p>
      {latest ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <p>{t("help.sentAt", { time: timeOf(latest.createdAt, locale) })}</p>
          {latest.status === "acknowledged" && latest.acknowledgedBy ? (
            <StatusBadge tone="ok" icon="check">
              {t("help.onIt", { name: latest.acknowledgedBy.name })}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral" icon="clock">
              {t("help.waiting")}
            </StatusBadge>
          )}
          <div>
            <Button
              variant="secondary"
              icon="check"
              busy={busy}
              onClick={() =>
                void run(() =>
                  repo.saveHelpRequest(elderId, {
                    ...latest,
                    status: "resolved",
                  }),
                )
              }
            >
              {t("help.okNow")}
            </Button>
          </div>
        </div>
      ) : helpers.length === 0 ? (
        <>
          <p className="text-ink-soft">{t("help.noHelpers")}</p>
          <Link
            href="/circle"
            className="font-bold text-primary-strong underline underline-offset-4"
          >
            {t("help.setUp")}
          </Link>
        </>
      ) : writing ? (
        <div className="space-y-3">
          <p className="text-ink-soft">
            {t("help.goesTo", { names: helpers.map((h) => h.name).join(", ") })}
          </p>
          <TextArea
            label={t("help.messageLabel")}
            hint={t("help.messageHint")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <Button icon="send" busy={busy} onClick={() => void send()}>
              {t("help.send")}
            </Button>
            <Button variant="quiet" onClick={() => setWriting(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-ink-soft">{t("help.body")}</p>
          <Button icon="users" onClick={() => setWriting(true)}>
            {t("help.ask")}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="font-bold text-danger">
          {describeError(error, t)}
        </p>
      ) : null}
      <Notice>
        <p>{t("help.notEmergency")}</p>
      </Notice>
    </Card>
  );
}

/** For Care Circle members allowed to receive help: recent requests, and "I'm on it". */
export function HelpRequestsPanel() {
  const { t, locale } = usePrefs();
  const { repo, elderId, elder } = useReadySession();
  const list = useAsyncData(
    () => repo.listHelpRequests(elderId, 10),
    [repo, elderId],
  );
  const [error, setError] = useState<unknown>(null);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote error={list.error} onRetry={list.reload} />;
  const recent = list.data?.filter((r) => r.status !== "resolved") ?? [];
  if (recent.length === 0)
    return (
      <p className="text-ink-soft">
        {t("help.noneOpen", { name: elder?.preferredName ?? "" })}
      </p>
    );
  return (
    <ul className="space-y-3" aria-live="polite">
      {recent.map((r) => (
        <Card as="li" key={r.id} className="space-y-2 border-2 border-warn">
          <p className="font-extrabold">
            {t("help.askedAt", {
              name: elder?.preferredName ?? "",
              date: formatDate(r.createdAt.slice(0, 10), locale),
              time: timeOf(r.createdAt, locale),
            })}
          </p>
          {r.message ? <p className="text-lg">“{r.message}”</p> : null}
          {r.status === "acknowledged" && r.acknowledgedBy ? (
            <StatusBadge tone="ok" icon="check">
              {t("help.onIt", { name: r.acknowledgedBy.name })}
            </StatusBadge>
          ) : (
            <Button
              icon="check"
              onClick={() => {
                setError(null);
                void repo
                  .acknowledgeHelpRequest(elderId, r.id)
                  .then(list.reload, setError);
              }}
            >
              {t("help.imOnIt")}
            </Button>
          )}
        </Card>
      ))}
      {error ? <ErrorNote error={error} /> : null}
    </ul>
  );
}
