"use client";

/**
 * FriendsView — the section itself: add, list, manage, and walk into a
 * friend's page.
 *
 * The screen is built around one product rule from the plan: **without a
 * handle nobody can find you**, so the handle is a prerequisite for the social
 * half, not a profile nicety. When there is no handle yet the section still
 * renders (your lists, your blocked people, your pending requests are all
 * yours), but adding is disabled and the reason is stated — no silent failure.
 *
 * The two destructive actions share ONE confirmation dialog driven from here,
 * so "eliminar" and "bloquear" behave identically wherever they are triggered
 * (card menu, detail page). Both explain what actually happens, including the
 * part that surprises people: removing a friend does not tell them, and
 * unblocking does not bring the friendship back (D3/D6).
 */

import { useEffect, useState } from "react";
import { Ban, Clock, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { GoogleIcon } from "@/components/Account/GoogleIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/hooks/useProfile";
import { useAccount } from "@/hooks/useAccount";
import { useFriendActions, useFriendDirectory } from "@/hooks/useFriends";
import { AddFriendForm } from "./components/AddFriendForm";
import { FriendCard } from "./components/FriendCard";
import { FriendAvatar } from "./components/FriendAvatar";
import { HandleClaimCard } from "./components/HandleClaimCard";
import { RequestsPanels } from "./components/RequestsPanels";
import { FriendDetailView } from "./FriendDetailView";
import { consumeFriendSelection } from "./friendSelection";
import { displayNameOf, FRIEND_FAILURE_KEY } from "./friendsCopy";
import type { FriendsResult } from "@/services/friends";
import { cn } from "@/lib/utils";

type Confirm = { kind: "remove" | "block" | "unblock"; userId: string; name: string } | null;

export interface FriendsViewProps {
  /**
   * Opens Settings pre-selected to *Privacidad y amigos*.
   *
   * Deliberately NOT the same hook the Profile screen gets: that one opens the
   * profile editor, and the "¿qué comparto?" shortcut here asks a different
   * question — the four consent switches. Sharing one callback sent it to the
   * profile editor, which answers nothing.
   */
  onOpenPrivacySettings?: () => void;
}

export function FriendsView({ onOpenPrivacySettings }: FriendsViewProps) {
  const { t } = useTranslation("friends");
  const { profile } = useProfile();
  const { user, configured, signInWithGoogle } = useAccount();
  // The directory is account data: without a session the read can only 401, so
  // it is not attempted at all (the signed-out card below is the whole screen).
  const { data, loading, error } = useFriendDirectory({ enabled: Boolean(user) });
  const actions = useFriendActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Cross-view handoff (e.g. profile friends panel): open the staged friend
  // once, then clear the slot so later visits start unselected.
  useEffect(() => {
    const pending = consumeFriendSelection();
    if (pending) setSelected(pending);
  }, []);

  const handle = profile?.handle ?? "";
  const friends = data?.friends ?? [];
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const blocked = data?.blocked ?? [];

  /**
   * Run a fire-and-forget action (accept, decline, cancel) and REPORT the
   * outcome. These used to be `void actions.accept(...)`, which turned a
   * refusal into a silent no-op: the row stays and the user thinks the app is
   * broken. A rejection here is always a sentence.
   */
  async function runAction(run: () => Promise<FriendsResult<unknown>>) {
    const res = await run();
    if (!res.ok) toast.error(t(FRIEND_FAILURE_KEY[res.reason]));
  }

  async function runConfirmed() {
    if (!confirm) return;
    const { kind, userId } = confirm;
    setConfirm(null);
    const res =
      kind === "remove"
        ? await actions.remove(userId)
        : kind === "block"
          ? await actions.block(userId)
          : await actions.unblock(userId);
    if (res.ok) {
      if (kind !== "unblock" && selected === userId) setSelected(null);
      toast.success(
        kind === "remove"
          ? t("toast.removed")
          : kind === "block"
            ? t("toast.blocked")
            : t("toast.unblocked"),
      );
    } else {
      toast.error(t(FRIEND_FAILURE_KEY[res.reason]));
    }
  }

  /**
   * Sign in with Google, from here.
   *
   * The signed-out screen used to send people to Settings, which was honest
   * but a detour: the thing they came to do (add a friend) needs an account,
   * and an account is one click. A full-page OAuth redirect does not come back
   * to this handler, so `busy` stays on until the browser leaves.
   */
  async function handleGoogle() {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("[FriendsView] sign-in failed:", err);
      setAuthError(t("signedOut.authError"));
      setAuthBusy(false);
    }
  }

  if (selected) {
    const entry = friends.find((f) => f.profile.userId === selected);
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <FriendDetailView
          userId={selected}
          fallbackName={entry ? displayNameOf(entry.profile) : undefined}
          onBack={() => setSelected(null)}
          busy={actions.busy}
          onRemove={(userId) =>
            setConfirm({
              kind: "remove",
              userId,
              name: entry ? displayNameOf(entry.profile) : "",
            })
          }
          onBlock={(userId) =>
            setConfirm({
              kind: "block",
              userId,
              name: entry ? displayNameOf(entry.profile) : "",
            })
          }
        />
      </div>
    );
  }

  // Friends only exist in an account, so the section is honest about it
  // instead of offering a handle claim and a form that cannot work.
  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-2xl border border-line bg-surface-2/50 text-ink-3">
          <Users className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-base font-semibold text-ink">{t("signedOut.title")}</h1>
        <p className="max-w-md text-[0.82rem] leading-5 text-ink-3">
          {t("signedOut.description")}
        </p>
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={authBusy || !configured}
          className="mt-1 inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {authBusy ? <Spinner size="xs" /> : <GoogleIcon size={16} />}
          {t("signedOut.continueWithGoogle")}
        </button>
        {authError && (
          <p role="alert" className="text-[0.7rem] text-dnf">
            {authError}
          </p>
        )}
        {!configured && (
          <p className="text-[0.7rem] text-caution">{t("signedOut.notConfigured")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
          {t("title")}
        </h1>
        {onOpenPrivacySettings && (
          <button
            type="button"
            onClick={onOpenPrivacySettings}
            className="cursor-pointer text-[0.68rem] text-ink-3 underline decoration-dotted transition-colors hover:text-ink"
          >
            {t("sharing.shortcut")}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <HandleClaimCard current={handle} />

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[0.85rem] font-semibold text-ink">{t("add.title")}</h2>
          <p className="mb-3 mt-1 text-[0.78rem] leading-5 text-ink-3">
            {handle ? t("add.description") : t("add.needsHandle")}
          </p>
          {handle ? (
            <AddFriendForm onAccepted={(userId) => setSelected(userId)} />
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[0.75rem] text-ink-3">
              {t("add.claimFirst")}
            </p>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl border border-line bg-surface p-3 text-[0.78rem] text-dnf">
            {t(FRIEND_FAILURE_KEY[error])}
          </p>
        )}

        <Tabs defaultValue="friends">
          <TabsList
            aria-label={t("tabsAria")}
            className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-1 py-1.5 [scrollbar-width:thin]"
          >
            <TabsTrigger
              value="friends"
              className="h-8 shrink-0 rounded-lg border border-transparent px-3 text-xs font-medium transition-all data-[state=active]:border-line data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <Users className="mr-1.5 size-3.5" aria-hidden="true" />
              {t("tabs.friends", { count: friends.length })}
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="h-8 shrink-0 rounded-lg border border-transparent px-3 text-xs font-medium transition-all data-[state=active]:border-line data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <Clock className="mr-1.5 size-3.5" aria-hidden="true" />
              {incoming.length > 0
                ? t("tabs.requestsWithCount", { count: incoming.length })
                : t("tabs.requests")}
            </TabsTrigger>
            <TabsTrigger
              value="blocked"
              className="h-8 shrink-0 rounded-lg border border-transparent px-3 text-xs font-medium transition-all data-[state=active]:border-line data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <Ban className="mr-1.5 size-3.5" aria-hidden="true" />
              {t("tabs.blocked", { count: blocked.length })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            {loading && !data ? (
              <div className="flex justify-center py-10">
                <Spinner size="sm" label={t("loading")} />
              </div>
            ) : friends.length === 0 ? (
              <EmptyFriends />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {friends.map((entry) => (
                  <FriendCard
                    key={entry.profile.userId}
                    entry={entry}
                    busy={actions.busy}
                    onOpen={setSelected}
                    onRemove={(userId) =>
                      setConfirm({ kind: "remove", userId, name: displayNameOf(entry.profile) })
                    }
                    onBlock={(userId) =>
                      setConfirm({ kind: "block", userId, name: displayNameOf(entry.profile) })
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <RequestsPanels
              incoming={incoming}
              outgoing={outgoing}
              busy={actions.busy}
              onAccept={(userId) => void runAction(() => actions.accept(userId))}
              onDecline={(userId) => void runAction(() => actions.decline(userId))}
              onCancel={(userId) => void runAction(() => actions.cancel(userId))}
              onBlock={(userId) => {
                const req = incoming.find((r) => r.profile.userId === userId);
                setConfirm({
                  kind: "block",
                  userId,
                  name: req ? displayNameOf(req.profile) : "",
                });
              }}
            />
          </TabsContent>

          <TabsContent value="blocked" className="mt-4">
            {blocked.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[0.78rem] text-ink-3">
                {t("blocked.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {blocked.map((person) => (
                  <li
                    key={person.userId}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"
                  >
                    <FriendAvatar profile={person} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.82rem] text-ink">
                        {displayNameOf(person) || t("card.unnamed")}
                      </p>
                      <p className="truncate font-mono text-[0.68rem] text-ink-3">
                        {person.handle ? `@${person.handle}` : t("card.noHandle")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={actions.busy}
                      onClick={() =>
                        setConfirm({
                          kind: "unblock",
                          userId: person.userId,
                          name: displayNameOf(person),
                        })
                      }
                      className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg border border-line px-3 text-[0.72rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                    >
                      {t("blocked.unblock")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "block"
                ? t("confirm.blockTitle", { name: confirm.name })
                : confirm?.kind === "unblock"
                  ? t("confirm.unblockTitle", { name: confirm?.name })
                  : t("confirm.removeTitle", { name: confirm?.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "block"
                ? t("confirm.blockBody")
                : confirm?.kind === "unblock"
                  ? t("confirm.unblockBody")
                  : t("confirm.removeBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t("confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={cn("cursor-pointer", confirm?.kind !== "unblock" && "bg-dnf text-surface hover:bg-dnf/90")}
              onClick={(e) => {
                e.preventDefault();
                void runConfirmed();
              }}
            >
              {confirm?.kind === "block"
                ? t("confirm.block")
                : confirm?.kind === "unblock"
                  ? t("blocked.unblock")
                  : t("confirm.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyFriends() {
  const { t } = useTranslation("friends");
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-xl border border-line bg-surface-2/50 text-ink-3">
        <UserPlus className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-[0.85rem] font-semibold text-ink">{t("empty.title")}</p>
      <p className="mx-auto mt-1 max-w-sm text-[0.78rem] leading-5 text-ink-3">
        {t("empty.description")}
      </p>
    </div>
  );
}
