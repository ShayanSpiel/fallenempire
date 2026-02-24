/**
 * Battle Theme Configuration
 * Centralized styling system for battle page
 */

export const BATTLE_THEME = {
  sides: {
    attacker: {
      primary: "red",
      colors: {
        text: "text-red-500",
        textLight: "text-red-200",
        textLighter: "text-red-100",
        textDark: "text-red-600",
        bg: "bg-red-500",
        bgDark: "bg-red-600",
        bgDarker: "bg-red-950",
        bgLight: "bg-red-400",
        border: "border-red-500",
        borderDark: "border-red-600",
        borderLight: "border-red-300",
        borderCritical: "border-red-500/70",
        shadow: "shadow-[0_10px_25px_rgba(220,38,38,0.35)]",
        gradient: "from-red-600 via-red-500 to-red-400",
        gradientWithShadow: "from-red-600 via-red-500 to-red-400 shadow-[0_10px_25px_rgba(220,38,38,0.35)]",
      },
      rgba: {
        shadow: "rgba(220,38,38,0.35)",
      },
    },
    defender: {
      primary: "emerald",
      colors: {
        text: "text-emerald-400",
        textLight: "text-emerald-200",
        textLighter: "text-emerald-100",
        textDark: "text-emerald-600",
        bg: "bg-emerald-500",
        bgDark: "bg-emerald-600",
        bgLight: "bg-emerald-400",
        border: "border-emerald-500",
        borderDark: "border-emerald-300",
        borderLight: "border-emerald-300",
        borderCritical: "border-emerald-400/70",
        shadow: "shadow-[0_10px_25px_rgba(16,185,129,0.35)]",
        gradient: "from-emerald-600 via-emerald-500 to-emerald-400",
        gradientWithShadow: "from-emerald-600 via-emerald-500 to-emerald-400 shadow-[0_10px_25px_rgba(16,185,129,0.35)]",
      },
      rgba: {
        shadow: "rgba(16,185,129,0.35)",
      },
    },
  },
  ui: {
    timer: {
      containerBg: "bg-transparent",
      containerShadow: "",
      digitBg: {
        normal: "bg-transparent",
        critical: "bg-transparent",
      },
      digitBorder: {
        normal: "border-none",
        critical: "border-none",
      },
      digitText: {
        normal: "text-foreground/90",
        critical: "text-red-500",
      },
      digitShadow: "",
      separatorText: {
        normal: "text-foreground/80",
        critical: "text-red-500",
      },
    },
    wall: {
      securedLabel: "bg-emerald-500",
      conqueredLabel: "bg-red-500",
      defenseBar: {
        emerald: "bg-emerald-500/35 border-t-2 border-emerald-300",
        red: "bg-red-600/35 border-b-2 border-red-300",
      },
    },
    damageBar: {
      containerBg: "bg-slate-900/70",
      containerShadow: "shadow-[0_18px_40px_rgba(9,9,16,0.8)]",
      barBg: "bg-white/5",
      barBorder: "border-white/10",
      barShadow: "shadow-[0_8px_20px_rgba(0,0,0,0.45)]",
    },
    buttons: {
      main: {
        bg: "rounded-3xl bg-background/20",
        shadow: "shadow-2xl",
      },
      helpDefenders: {
        bg: "bg-emerald-600",
        hover: "hover:bg-emerald-500",
        border: "border-b-4 border-emerald-800",
      },
      joinAttackers: {
        bg: "bg-red-600",
        hover: "hover:bg-red-500",
        border: "border-b-4 border-red-800",
      },
      shield: {
        bg: "bg-emerald-500",
        text: "text-emerald-950",
        hover: "hover:bg-emerald-400",
        border: "border-b-4 border-emerald-700",
      },
      fight: {
        bg: "bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600",
        text: "text-black",
        hover: "hover:from-amber-100 hover:via-amber-350 hover:to-amber-500",
        shadow: "shadow-[0_2px_2px_rgba(0,0,0,0.3),inset_0_0.5px_0px_rgba(255,255,255,0.5)]",
      },
      sword: {
        bg: "bg-red-500",
        text: "text-red-50",
        hover: "hover:bg-red-400",
        border: "border-b-4 border-red-700",
      },
      crosshair: {
        bg: "bg-amber-800",
        text: "text-amber-50",
        hover: "hover:bg-amber-700",
        border: "border-b-4 border-amber-950",
      },
      bomb: {
        bg: "bg-slate-900",
        text: "text-slate-50",
        border: "border-b-4 border-slate-950",
        disabled: "opacity-40 cursor-not-allowed",
      },
      food: {
        bg: "bg-orange-600",
        text: "text-orange-50",
        border: "border-b-4 border-orange-800",
        disabled: "opacity-40 cursor-not-allowed",
      },
      potion1: {
        bg: "bg-purple-600",
        text: "text-purple-50",
        border: "border-b-4 border-purple-800",
        disabled: "opacity-40 cursor-not-allowed",
      },
      potion2: {
        bg: "bg-pink-600",
        text: "text-pink-50",
        border: "border-b-4 border-pink-800",
        disabled: "opacity-40 cursor-not-allowed",
      },
      comingSoonTooltip: {
        bg: "bg-black/80",
        text: "text-white",
        size: "text-[10px]",
        padding: "px-2 py-1",
        rounded: "rounded",
      },
    },
    logs: {
      defenderBg: "bg-emerald-500",
      attackerBg: "bg-red-500",
      shadow: "shadow-md",
    },
    floatingHit: {
      defenderText: "text-emerald-400",
      attackerText: "text-red-500",
      shadow: "drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]",
    },
    bomb: {
      bg: "bg-black/60",
      effectBg: "bg-amber-300/80",
    },
  },
} as const;

export const getBattleSideTheme = (side: "attacker" | "defender") => {
  return BATTLE_THEME.sides[side];
};

export const getTimerTheme = (isCritical: boolean) => ({
  digit: {
    bg: isCritical ? BATTLE_THEME.ui.timer.digitBg.critical : BATTLE_THEME.ui.timer.digitBg.normal,
    border: isCritical ? BATTLE_THEME.ui.timer.digitBorder.critical : BATTLE_THEME.ui.timer.digitBorder.normal,
    text: isCritical ? BATTLE_THEME.ui.timer.digitText.critical : BATTLE_THEME.ui.timer.digitText.normal,
  },
  separator: isCritical ? BATTLE_THEME.ui.timer.separatorText.critical : BATTLE_THEME.ui.timer.separatorText.normal,
  border: isCritical ? BATTLE_THEME.sides.attacker.colors.borderCritical : BATTLE_THEME.sides.defender.colors.borderCritical,
});

export const getDamageBarGradient = (userSide: "attacker" | "defender") => {
  if (userSide === "attacker") {
    return BATTLE_THEME.sides.attacker.colors.gradientWithShadow;
  }
  return BATTLE_THEME.sides.defender.colors.gradientWithShadow;
};

export const getScoreTextColor = (isNegative: boolean) => {
  return isNegative ? BATTLE_THEME.sides.attacker.colors.text : BATTLE_THEME.sides.defender.colors.text;
};
