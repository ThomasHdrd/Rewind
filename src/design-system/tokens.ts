// Ported 1:1 from the approved Rewind Design System (tokens/*.css)

export const color = {
  black: "#000000",
  ink950: "#04070C",
  ink900: "#080D16",
  ink850: "#0D1220",
  ink800: "#131922",
  ink750: "#1A212C",
  ink700: "#232B37",
  ink600: "#373B40",
  ink500: "#4A5160",
  white: "#FFFFFF",
  gray100: "#F5F6F8",
  gray300: "#9AA1AC",
  gray500: "#6B7280",
  gray700: "#454B54",
  coral100: "#3A2320",
  coral300: "rgba(253,115,109,0.16)",
  coral500: "#FD736D",
  coral600: "#E85850",
  coral700: "#C4453F",
  green500: "#2DD9A6",
  amber500: "#F5A623",
  red500: "#E5484D",
  blue500: "#4EA1F5",
  purple500: "#9B6BD9",
  gold500: "#C9932F",
  olive500: "#A8932A",
  slate500: "#5B6472",
} as const;

export const theme = {
  bgPrimary: color.ink900,
  bgSecondary: color.ink850,
  surfacePrimary: color.ink800,
  surfaceSecondary: color.ink750,
  surfaceElevated: "#161C27",
  surfaceInteractive: color.ink700,

  textPrimary: color.gray100,
  textSecondary: color.gray300,
  textTertiary: color.gray500,
  textDisabled: color.gray700,
  textInverse: color.ink950,

  borderDefault: "#262D3A",
  borderSubtle: "#1A212C",
  divider: "#1D2430",

  brandPrimary: color.coral500,
  brandPrimaryPressed: color.coral600,
  brandPrimarySubtle: color.coral300,

  stateSuccess: color.green500,
  stateWarning: color.amber500,
  stateError: color.red500,
  stateInfo: color.blue500,

  mediaWatching: color.coral500,
  mediaWatchlist: color.purple500,
  mediaWatched: color.gold500,
  mediaPaused: color.olive500,
  mediaDropped: color.slate500,

  rating: color.coral500,
  ratingTrack: color.ink600,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
  poster: 10,
} as const;

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
  screenMargin: 20,
  sectionGap: 32,
  cardPadding: 16,
  gridGap: 12,
} as const;

export const elevation = {
  0: { shadowOpacity: 0 },
  1: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 1,
  },
  2: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 4,
  },
  3: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

// font family names must match the keys registered by useFonts() in app/_layout.tsx
export const font = {
  display: "ArchivoBlack_400Regular",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemiBold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  bodyExtraBold: "Manrope_800ExtraBold",
} as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.4, fontFamily: font.display },
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.4, fontFamily: font.display },
  h2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.15, fontFamily: font.bodyExtraBold, fontWeight: "800" as const },
  h3: { fontSize: 18, lineHeight: 24, letterSpacing: 0, fontFamily: font.bodyBold, fontWeight: "700" as const },
  titleLg: { fontSize: 20, lineHeight: 26, fontFamily: font.bodyBold, fontWeight: "700" as const },
  title: { fontSize: 17, lineHeight: 22, fontFamily: font.bodyBold, fontWeight: "700" as const },
  titleSm: { fontSize: 15, lineHeight: 20, fontFamily: font.bodySemiBold, fontWeight: "600" as const },
  bodyLg: { fontSize: 16, lineHeight: 24, fontFamily: font.body },
  body: { fontSize: 14, lineHeight: 20, fontFamily: font.body },
  bodySm: { fontSize: 13, lineHeight: 18, fontFamily: font.body },
  labelLg: { fontSize: 14, lineHeight: 18, letterSpacing: 0.5, fontFamily: font.bodySemiBold, fontWeight: "600" as const },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.7, fontFamily: font.bodySemiBold, fontWeight: "600" as const },
  labelSm: { fontSize: 11, lineHeight: 14, letterSpacing: 0.7, fontFamily: font.bodySemiBold, fontWeight: "600" as const },
  caption: { fontSize: 11, lineHeight: 14, fontFamily: font.bodyMedium, fontWeight: "500" as const },
} as const;
