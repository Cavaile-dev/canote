import React from "react";
import { useTranslation } from "react-i18next";
import { Gift, LogOut, Sliders } from "./icons";
import MemberAvatar from "./MemberAvatar";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useAuth } from "../hooks/useAuth";
import { useUsage } from "../hooks/useUsage";
import { useAccountPlan } from "../hooks/useAccountPlan";

const triggerClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none transition-opacity duration-150 hover:opacity-85 active:opacity-75 focus-visible:ring-2 focus-visible:ring-primary/40";
const itemClass = "gap-2.5 px-2 py-1.5 text-[13px]";
const itemIconClass = "shrink-0 text-foreground/60";

interface ProfileMenuProps {
  onOpenSettings: (section: string) => void;
  onOpenReferrals: () => void;
  onSignOut: () => void;
}

export default function ProfileMenu({
  onOpenSettings,
  onOpenReferrals,
  onSignOut,
}: ProfileMenuProps): React.ReactElement {
  const { t } = useTranslation();
  const { isSignedIn, isLoaded, user } = useAuth();
  const usage = useUsage();
  const { planLabel } = useAccountPlan(usage);

  // Hold the slot until the session settles to avoid flashing the wrong menu.
  if (!isLoaded) return <span aria-hidden="true" className="h-8 w-8 shrink-0" />;

  // Signed-out users can open app settings directly.
  if (!isSignedIn || !user) {
    return (
      <button
        type="button"
        onClick={() => onOpenSettings("general")}
        aria-label={t("sidebar.settings")}
        title={t("sidebar.settings")}
        className={triggerClass}
      >
        <Sliders size={20} className="text-foreground/55" />
      </button>
    );
  }

  const name = user.name || t("sidebar.defaultUser");

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label={t("sidebar.accountMenu", { name })} className={triggerClass}>
        <MemberAvatar name={user.name} email={user.email} image={user.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2.5 px-2 pt-1 pb-2">
          <MemberAvatar name={user.name} email={user.email} image={user.image} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p dir="auto" className="min-w-0 truncate text-[13px] font-medium text-foreground">
                {name}
              </p>
              {planLabel && (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-medium">
                  {planLabel}
                </Badge>
              )}
            </div>
            {user.email && (
              <p className="truncate text-[11px] text-muted-foreground">
                <bdi dir="ltr">{user.email}</bdi>
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenSettings("general")} className={itemClass}>
          <Sliders size={15} className={itemIconClass} />
          {t("sidebar.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenReferrals} className={itemClass}>
          <Gift size={15} className={itemIconClass} />
          {t("sidebar.referral")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className={itemClass}>
          <LogOut size={15} className={itemIconClass} />
          {t("settingsPage.account.signOut.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
