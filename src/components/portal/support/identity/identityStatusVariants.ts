import type { IdentityStatus } from "@/api/identitySupportInvoke";
import { ShieldPlus, Clock, ShieldCheck, RefreshCw, ShieldAlert, type LucideIcon } from "lucide-react";

export type IdentityVariantTone = "primary" | "warning" | "success" | "destructive";

export interface IdentityVariantConfig {
  tone: IdentityVariantTone;
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
  ctaKey?: string;
  showCta: boolean;
  iconSpinSlow?: boolean;
}

export const IDENTITY_VARIANTS: Record<IdentityStatus, IdentityVariantConfig> = {
  none: {
    tone: "primary",
    icon: ShieldPlus,
    titleKey: "portal.support.identity.state.none.title",
    bodyKey: "portal.support.identity.state.none.body",
    ctaKey: "portal.support.identity.state.none.cta",
    showCta: true,
  },
  pending: {
    tone: "warning",
    icon: Clock,
    titleKey: "portal.support.identity.state.pending.title",
    bodyKey: "portal.support.identity.state.pending.body",
    showCta: false,
    iconSpinSlow: true,
  },
  approved: {
    tone: "success",
    icon: ShieldCheck,
    titleKey: "portal.support.identity.state.approved.title",
    bodyKey: "portal.support.identity.state.approved.body",
    showCta: false,
  },
  reupload_required: {
    tone: "warning",
    icon: RefreshCw,
    titleKey: "portal.support.identity.state.reupload_required.title",
    bodyKey: "portal.support.identity.state.reupload_required.body",
    ctaKey: "portal.support.identity.state.reupload_required.cta",
    showCta: true,
  },
  rejected: {
    tone: "destructive",
    icon: ShieldAlert,
    titleKey: "portal.support.identity.state.rejected.title",
    bodyKey: "portal.support.identity.state.rejected.body",
    ctaKey: "portal.support.identity.state.rejected.cta",
    showCta: true,
  },
};

/** Tailwind classes per tone — uses semantic design tokens only. */
export const TONE_CLASSES: Record<IdentityVariantTone, {
  iconWrap: string;
  iconColor: string;
  border: string;
  ring: string;
  ctaClass: string;
  dot: string;
}> = {
  primary: {
    iconWrap: "bg-primary/10",
    iconColor: "text-primary",
    border: "border-s-primary",
    ring: "ring-primary/15",
    ctaClass: "bg-primary text-primary-foreground hover:bg-primary/90",
    dot: "bg-primary",
  },
  warning: {
    iconWrap: "bg-warning/10",
    iconColor: "text-warning",
    border: "border-s-warning",
    ring: "ring-warning/20",
    ctaClass: "bg-warning text-warning-foreground hover:bg-warning/90",
    dot: "bg-warning",
  },
  success: {
    iconWrap: "bg-success/10",
    iconColor: "text-success",
    border: "border-s-success",
    ring: "ring-success/20",
    ctaClass: "bg-success text-success-foreground hover:bg-success/90",
    dot: "bg-success",
  },
  destructive: {
    iconWrap: "bg-destructive/10",
    iconColor: "text-destructive",
    border: "border-s-destructive",
    ring: "ring-destructive/20",
    ctaClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    dot: "bg-destructive",
  },
};
