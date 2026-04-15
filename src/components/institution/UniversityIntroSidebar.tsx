import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe, MapPin, Phone, Mail, Users, Clock, DollarSign,
  ExternalLink, Pencil, Check, X, Building2, Shield,
  GraduationCap, Instagram, Youtube, Linkedin, MessageCircle,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


interface SectionDef {
  id: string;
  labelKey: string;
}

interface UniversityIntroSidebarProps {
  item: any;
  uniName: string;
  countryName: string;
  programsCount: number;
  canControl: boolean;
  money: (v?: number | null, c?: string | null) => string;
  aboutText?: string;
  sections?: SectionDef[];
  activeSection?: string;
  onSectionClick?: (id: string) => void;
  onEditDetails?: () => void;
  contactVisible?: boolean;
}

export function UniversityIntroSidebar({
  item,
  uniName,
  countryName,
  programsCount,
  canControl,
  money,
  aboutText,
  contactVisible = true,
}: UniversityIntroSidebarProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [detailsMode, setDetailsMode] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, any>>({});

  const startEdit = useCallback((fieldKey: string, currentValue: string) => {
    setEditingField(fieldKey);
    setEditValue(currentValue || "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  const saveField = useCallback(async (fieldKey: string, dbColumn: string) => {
    setSaving(true);
    try {
      const universityId = item.id || item.university_id;
      const { data, error } = await supabase.functions.invoke('institution-page-edit', {
        body: {
          action: 'submit',
          university_id: universityId,
          block_type: 'contact',
          payload: { [dbColumn]: editValue || null },
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed');

      setLocalOverrides(prev => ({ ...prev, [fieldKey]: editValue }));
      setEditingField(null);
      toast({ title: t("institution.intro.saved") });
    } catch (err: any) {
      console.error('Save field error:', err);
      toast({ title: t("institution.intro.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editValue, item, toast, t]);

  const saveSocialField = useCallback(async (socialKey: string) => {
    setSaving(true);
    try {
      const universityId = item.id || item.university_id;
      const { data, error } = await supabase.functions.invoke('institution-page-edit', {
        body: {
          action: 'submit',
          university_id: universityId,
          block_type: 'social',
          payload: { social_links: { [socialKey]: editValue || null } },
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed');

      setLocalOverrides(prev => ({
        ...prev,
        _social_links: { ...(prev._social_links || {}), [socialKey]: editValue },
      }));
      setEditingField(null);
      toast({ title: t("institution.intro.saved") });
    } catch (err: any) {
      console.error('Save social field error:', err);
      toast({ title: t("institution.intro.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editValue, item, localOverrides, toast, t]);

  const getVal = (key: string, original: any) => localOverrides[key] ?? original;

  const socialLinks = {
    ...(typeof item?.social_links === 'object' && item.social_links ? item.social_links : {}),
    ...(localOverrides._social_links || {}),
  } as Record<string, string | null>;

  const website = getVal("website", item?.website);
  const phone = getVal("phone", item?.phone);
  const email = getVal("email", item?.email);
  const description = getVal("description", aboutText);
  const foundedYear = item?.founded_year;
  const uniType = item?.university_type;
  const enrolledStudents = item?.enrolled_students;
  const internationalStudents = item?.international_students;
  const acceptanceRate = item?.acceptance_rate;
  const annualFees = item?.annual_fees;

  const renderEditableRow = (
    icon: React.ReactNode,
    label: string,
    value: string | undefined | null,
    fieldKey: string,
    onSave: () => void,
    type: "text" | "textarea" | "url" | "email" | "tel" = "text"
  ) => {
    const isEditing = editingField === fieldKey;
    const displayVal = value || null;

    // Hide empty fields unless the operator explicitly enters details mode
    if (!displayVal && !(canControl && detailsMode)) return null;

    return (
      <div className="fb-intro__row" key={fieldKey}>
        <div className="fb-intro__row-icon">{icon}</div>
        <div className="fb-intro__row-content">
          {isEditing ? (
            <div className="fb-intro__edit-form">
              {type === "textarea" ? (
                <Textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="text-sm min-h-[60px]"
                  autoFocus
                />
              ) : (
                <Input
                  type={type}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="text-sm h-8"
                  autoFocus
                />
              )}
              <div className="flex gap-1 mt-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onSave} disabled={saving}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="fb-intro__row-display">
              {displayVal ? (
                type === "url" ? (
                  <a href={displayVal.startsWith("http") ? displayVal : `https://${displayVal}`} target="_blank" rel="noopener noreferrer" className="fb-intro__link">
                    {displayVal.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3 inline-block ms-1 opacity-60" />
                  </a>
                ) : type === "tel" ? (
                  <a href={`tel:${displayVal}`} className="fb-intro__value">{displayVal}</a>
                ) : type === "email" ? (
                  <a href={`mailto:${displayVal}`} className="fb-intro__link">{displayVal}</a>
                ) : (
                  <span className="fb-intro__value">{displayVal}</span>
                )
              ) : (
                <span className="fb-intro__empty">
                  {t("institution.intro.addField", { field: label })}
                </span>
              )}
              {canControl && (
                <button
                  type="button"
                  className={`fb-intro__edit-btn ${detailsMode ? "fb-intro__edit-btn--visible" : ""}`}
                  onClick={() => startEdit(fieldKey, displayVal || "")}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          <span className="fb-intro__label">{label}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fb-intro">
      <div className="fb-intro__header">
        <h3 className="fb-intro__heading">{t("institution.intro.title")}</h3>
        {canControl && (
          <button
            type="button"
            className={`fb-intro__manage-btn ${detailsMode ? "fb-intro__manage-btn--active" : ""}`}
            onClick={() => {
              if (detailsMode && editingField && editingField !== "description") {
                cancelEdit();
              }
              setDetailsMode(prev => !prev);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{t("institution.intro.editDetails")}</span>
          </button>
        )}
      </div>

      {/* Bio / Description */}
      {description && (
        <div className="fb-intro__bio-wrap">
          <p className="fb-intro__bio">
            {description.length > 200 ? description.slice(0, 200) + "..." : description}
          </p>
          {canControl && editingField !== "description" && (
            <button
              type="button"
              className="fb-intro__bio-edit"
              onClick={() => startEdit("description", description || "")}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {!description && canControl && detailsMode && editingField !== "description" && (
        <button type="button" className="fb-intro__add-bio-btn" onClick={() => startEdit("description", "") }>
          <Pencil className="h-3.5 w-3.5" />
          {t("institution.intro.editBio")}
        </button>
      )}

      {editingField === "description" && (
        <div className="fb-intro__edit-form mt-2">
          <Textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="text-sm min-h-[80px]"
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={async () => {
              setSaving(true);
              try {
                const universityId = item.id || item.university_id;
                const { data, error } = await supabase.functions.invoke('institution-page-edit', {
                  body: {
                    action: 'submit',
                    university_id: universityId,
                    block_type: 'about',
                    payload: { description: editValue || null },
                  },
                });
                if (error) throw error;
                if (!data?.ok) throw new Error(data?.error || 'Failed');
                setLocalOverrides(prev => ({ ...prev, description: editValue }));
                setEditingField(null);
                toast({ title: t("institution.intro.saved") });
              } catch {
                toast({ title: t("institution.intro.saveFailed"), variant: "destructive" });
              } finally {
                setSaving(false);
              }
            }} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="fb-intro__separator" />

      {/* Page type */}
      <div className="fb-intro__row">
        <div className="fb-intro__row-icon"><Building2 className="h-4 w-4" /></div>
        <div className="fb-intro__row-content">
          <span className="fb-intro__value">
            {uniType === "public" ? t("universityDetails.stat.public") : uniType === "private" ? t("universityDetails.stat.private") : t("institution.intro.university")}
          </span>
          <span className="fb-intro__label">{t("institution.intro.pageType")}</span>
        </div>
      </div>

      {/* Location */}
      <div className="fb-intro__row">
        <div className="fb-intro__row-icon"><MapPin className="h-4 w-4" /></div>
        <div className="fb-intro__row-content">
          <span className="fb-intro__value">{[item?.city, countryName].filter(Boolean).join(", ")}</span>
          <span className="fb-intro__label">{t("institution.intro.location")}</span>
        </div>
      </div>

      {/* Contact info — hidden when contact_visible is false (operators always see) */}
      {(contactVisible || canControl) && (
        <>
          {/* Phone */}
          {renderEditableRow(
            <Phone className="h-4 w-4" />,
            t("institution.intro.phone"),
            phone,
            "phone",
            () => saveField("phone", "phone"),
            "tel"
          )}

          {/* WhatsApp */}
          {renderEditableRow(
            <MessageCircle className="h-4 w-4" />,
            t("institution.intro.whatsapp", "WhatsApp"),
            socialLinks.whatsapp,
            "social_whatsapp",
            () => saveSocialField("whatsapp"),
            "tel"
          )}

          {/* Email */}
          {renderEditableRow(
            <Mail className="h-4 w-4" />,
            t("institution.intro.email"),
            email,
            "email",
            () => saveField("email", "email"),
            "email"
          )}

          {/* Website */}
          {renderEditableRow(
            <Globe className="h-4 w-4" />,
            t("institution.intro.website"),
            website,
            "website",
            () => saveField("website", "website"),
            "url"
          )}

          {/* Instagram */}
          {renderEditableRow(
            <Instagram className="h-4 w-4" />,
            "Instagram",
            socialLinks.instagram,
            "social_instagram",
            () => saveSocialField("instagram"),
            "url"
          )}

          {/* YouTube */}
          {renderEditableRow(
            <Youtube className="h-4 w-4" />,
            "YouTube",
            socialLinks.youtube,
            "social_youtube",
            () => saveSocialField("youtube"),
            "url"
          )}

          {/* LinkedIn */}
          {renderEditableRow(
            <Linkedin className="h-4 w-4" />,
            "LinkedIn",
            socialLinks.linkedin,
            "social_linkedin",
            () => saveSocialField("linkedin"),
            "url"
          )}

          {/* Other links */}
          {renderEditableRow(
            <LinkIcon className="h-4 w-4" />,
            t("institution.intro.otherLink", "Link"),
            socialLinks.other_url,
            "social_other_url",
            () => saveSocialField("other_url"),
            "url"
          )}
        </>
      )}

      <div className="fb-intro__separator" />

      {/* Stats section */}
      {foundedYear && (
        <div className="fb-intro__row">
          <div className="fb-intro__row-icon"><Clock className="h-4 w-4" /></div>
          <div className="fb-intro__row-content">
            <span className="fb-intro__value">{foundedYear}</span>
            <span className="fb-intro__label">{t("universityDetails.founded")}</span>
          </div>
        </div>
      )}

      {enrolledStudents && (
        <div className="fb-intro__row">
          <div className="fb-intro__row-icon"><Users className="h-4 w-4" /></div>
          <div className="fb-intro__row-content">
            <span className="fb-intro__value">{Number(enrolledStudents).toLocaleString()}</span>
            <span className="fb-intro__label">{t("universityDetails.totalStudents")}</span>
          </div>
        </div>
      )}

      {internationalStudents && (
        <div className="fb-intro__row">
          <div className="fb-intro__row-icon"><Globe className="h-4 w-4" /></div>
          <div className="fb-intro__row-content">
            <span className="fb-intro__value">{Number(internationalStudents).toLocaleString()}</span>
            <span className="fb-intro__label">{t("universityDetails.internationalStudents")}</span>
          </div>
        </div>
      )}

      {acceptanceRate && (
        <div className="fb-intro__row">
          <div className="fb-intro__row-icon"><Shield className="h-4 w-4" /></div>
          <div className="fb-intro__row-content">
            <span className="fb-intro__value">{acceptanceRate}%</span>
            <span className="fb-intro__label">{t("universityDetails.acceptanceRate")}</span>
          </div>
        </div>
      )}

      {annualFees && (
        <div className="fb-intro__row">
          <div className="fb-intro__row-icon"><DollarSign className="h-4 w-4" /></div>
          <div className="fb-intro__row-content">
            <span className="fb-intro__value">{money(annualFees, item?.currency_code)}</span>
            <span className="fb-intro__label">{t("universityDetails.stat.annualFees")}</span>
          </div>
        </div>
      )}

      {programsCount > 0 && (
        <div className="fb-intro__row">
          <div className="fb-intro__row-icon"><GraduationCap className="h-4 w-4" /></div>
          <div className="fb-intro__row-content">
            <span className="fb-intro__value">{programsCount}</span>
            <span className="fb-intro__label">{t("universityDetails.availablePrograms")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
