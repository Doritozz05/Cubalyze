"use client";

/**
 * LockerLinkCard.tsx — "the cube in your hand is this one" as a settings card.
 *
 * The single place where the whole hardware→Locker conversation is legible: the
 * model the cube reports, whether it is filed in the Locker, and the one action
 * that fixes it when it is not. Reads `hardwareLinkStore` (resolved by the
 * headless service) and the Locker, and never decides anything itself — every
 * branch below is a state the service can actually be in, which is what keeps
 * this honest instead of optimistic.
 *
 * Renders nothing while there is no cube: an empty card about a cube you do not
 * have would be noise in Settings.
 */

import { useTranslation } from "react-i18next";
import { Link2, Unlink, Plus, TriangleAlert } from "lucide-react";
import { useStore } from "zustand";
import { toast } from "sonner";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hardwareLinkStore } from "@/stores/hardwareLinkStore";
import { useCollectionStore } from "@/views/Collection/collectionStore";
import { cubeShortLabel } from "@/views/Collection/activeCube";

export function LockerLinkCard() {
  const { t } = useTranslation("settings");
  const collection = useCollectionStore((state) => state.data);
  const link = useStore(hardwareLinkStore);

  if (link.status === "idle") return null;

  const nameOf = (id: string | null): string | null => {
    if (!id) return null;
    const item = collection.items.find((candidate) => candidate.id === id);
    return item ? cubeShortLabel(item) : null;
  };

  const modelLabel = link.model?.label ?? link.model?.rawName ?? null;

  /** Link failures are the user's business, never a silent no-op. */
  const report = (result: { ok: boolean; reason?: string }) => {
    if (result.ok) return;
    if (result.reason === "taken") toast.error(t("smartCube.locker.errorTaken"));
    else if (result.reason === "no-target") toast.error(t("smartCube.locker.errorNoTarget"));
    else toast.error(i18n.t("toast:cubeConnectFailed"));
  };

  const linkedName = nameOf(link.itemId);

  /**
   * The one-line headline, as an explicit switch: a chain of ternaries here
   * once produced the wrong sentence for a state nobody thought about (linked,
   * but the item was gone). A `default` that returns nothing is the honest
   * fallback for "idle", which the early return above already handles.
   */
  const headline = (): string => {
    switch (link.status) {
      case "linked":
        return linkedName
          ? t("smartCube.locker.linkedTo", { name: linkedName })
          : t("smartCube.locker.unavailable");
      case "unlinked":
        return t("smartCube.locker.notLinked");
      case "conflict":
        return t("smartCube.locker.conflict");
      case "no-identity":
        return t("smartCube.locker.noAddress");
      case "unavailable":
        return t("smartCube.locker.unavailable");
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <div className="min-w-0">
        <h4 className="text-[0.85rem] font-medium text-ink">{t("smartCube.locker.title")}</h4>
        <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">{headline()}</p>
        {modelLabel ? (
          <p className="mt-1 truncate text-[0.72rem] text-ink-3/80">
            {link.model?.known === false
              ? t("smartCube.locker.unknownModel", { name: modelLabel })
              : modelLabel}
          </p>
        ) : null}
      </div>

      {/* The one sentence that explains the state, only when there is one. */}
      {link.status === "linked" && link.suppressed ? (
        <Note>{t("smartCube.locker.suppressedHint")}</Note>
      ) : null}
      {link.status === "unlinked" ? (
        <Note>{t("smartCube.locker.notLinkedHint")}</Note>
      ) : null}
      {link.status === "conflict" ? <Note warn>{t("smartCube.locker.conflictHint")}</Note> : null}
      {link.status === "no-identity" ? <Note>{t("smartCube.locker.noAddressHint")}</Note> : null}
      {link.status === "unavailable" ? (
        <Note warn>
          {link.unavailableReason === "not-owned"
            ? t("smartCube.locker.soldOrLent", { name: linkedName ?? t("smartCube.locker.thisCube") })
            : t("smartCube.locker.noEventHint")}
        </Note>
      ) : null}

      {/* Candidates: several items could be the cube, so the user picks. */}
      {link.status === "unlinked" && link.candidateIds.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[0.75rem] font-medium text-ink-2">{t("smartCube.locker.chooseWhich")}</p>
          {link.candidateIds.map((id) => {
            const name = nameOf(id);
            if (!name) return null;
            return (
              <Button
                key={id}
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => report(link.linkTo(id))}
              >
                <Link2 className="size-3.5 shrink-0" />
                <span className="truncate">{name}</span>
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {link.status === "linked" ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => link.unlink()}
          >
            <Unlink className="size-3.5" />
            {t("smartCube.locker.unlink")}
          </Button>
        ) : null}

        {link.status === "unlinked" && link.canCreate ? (
          <Button
            size="sm"
            className="gap-2 text-xs"
            onClick={() => report(link.createFromHardware())}
          >
            <Plus className="size-3.5" />
            {t("smartCube.locker.addToLocker")}
          </Button>
        ) : null}

        {link.status === "unlinked" ? (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => link.dismissOffer()}>
            {t("smartCube.locker.notNow")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Note({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-[0.74rem] leading-relaxed",
        warn ? "text-ink-2" : "text-ink-3",
      )}
    >
      {warn ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> : null}
      <span className="min-w-0">{children}</span>
    </p>
  );
}
