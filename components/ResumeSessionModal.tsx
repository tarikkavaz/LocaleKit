"use client";

import { useTranslations } from "next-intl";
import { getLanguageByCode } from "@/lib/languages";
import type { TranslationSession } from "@/lib/translation-session";
import { formatDistanceToNow } from "@/lib/utils";

interface ResumeSessionModalProps {
  isOpen: boolean;
  session: TranslationSession | null;
  onContinue: () => void;
  onStartFresh: () => void;
}

export default function ResumeSessionModal({
  isOpen,
  session,
  onContinue,
  onStartFresh,
}: ResumeSessionModalProps) {
  const t = useTranslations();

  if (!isOpen || !session) {
    return null;
  }

  const completedCount = session.completedLanguages.length;
  const failedCount = session.failedLanguages.length;
  const pendingCount = session.pendingLanguages.length;
  const totalCount = session.targetLanguages.length;

  const startTimeDate = new Date(session.startTime);
  const timeAgo = formatDistanceToNow(session.startTime);

  const getLanguageName = (code: string): string => {
    const lang = getLanguageByCode(code);
    return lang?.name || code;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "var(--color-modal-backdrop)" }}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-card-bg rounded-lg shadow-xl p-6"
        style={{ backgroundColor: "var(--card-bg-solid)" }}
      >
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {t("resumeSession.title")}
        </h2>

        <p className="text-sm text-foreground/80 mb-4">
          {t("resumeSession.message")}
        </p>

        {/* Session Statistics */}
        <div className="mb-4 p-3 bg-foreground/5 rounded-lg">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2">
              <p className="text-2xl font-bold text-success-text">
                {completedCount}
              </p>
              <p className="text-xs text-foreground/60">
                {t("resumeSession.completed")}
              </p>
            </div>
            <div className="p-2">
              <p className="text-2xl font-bold text-error-text">
                {failedCount}
              </p>
              <p className="text-xs text-foreground/60">
                {t("resumeSession.failed")}
              </p>
            </div>
            <div className="p-2">
              <p className="text-2xl font-bold text-primary">{pendingCount}</p>
              <p className="text-xs text-foreground/60">
                {t("resumeSession.pending")}
              </p>
            </div>
          </div>
          <p className="text-center text-xs text-foreground/50 mt-2">
            {t("resumeSession.totalLanguages", { count: totalCount })}
          </p>
        </div>

        {/* Session Metadata */}
        <div className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground/60">
              {t("resumeSession.started")}
            </span>
            <span className="text-foreground">
              {timeAgo} ({startTimeDate.toLocaleDateString()})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/60">
              {t("resumeSession.model")}
            </span>
            <span className="text-foreground">{session.model}</span>
          </div>
          {session.sourceLanguage && (
            <div className="flex justify-between">
              <span className="text-foreground/60">
                {t("resumeSession.sourceLanguage")}
              </span>
              <span className="text-foreground">
                {getLanguageName(session.sourceLanguage)}
              </span>
            </div>
          )}
        </div>

        {/* Pending Languages Preview */}
        {pendingCount > 0 && (
          <div className="mb-4">
            <p className="text-xs text-foreground/60 mb-2">
              {t("resumeSession.pendingLanguages")}
            </p>
            <div className="flex flex-wrap gap-1">
              {session.pendingLanguages.slice(0, 5).map((code) => (
                <span
                  key={code}
                  className="px-2 py-1 text-xs bg-primary/20 text-primary rounded"
                >
                  {getLanguageName(code)}
                </span>
              ))}
              {pendingCount > 5 && (
                <span className="px-2 py-1 text-xs bg-foreground/10 text-foreground/60 rounded">
                  +{pendingCount - 5} {t("resumeSession.more")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onStartFresh}
            className="flex-1 px-4 py-2 text-sm font-medium bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors"
          >
            {t("resumeSession.startFresh")}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
          >
            {t("resumeSession.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
