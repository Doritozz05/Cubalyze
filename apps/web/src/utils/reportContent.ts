/**
 * Content-report mailto builder.
 *
 * Reporting is email-based on purpose: Cubalyze is a hobby without a
 * moderation team, so a report opens the user's mail app addressed to the
 * maintainer with the facts pre-filled (who, what, when). The subject/body
 * TEXT lives in the `friends.report` i18n namespace (EN+ES); this module only
 * assembles a valid `mailto:` URL from it.
 */
export interface ReportMailtoInput {
  to: string;
  subject: string;
  body: string;
}

export function buildReportMailto({ to, subject, body }: ReportMailtoInput): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
