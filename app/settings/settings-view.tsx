"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Palette,
  User,
  Shield,
  Bell,
  ChevronRight,
  Info,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSection } from "@/components/layout/page-section";
import { H1, H2, Small, Meta } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/section-heading";
import { JUNG_ARCHETYPES } from "@/lib/psychology";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { componentSpacing, cardStyles, layout, typography } from "@/lib/design-system";
import { ColorSelector } from "@/components/settings/color-selector";

interface SettingsProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  identity_label?: string | null;
  avatar_style?: string | null;
  avatar_background_color?: string | null;
  avatar_hair?: string | null;
  avatar_eyes?: string | null;
  avatar_mouth?: string | null;
  avatar_nose?: string | null;
  avatar_base_color?: string | null;
  avatar_hair_color?: string | null;
  avatar_eyebrows?: string | null;
  avatar_eye_shadow_color?: string | null;
  avatar_facial_hair?: string | null;
  avatar_ears?: string | null;
  avatar_earrings?: string | null;
  avatar_earring_color?: string | null;
  avatar_glasses?: string | null;
  avatar_glasses_color?: string | null;
  avatar_shirt?: string | null;
  avatar_shirt_color?: string | null;
}

type SettingsSection = "profile" | "account" | "security" | "notifications";

const AVATAR_STYLES = [
  { id: "micah", label: "Micah", description: "Customizable cartoon avatar" },
  { id: "thumbs", label: "Thumbs", description: "Thumbprint-style avatar" },
  { id: "lorelei", label: "Lorelei", description: "Artistic portrait style" },
  { id: "personas", label: "Personas", description: "Character-based avatar" },
  { id: "bottts", label: "Bottts", description: "Robot-themed avatar" },
  { id: "avataaars", label: "Avataaars", description: "Modern avatar style" },
];

