"use client";

import { User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfile } from "@/hooks/useProfile";
import { IdenticonAvatar } from "@/components/Identity/IdenticonAvatar";

/** Profile pill — quick access to the user's profile. Shows the CubeMark
 *  identicon (or the uploaded photo) flush against the square pill with no
 *  boxed tile, and the display name in the tooltip. Clicking navigates to
 *  the Profile view. */
export function ProfilePiece({ onOpenProfile }: { onOpenProfile?: () => void }) {
  const { t } = useTranslation();
  const { profile } = useProfile();

  const displayName = profile?.displayName.trim() || t("profile");

  const avatar =
    profile?.avatarKind === "photo" && profile.avatarData ? (
      <img
        src={profile.avatarData}
        alt=""
        draggable={false}
        className="size-8 object-cover"
      />
    ) : profile ? (
      <IdenticonAvatar seed={profile.userId} size={32} tile="transparent" />
    ) : (
      <User className="size-4" />
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={displayName}
          className="grid size-8 shrink-0 cursor-pointer place-items-center text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {avatar}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{displayName}</TooltipContent>
    </Tooltip>
  );
}
