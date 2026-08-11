import { Challenge, HistoryEntry, ListModel, UpcomingEpisode, UserProfile } from "@/types/media";

export const mockUser: UserProfile = {
  id: "alex",
  firstName: "Alex",
  bio: "",
  avatarColor: "#FD736D",
  level: 1,
  levelName: "Curious",
  xp: 35,
  xpToNext: 65,
  moviesCount: 126,
  seriesCount: 42,
  episodesCount: 842,
  hoursWatched: 624,
  dayStreak: 1,
  bestStreak: 1,
};

export const mockUpcoming: UpcomingEpisode[] = [
  {
    id: "up-1",
    seriesTitle: "Fault Lines",
    season: 2,
    episode: 5,
    airDate: "Tue 11",
    artworkColor: "#274257",
  },
  {
    id: "up-2",
    seriesTitle: "Nocturne",
    season: 3,
    episode: 3,
    airDate: "Thu 13",
    artworkColor: "#5B3A5C",
  },
];

export const mockLists: ListModel[] = [
  { id: "must-watch", name: "Must-Watch Movies", mediaIds: ["white-zone", "black-light"] },
  { id: "halloween", name: "Halloween", mediaIds: ["white-zone", "nocturne"] },
  { id: "sci-fi", name: "Sci-Fi", mediaIds: ["fault-lines"] },
  { id: "best-of-2026", name: "Best of 2026", mediaIds: ["white-zone"] },
];

export const mockHistory: HistoryEntry[] = [
  { id: "h1", label: "Fault Lines — S02E04", timeLabel: "Today, 21:40" },
  { id: "h2", label: "The Watchers — S01E07", timeLabel: "Yesterday, 20:15" },
  { id: "h3", label: "White Zone (Movie)", timeLabel: "Aug 6" },
  { id: "h4", label: "Nocturne — S03E02", timeLabel: "Aug 4" },
];

export const mockChallenges: Challenge[] = [
  { id: "c1", label: "5 episodes this week", current: 1, total: 5, xpReward: 30 },
  { id: "c2", label: "3 reviews this week", current: 1, total: 3, xpReward: 20 },
];

export const mockGenreDistribution = [
  { label: "Thriller", percent: 32 },
  { label: "Drama", percent: 24 },
];

export const mockWeeklyActivity = [55, 70, 40, 85, 60, 75, 50];
