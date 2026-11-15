"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HelpRequestCard } from "@/components/HelpRequest";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Card";
import { Checkbox, ChoiceGroup, type ChoiceOption } from "@/components/ui/Choice";
import { EmptyState, ErrorNote, Loading, Notice, describeError } from "@/components/ui/Feedback";
import { TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { usePolicy } from "@/hooks/usePolicy";
import { describeCheckin } from "@/lib/domain/checkinText";
import { formatDate, formatTime, newId, toDateKey, toTimeKey } from "@/lib/domain/dates";
import { followUpSchedule } from "@/lib/domain/schedule";
import { useSpeech } from "@/lib/ai/useSpeech";
import type { MessageKey, Translate } from "@/lib/i18n";
import type { AssistanceLevel, Checkin, Scale } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";
import { useReadySession } from "@/state/SessionProvider";

const SCALE_EMOJI: Record<Scale, string> = { 1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };
const SCALES: readonly Scale[] = [1, 2, 3, 4, 5];

function scaleOptions(t: Translate, prefix: "mood" | "sleep" | "energy"): ChoiceOption<Scale>[] {
  return SCALES.map((value) => ({ value, label: t(`checkin.${prefix}.${value}` as MessageKey), emoji: prefix === "mood" ? SCALE_EMOJI[value] : undefined }));
}

/** After a hard day, the elder may ask for a gentle reminder later today. Only they are reminded. */
function FollowUpOffer() {
  const { t, locale } = usePrefs();
  const { repo, elderId, actor } = useReadySession();
  const [setFor, setSetFor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const schedule = async (hours: number) => {
    setError(null);
    const now = new Date();
    const later = new Date(now.getTime() + hours * 3_600_000);
    if (toDateKey(later) !== toDateKey(now)) return;
    const time = toTimeKey(later);
    try {
      await repo.saveSchedule(elderId, followUpSchedule(actor, t("sched.followUp"), time, toDateKey(now), now));
      setSetFor(time);
    } catch (e) {
      setError(e);
    }
  };
  const hoursLeft = 23 - new Date().getHours();
  if (hoursLeft < 1) return null;
  return (
    <Card className="space-y-3 text-left">
      <p className="font-extrabold">{t("checkin.followTitle")}</p>
      {setFor ? (
        <p role="status" className="font-bold text-ok">
          {t("checkin.followSet", { time: formatTime(setFor, locale) })}
        </p>
      ) : (
        <>
          <p className="text-ink-soft">{t("checkin.followBody")}</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].filter((h) => h <= hoursLeft).map((h) => (
              <Button key={h} variant="secondary" icon="clock" onClick={() => void schedule(h)}>
                {t("checkin.followIn", { n: h })}
              </Button>
            ))}
          </div>
        </>
      )}
      {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
    </Card>
  );
}

export default function CheckinPage() {
  const { t, locale } = usePrefs();
  const { repo, elderId } = useReadySession();
  const speech = useSpeech(locale, "neutral");
  const [historySize, setHistorySize] = useState(7);
  const allowed = usePolicy();
  const canWrite = allowed("checkins:write");
  const [mood, setMood] = useState<Scale | null>(null);
  const [sleep, setSleep] = useState<Scale | null>(null);
  const [energy, setEnergy] = useState<Scale | null>(null);
  const [assistance, setAssistance] = useState<AssistanceLevel | null>(null);
  const [note, setNote] = useState("");
  const [share, setShare] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<Checkin | null>(null);
  const history = useAsyncData(() => (canWrite ? repo.listCheckins(elderId, historySize + 1) : Promise.resolve([])), [repo, elderId, canWrite, historySize]);

  useEffect(() => {
    setSlot(new URLSearchParams(window.location.search).get("slot"));
  }, []);

  if (!canWrite) return <EmptyState icon="shield" title={t("error.noAccessTitle")} body={t("error.noAccessBody")} />;

  const complete = mood !== null && sleep !== null && energy !== null && assistance !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mood === null || sleep === null || energy === null || assistance === null) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const checkin: Checkin = { id: newId(), dateKey: toDateKey(now), createdAt: now.toISOString(), mood, sleep, energy, assistance, note, shareWithCircle: share, scheduleId: slot };
      await repo.saveCheckin(elderId, checkin);
      setSaved(checkin);
      history.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await repo.deleteCheckin(elderId, id);
      history.reload();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <PageHeader title={t("checkin.title")} subtitle={t("checkin.subtitle")} />

      {saved ? (
        <Card className="space-y-3 text-center">
          <Icon name="check" className="mx-auto h-12 w-12 text-ok" />
          <h2 className="text-2xl font-extrabold">{t("checkin.savedTitle")}</h2>
          <p className="text-ink-soft">{saved.shareWithCircle ? t("checkin.savedShared") : t("checkin.savedPrivate")}</p>
          {saved.assistance !== "none" ? (
            <div className="text-left">
              <HelpRequestCard />
            </div>
          ) : null}
          {saved.mood <= 2 || saved.energy <= 2 || saved.assistance !== "none" ? <FollowUpOffer /> : null}
          <ButtonLink href="/home" size="lg" icon="home">
            {t("nav.home")}
          </ButtonLink>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-6" noValidate>
            <ChoiceGroup legend={t("checkin.moodQ")} options={scaleOptions(t, "mood")} value={mood} onChange={setMood} />
            <ChoiceGroup legend={t("checkin.sleepQ")} options={scaleOptions(t, "sleep")} value={sleep} onChange={setSleep} />
            <ChoiceGroup legend={t("checkin.energyQ")} options={scaleOptions(t, "energy")} value={energy} onChange={setEnergy} />
            <ChoiceGroup
              legend={t("checkin.assistQ")}
              columns="grid-cols-1 sm:grid-cols-3"
              value={assistance}
              onChange={setAssistance}
              options={[
                { value: "none", label: t("checkin.assist.none") },
                { value: "little", label: t("checkin.assist.little") },
                { value: "lot", label: t("checkin.assist.lot") },
              ]}
            />
            <TextArea label={t("checkin.note")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            {speech.canListen ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  icon={speech.listening ? "stop" : "mic"}
                  aria-pressed={speech.listening}
                  onClick={() => (speech.listening ? speech.stopListening() : speech.listen((spoken) => setNote((current) => (current ? `${current} ${spoken}` : spoken).slice(0, 1000))))}
                >
                  {t("checkin.speak")}
                </Button>
                {speech.listening ? (
                  <p role="status" className="font-bold text-primary-strong">
                    {speech.interim || t("checkin.listening")}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Checkbox label={t("checkin.share")} checked={share} onChange={setShare}>
              {t("checkin.shareHint")}
            </Checkbox>
            {error ? <p role="alert" className="font-bold text-danger">{describeError(error, t)}</p> : null}
            <Button type="submit" size="lg" icon="check" busy={busy} disabled={!complete}>
              {t("checkin.save")}
            </Button>
            {complete ? null : <p className="text-sm text-ink-soft">{t("checkin.answerAll")}</p>}
          </form>
        </Card>
      )}

      <Notice>
        <p>{t("checkin.notMedical")}</p>
      </Notice>

      <Section title={t("checkin.history")} id="checkin-history">
        {history.loading && !history.data ? <Loading /> : null}
        {history.error ? <ErrorNote error={history.error} onRetry={history.reload} /> : null}
        {history.data && history.data.length === 0 ? <EmptyState icon="heart" title={t("checkin.emptyTitle")} /> : null}
        {history.data && history.data.length > 0 ? (
          <ul className="space-y-3">
            {history.data.slice(0, historySize).map((c) => (
              <Card as="li" key={c.id} className="space-y-2">
                <p className="font-extrabold">
                  {formatDate(c.dateKey, locale)} · {new Date(c.createdAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
                </p>
                <p>{describeCheckin(c, t)}</p>
                {c.note ? <p className="text-ink-soft">{c.note}</p> : null}
                <p className="text-sm font-bold text-ink-soft">{c.shareWithCircle ? t("checkin.isShared") : t("checkin.isPrivate")}</p>
                <Button variant="danger" icon="trash" onClick={() => void remove(c.id)}>
                  {t("common.delete")}
                </Button>
              </Card>
            ))}
          </ul>
        ) : null}
        {history.data && history.data.length > historySize ? (
          <Button variant="secondary" onClick={() => setHistorySize((n) => n + 14)}>
            {t("checkin.showMore")}
          </Button>
        ) : null}
      </Section>
    </>
  );
}