// Complete Micah style options from DiceBear API (ALL options verified)
const MICAH_OPTIONS = {
  backgroundColor: [
    { id: "b6e3f4", label: "Light Blue", color: "#b6e3f4" },
    { id: "c0aede", label: "Purple", color: "#c0aede" },
    { id: "d1d4f9", label: "Lavender", color: "#d1d4f9" },
    { id: "ffdfbf", label: "Peach", color: "#ffdfbf" },
    { id: "fdcdc5", label: "Pink", color: "#fdcdc5" },
    { id: "ffedef", label: "Light Pink", color: "#ffedef" },
    { id: "d2eff3", label: "Cyan", color: "#d2eff3" },
    { id: "e0ddff", label: "Light Purple", color: "#e0ddff" },
  ],
  base: [
    { id: "standard", label: "Standard", color: "#f9c9b6" },
  ],
  baseColor: [
    { id: "f9c9b6", label: "Light", color: "#f9c9b6" },
    { id: "ac6651", label: "Medium", color: "#ac6651" },
    { id: "77311d", label: "Dark", color: "#77311d" },
  ],
  hair: [
    { id: "fonze", label: "Fonze", icon: "🎸" },
    { id: "mrT", label: "Mr T", icon: "💪" },
    { id: "dougFunny", label: "Doug Funny", icon: "📚" },
    { id: "mrClean", label: "Mr Clean", icon: "✨" },
    { id: "dannyPhantom", label: "Danny Phantom", icon: "👻" },
    { id: "full", label: "Full", icon: "💇" },
    { id: "turban", label: "Turban", icon: "👳" },
    { id: "pixie", label: "Pixie", icon: "🧚" },
  ],
  hairColor: [
    { id: "000000", label: "Black", color: "#000000" },
    { id: "77311d", label: "Brown", color: "#77311d" },
    { id: "ac6651", label: "Auburn", color: "#ac6651" },
    { id: "f4d150", label: "Blonde", color: "#f4d150" },
    { id: "ffeba4", label: "Light Blonde", color: "#ffeba4" },
    { id: "fc909f", label: "Pink", color: "#fc909f" },
    { id: "9287ff", label: "Purple", color: "#9287ff" },
    { id: "6bd9e9", label: "Blue", color: "#6bd9e9" },
    { id: "d2eff3", label: "Light Blue", color: "#d2eff3" },
    { id: "e0ddff", label: "Lavender", color: "#e0ddff" },
    { id: "ffffff", label: "White", color: "#ffffff" },
    { id: "f9c9b6", label: "Peach", color: "#f9c9b6" },
    { id: "ffedef", label: "Light Pink", color: "#ffedef" },
  ],
  eyebrows: [
    { id: "up", label: "Up", icon: "⬆️" },
    { id: "down", label: "Down", icon: "⬇️" },
    { id: "eyelashesUp", label: "Lashes Up", icon: "👁️⬆️" },
    { id: "eyelashesDown", label: "Lashes Down", icon: "👁️⬇️" },
  ],
  eyes: [
    { id: "eyes", label: "Normal", icon: "👁️" },
    { id: "round", label: "Round", icon: "⭕" },
    { id: "eyesShadow", label: "Shadow", icon: "🌑" },
    { id: "smiling", label: "Smiling", icon: "😊" },
    { id: "smilingShadow", label: "Smiling Shadow", icon: "😎" },
  ],
  eyeShadowColor: [
    { id: "d2eff3", label: "Blue", color: "#d2eff3" },
    { id: "e0ddff", label: "Purple", color: "#e0ddff" },
    { id: "ffeba4", label: "Yellow", color: "#ffeba4" },
    { id: "ffedef", label: "Pink", color: "#ffedef" },
    { id: "ffffff", label: "White", color: "#ffffff" },
  ],
  mouth: [
    { id: "surprised", label: "Surprised", icon: "😮" },
    { id: "laughing", label: "Laughing", icon: "😄" },
    { id: "nervous", label: "Nervous", icon: "😬" },
    { id: "smile", label: "Smile", icon: "😊" },
    { id: "sad", label: "Sad", icon: "😢" },
    { id: "pucker", label: "Pucker", icon: "😗" },
    { id: "frown", label: "Frown", icon: "☹️" },
    { id: "smirk", label: "Smirk", icon: "😏" },
  ],
  nose: [
    { id: "curve", label: "Curve", icon: "👃" },
    { id: "pointed", label: "Pointed", icon: "🔺" },
    { id: "tound", label: "Round", icon: "⭕" },
  ],
  facialHair: [
    { id: "", label: "None", icon: "🚫" },
    { id: "beard", label: "Beard", icon: "🧔" },
    { id: "scruff", label: "Scruff", icon: "😎" },
  ],
  ears: [
    { id: "attached", label: "Attached", icon: "👂" },
    { id: "detached", label: "Detached", icon: "👂" },
  ],
  earrings: [
    { id: "", label: "None", icon: "🚫" },
    { id: "hoop", label: "Hoop", icon: "⭕" },
    { id: "stud", label: "Stud", icon: "💎" },
  ],
  earringColor: [
    { id: "000000", label: "Black", color: "#000000" },
    { id: "d2eff3", label: "Silver", color: "#d2eff3" },
    { id: "f4d150", label: "Gold", color: "#f4d150" },
    { id: "9287ff", label: "Purple", color: "#9287ff" },
    { id: "6bd9e9", label: "Blue", color: "#6bd9e9" },
  ],
  glasses: [
    { id: "", label: "None", icon: "🚫" },
    { id: "round", label: "Round", icon: "🤓" },
    { id: "square", label: "Square", icon: "👓" },
  ],
  glassesColor: [
    { id: "000000", label: "Black", color: "#000000" },
    { id: "d2eff3", label: "Blue", color: "#d2eff3" },
    { id: "f4d150", label: "Yellow", color: "#f4d150" },
    { id: "9287ff", label: "Purple", color: "#9287ff" },
    { id: "fc909f", label: "Pink", color: "#fc909f" },
  ],
  shirt: [
    { id: "open", label: "Open", icon: "👕" },
    { id: "crew", label: "Crew", icon: "👔" },
    { id: "collared", label: "Collared", icon: "🎽" },
  ],
  shirtColor: [
    { id: "000000", label: "Black", color: "#000000" },
    { id: "ffffff", label: "White", color: "#ffffff" },
    { id: "f4d150", label: "Yellow", color: "#f4d150" },
    { id: "9287ff", label: "Purple", color: "#9287ff" },
    { id: "fc909f", label: "Pink", color: "#fc909f" },
    { id: "6bd9e9", label: "Blue", color: "#6bd9e9" },
    { id: "d2eff3", label: "Light Blue", color: "#d2eff3" },
    { id: "e0ddff", label: "Lavender", color: "#e0ddff" },
  ],
};

