export const eventThemes: Record<string, { theme: string; headline: string; subline: string; symbol: string }> = {
  "cat-tech": { theme: "tech", headline: "BUILD.\nLEARN.\nREPEAT.", subline: "NEXT.JS × TYPESCRIPT", symbol: "</>" },
  "cat-career": { theme: "career", headline: "YOUR\nNEXT\nCHAPTER.", subline: "КАРЬЕРА НАЧИНАЕТСЯ ЗДЕСЬ", symbol: "↗" },
  "cat-music": { theme: "music", headline: "FEEL\nTHE\nMUSIC.", subline: "AIU STUDENT ORCHESTRA", symbol: "♪" },
  "cat-art": { theme: "art", headline: "ДРУГОЙ\nВЗГЛЯД.", subline: "ГОРОД И ЛЮДИ / ФОТОВЫСТАВКА", symbol: "◉" },
  "cat-sport": { theme: "sport", headline: "MAKE\nYOUR\nMOVE.", subline: "ЭНЕРГИЯ КАМПУСА", symbol: "↗" },
  "cat-education": { theme: "education", headline: "STAY\nCURIOUS.", subline: "ОТКРЫВАЙ НОВОЕ В AIU", symbol: "✱" },
};
export const getEventTheme = (categoryId: string) => eventThemes[categoryId] ?? { theme: "education", headline: "BE\nPART\nOF IT.", subline: "AIU CAMPUS EVENTS", symbol: "✱" };
export const datePart = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Qyzylorda", ...options }).format(new Date(value));