export function SettingsView({ profile }: { profile: SettingsProfile }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null);

  // Avatar options state
  const [selectedStyle, setSelectedStyle] = useState(profile.avatar_style || "micah");
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState(profile.avatar_background_color || "b6e3f4");
  const [selectedHair, setSelectedHair] = useState(profile.avatar_hair || "full");
  const [selectedHairColor, setSelectedHairColor] = useState(profile.avatar_hair_color || "000000");
  const [selectedBaseColor, setSelectedBaseColor] = useState(profile.avatar_base_color || "f9c9b6");
  const [selectedEyebrows, setSelectedEyebrows] = useState(profile.avatar_eyebrows || "up");
  const [selectedEye, setSelectedEye] = useState(profile.avatar_eyes || "smiling");
  const [selectedEyeShadowColor, setSelectedEyeShadowColor] = useState(profile.avatar_eye_shadow_color || "");
  const [selectedMouth, setSelectedMouth] = useState(profile.avatar_mouth || "smile");
  const [selectedNose, setSelectedNose] = useState(profile.avatar_nose || "curve");
  const [selectedFacialHair, setSelectedFacialHair] = useState(profile.avatar_facial_hair || "");
  const [selectedEars, setSelectedEars] = useState(profile.avatar_ears || "attached");
  const [selectedEarrings, setSelectedEarrings] = useState(profile.avatar_earrings || "");
  const [selectedEarringColor, setSelectedEarringColor] = useState(profile.avatar_earring_color || "d2eff3");
  const [selectedGlasses, setSelectedGlasses] = useState(profile.avatar_glasses || "");
  const [selectedGlassesColor, setSelectedGlassesColor] = useState(profile.avatar_glasses_color || "000000");
  const [selectedShirt, setSelectedShirt] = useState(profile.avatar_shirt || "crew");
  const [selectedShirtColor, setSelectedShirtColor] = useState(profile.avatar_shirt_color || "6bd9e9");

  const [selectedIdentity, setSelectedIdentity] = useState(profile.identity_label || "");
  const [isSaving, setIsSaving] = useState(false);

  const previewAvatarUrl = React.useMemo(() => {
    if (avatarUrl && !avatarUrl.includes("api.dicebear.com")) {
      return avatarUrl;
    }

    const params = new URLSearchParams({
      seed: profile.username,
      backgroundColor: selectedBackgroundColor,
    });

    if (selectedStyle === "micah") {
      // Appearance
      params.append("baseColor", selectedBaseColor);
      params.append("hair", selectedHair);
      params.append("hairColor", selectedHairColor);
      params.append("eyebrows", selectedEyebrows);
      params.append("eyes", selectedEye);
      if (selectedEyeShadowColor) params.append("eyeShadowColor", selectedEyeShadowColor);
      params.append("mouth", selectedMouth);
      params.append("nose", selectedNose);

      // Accessories
      params.append("ears", selectedEars);
      if (selectedFacialHair) params.append("facialHair", selectedFacialHair);
      if (selectedEarrings) {
        params.append("earrings", selectedEarrings);
        params.append("earringColor", selectedEarringColor);
      }
      if (selectedGlasses) {
        params.append("glasses", selectedGlasses);
        params.append("glassesColor", selectedGlassesColor);
      }

      // Clothing
      params.append("shirt", selectedShirt);
      params.append("shirtColor", selectedShirtColor);
    }

    return `https://api.dicebear.com/9.x/${selectedStyle}/svg?${params.toString()}`;
  }, [
    selectedStyle, avatarUrl, profile.username, selectedBackgroundColor,
    selectedBaseColor, selectedHair, selectedHairColor, selectedEyebrows,
    selectedEye, selectedEyeShadowColor, selectedMouth, selectedNose,
    selectedEars, selectedFacialHair, selectedEarrings, selectedEarringColor,
    selectedGlasses, selectedGlassesColor, selectedShirt, selectedShirtColor
  ]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_style: selectedStyle,
          avatar_background_color: selectedBackgroundColor,
          avatar_hair: selectedHair,
          avatar_hair_color: selectedHairColor,
          avatar_base_color: selectedBaseColor,
          avatar_eyebrows: selectedEyebrows,
          avatar_eyes: selectedEye,
          avatar_eye_shadow_color: selectedEyeShadowColor || null,
          avatar_mouth: selectedMouth,
          avatar_nose: selectedNose,
          avatar_facial_hair: selectedFacialHair || null,
          avatar_ears: selectedEars,
          avatar_earrings: selectedEarrings || null,
          avatar_earring_color: selectedEarringColor,
          avatar_glasses: selectedGlasses || null,
          avatar_glasses_color: selectedGlassesColor,
          avatar_shirt: selectedShirt,
          avatar_shirt_color: selectedShirtColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      toast.success("Avatar preferences saved successfully!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save avatar preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!selectedIdentity.trim()) {
      toast.error("Identity label cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/identity-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_label: selectedIdentity.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update identity label");
      }

      toast.success("Identity label updated successfully!");
    } catch (error) {
      console.error("Error updating identity:", error);
      toast.error("Failed to update identity label");
    } finally {
      setIsSaving(false);
    }
  };

  const navigationItems = [
    { id: "profile" as const, label: "Profile", icon: User, description: "Avatar and identity settings" },
    { id: "account" as const, label: "Account", icon: Shield, description: "Coming soon", disabled: true },
    { id: "security" as const, label: "Security", icon: Shield, description: "Coming soon", disabled: true },
    { id: "notifications" as const, label: "Notifications", icon: Bell, description: "Coming soon", disabled: true },
  ];

  return (
    <PageSection>
      <div className="min-h-screen w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <H1>Settings</H1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar Navigation */}
          <aside className="space-y-2">
            <Card>
              <CardContent className={cn(componentSpacing.containerPadding.sm, "space-y-1")}>
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => !item.disabled && setActiveSection(item.id)}
                    disabled={item.disabled}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 p-3 rounded-lg transition-all",
                      "text-left group",
                      activeSection === item.id
                        ? "bg-primary text-primary-foreground"
                        : item.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <item.icon
                        size={18}
                        className={cn(
                          activeSection === item.id
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm font-semibold",
                          activeSection === item.id
                            ? "text-primary-foreground"
                            : "text-foreground"
                        )}>
                          {item.label}
                        </div>
                        {item.description && (
                          <div className={cn(
                            "text-xs",
                            activeSection === item.id
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}>
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                    {!item.disabled && (
                      <ChevronRight
                        size={16}
                        className={cn(
                          activeSection === item.id
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      />
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="space-y-8">
            {activeSection === "profile" && (
              <>
                {/* Identity Label Section */}
                <Card>
                  <CardContent className="space-y-6">
                    <SectionHeading
                      title="Identity Label"
                      icon={Sparkles}
                      tooltip="Your identity label is automatically calculated based on your personality traits. You can override it with a custom label."
                    />

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="identity-input">Custom Identity Label</Label>
                        <Input
                          id="identity-input"
                          type="text"
                          value={selectedIdentity}
                          onChange={(e) => setSelectedIdentity(e.target.value)}
                          placeholder="Enter your custom label (e.g., Warrior, Strategist, Leader...)"
                          className="w-full"
                          maxLength={50}
                        />
                        <Small className="text-muted-foreground">
                          Your identity label is auto-calculated from your actions. Override it here with any custom text.
                        </Small>
                      </div>

                      <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
                        <div className="flex items-start gap-3">
                          <Info size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="space-y-2 flex-1">
                            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
                              Available Jungian Archetypes
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.keys(JUNG_ARCHETYPES).sort().map((archetype) => (
                                <button
                                  key={archetype}
                                  onClick={() => setSelectedIdentity(archetype)}
                                  className={cn(
                                    "px-2 py-1 rounded text-xs font-medium transition-colors",
                                    "bg-background hover:bg-primary/10 border border-border/40 hover:border-primary/50"
                                  )}
                                >
                                  {archetype}
                                </button>
                              ))}
                            </div>
                            <Small className="text-muted-foreground text-xs">
                              Click any archetype to use it, or type your own custom label above.
                            </Small>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveIdentity}
                        disabled={isSaving || !selectedIdentity.trim() || selectedIdentity === profile.identity_label}
                        size="lg"
                        className="w-full"
                      >
                        {isSaving ? "Saving..." : "Update Identity Label"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Separator />

                {/* Avatar Upload Section */}
                <Card>
                  <CardContent className="space-y-6">
                    <SectionHeading
                      title="Custom Avatar"
                      icon={ImageIcon}
                      tooltip="Upload a custom profile picture (max 500KB)"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <AvatarUpload
                        avatarUrl={avatarUrl}
                        seed={profile.username ?? "user"}
                        fallback={profile.username?.[0] ?? "?"}
                        isOwn={true}
                        onUploadSuccess={setAvatarUrl}
                        size="lg"
                      />
                      <Small className="text-muted-foreground text-center max-w-xs">
                        Click on your avatar to upload a custom image. Maximum file size: 500 KB
                      </Small>
                    </div>
                  </CardContent>
                </Card>

                {/* Avatar Personalization */}
                <Card>
                  <CardContent className="space-y-6">
                    <SectionHeading
                      title="Avatar Personalization"
                      icon={Palette}
                      tooltip="Customize your fallback avatar that appears when you don't have a custom image"
                    />

                    {/* Two-column layout: Preview (sticky) + Options */}
                    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
                      {/* Left: Large Preview (Sticky) */}
                      <div className="lg:sticky lg:top-8 self-start">
                        <div className="space-y-4">
                          <div className="flex justify-center items-center bg-muted/30 rounded-xl p-8 border border-border/40">
                            <Avatar className="w-64 h-64 shadow-2xl">
                              <AvatarImage src={previewAvatarUrl} />
                              <AvatarFallback className="text-6xl">{profile.username?.[0]}</AvatarFallback>
                            </Avatar>
                          </div>
                          <Button
                            onClick={handleSavePreferences}
                            disabled={isSaving}
                            size="lg"
                            className="w-full"
                          >
                            {isSaving ? "Saving..." : "Save Avatar"}
                          </Button>
                        </div>
                      </div>

                      {/* Right: Options Panel */}
                      <div className="space-y-6">
                        {/* Avatar Style Selection */}
                        <div className="space-y-3">
                          <Label className="text-base font-semibold">Style</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {AVATAR_STYLES.map((style) => (
                              <button
                                key={style.id}
                                onClick={() => setSelectedStyle(style.id)}
                                className={cn(
                                  "group relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                                  "border-2 hover:border-primary/60",
                                  selectedStyle === style.id
                                    ? "border-primary bg-primary/10"
                                    : "border-border/40"
                                )}
                              >
                                <Avatar className="w-12 h-12">
                                  <AvatarImage
                                    src={`https://api.dicebear.com/9.x/${style.id}/svg?seed=${profile.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,fdcdc5`}
                                  />
                                </Avatar>
                                <span className="text-xs font-medium text-center leading-tight">
                                  {style.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Micah-specific Options */}
                        {selectedStyle === "micah" && (
                          <div className="space-y-6 pt-6 border-t">
                            {/* Background Color */}
                            <ColorSelector
                              options={MICAH_OPTIONS.backgroundColor}
                              selected={selectedBackgroundColor}
                              onChange={setSelectedBackgroundColor}
                              label="Background Color"
                            />

                            {/* Skin Tone */}
                            <ColorSelector
                              options={MICAH_OPTIONS.baseColor}
                              selected={selectedBaseColor}
                              onChange={setSelectedBaseColor}
                              label="Skin Tone"
                            />

                            {/* Hair Style */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Hair Style</Label>
                              <div className="grid grid-cols-4 gap-2">
                                {MICAH_OPTIONS.hair.map((hair) => (
                                  <button
                                    key={hair.id}
                                    onClick={() => setSelectedHair(hair.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedHair === hair.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={hair.label}
                                  >
                                    <span className="text-xl">{hair.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {hair.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Hair Color */}
                            <ColorSelector
                              options={MICAH_OPTIONS.hairColor}
                              selected={selectedHairColor}
                              onChange={setSelectedHairColor}
                              label="Hair Color"
                            />

                            {/* Eyebrows */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Eyebrows</Label>
                              <div className="grid grid-cols-4 gap-2">
                                {MICAH_OPTIONS.eyebrows.map((brow) => (
                                  <button
                                    key={brow.id}
                                    onClick={() => setSelectedEyebrows(brow.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedEyebrows === brow.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={brow.label}
                                  >
                                    <span className="text-xl">{brow.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {brow.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Eyes */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Eyes</Label>
                              <div className="grid grid-cols-5 gap-2">
                                {MICAH_OPTIONS.eyes.map((eye) => (
                                  <button
                                    key={eye.id}
                                    onClick={() => setSelectedEye(eye.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedEye === eye.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={eye.label}
                                  >
                                    <span className="text-xl">{eye.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {eye.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Eye Shadow (Optional) */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Eye Shadow (Optional)</Label>
                              <div className="grid grid-cols-6 gap-2">
                                <button
                                  onClick={() => setSelectedEyeShadowColor("")}
                                  className={cn(
                                    "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                    "border-2 hover:border-primary/60",
                                    !selectedEyeShadowColor
                                      ? "border-primary bg-primary/10"
                                      : "border-border/40"
                                  )}
                                  title="None"
                                >
                                  <span className="text-xl">🚫</span>
                                </button>
                                {MICAH_OPTIONS.eyeShadowColor.map((color) => (
                                  <button
                                    key={color.id}
                                    onClick={() => setSelectedEyeShadowColor(color.id)}
                                    className={cn(
                                      "relative w-full aspect-square rounded-lg transition-all border-2",
                                      "hover:scale-110",
                                      selectedEyeShadowColor === color.id
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-border/40"
                                    )}
                                    style={{ backgroundColor: color.color }}
                                    title={color.label}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Mouth */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Mouth</Label>
                              <div className="grid grid-cols-4 gap-2">
                                {MICAH_OPTIONS.mouth.map((mouth) => (
                                  <button
                                    key={mouth.id}
                                    onClick={() => setSelectedMouth(mouth.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedMouth === mouth.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={mouth.label}
                                  >
                                    <span className="text-xl">{mouth.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {mouth.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Nose */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Nose</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {MICAH_OPTIONS.nose.map((nose) => (
                                  <button
                                    key={nose.id}
                                    onClick={() => setSelectedNose(nose.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedNose === nose.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={nose.label}
                                  >
                                    <span className="text-xl">{nose.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {nose.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Facial Hair */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Facial Hair</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {MICAH_OPTIONS.facialHair.map((facial) => (
                                  <button
                                    key={facial.id}
                                    onClick={() => setSelectedFacialHair(facial.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedFacialHair === facial.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={facial.label}
                                  >
                                    <span className="text-xl">{facial.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {facial.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Ears */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Ears</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {MICAH_OPTIONS.ears.map((ear) => (
                                  <button
                                    key={ear.id}
                                    onClick={() => setSelectedEars(ear.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedEars === ear.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={ear.label}
                                  >
                                    <span className="text-xl">{ear.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {ear.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Earrings */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Earrings</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {MICAH_OPTIONS.earrings.map((earring) => (
                                  <button
                                    key={earring.id}
                                    onClick={() => setSelectedEarrings(earring.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedEarrings === earring.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={earring.label}
                                  >
                                    <span className="text-xl">{earring.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {earring.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Earring Color (only show if earrings selected) */}
                            {selectedEarrings && (
                              <ColorSelector
                                options={MICAH_OPTIONS.earringColor}
                                selected={selectedEarringColor}
                                onChange={setSelectedEarringColor}
                                label="Earring Color"
                              />
                            )}

                            {/* Glasses */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Glasses</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {MICAH_OPTIONS.glasses.map((glass) => (
                                  <button
                                    key={glass.id}
                                    onClick={() => setSelectedGlasses(glass.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedGlasses === glass.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={glass.label}
                                  >
                                    <span className="text-xl">{glass.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {glass.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Glasses Color (only show if glasses selected) */}
                            {selectedGlasses && (
                              <ColorSelector
                                options={MICAH_OPTIONS.glassesColor}
                                selected={selectedGlassesColor}
                                onChange={setSelectedGlassesColor}
                                label="Glasses Color"
                              />
                            )}

                            {/* Shirt Style */}
                            <div className="space-y-3">
                              <Label className="text-base font-semibold">Shirt Style</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {MICAH_OPTIONS.shirt.map((shirt) => (
                                  <button
                                    key={shirt.id}
                                    onClick={() => setSelectedShirt(shirt.id)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                                      "border-2 hover:border-primary/60",
                                      selectedShirt === shirt.id
                                        ? "border-primary bg-primary/10"
                                        : "border-border/40"
                                    )}
                                    title={shirt.label}
                                  >
                                    <span className="text-xl">{shirt.icon}</span>
                                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                                      {shirt.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Shirt Color */}
                            <ColorSelector
                              options={MICAH_OPTIONS.shirtColor}
                              selected={selectedShirtColor}
                              onChange={setSelectedShirtColor}
                              label="Shirt Color"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </PageSection>
  );
}
