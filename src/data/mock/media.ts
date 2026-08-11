import { Episode, Media } from "@/types/media";

export const mockMedia: Media[] = [
  {
    id: "fault-lines",
    title: "Fault Lines",
    kind: "series",
    year: 2024,
    genres: ["Thriller", "Sci-Fi"],
    artworkColor: "#274257",
    synopsis:
      "A signal from an abandoned station reopens the case that started it all, pulling the team back to where everything went wrong.",
    communityRating: 4.5,
    ratingCount: 2,
    status: "watching",
    seasons: 4,
  },
  {
    id: "the-watchers",
    title: "The Watchers",
    kind: "series",
    year: 2023,
    genres: ["Drama"],
    artworkColor: "#8B4A43",
    status: "watchlist",
  },
  {
    id: "white-zone",
    title: "White Zone",
    kind: "movie",
    year: 2026,
    genres: ["Thriller"],
    runtimeMinutes: 118,
    artworkColor: "#3D5A6C",
    synopsis:
      "A lone investigator tracks the truth behind the disappearance of an entire village, at the edge of reality.",
    communityRating: 4.2,
    ratingCount: 1200,
    status: "watched",
  },
  {
    id: "nocturne",
    title: "Nocturne",
    kind: "series",
    year: 2022,
    genres: ["Drama", "Mystery"],
    artworkColor: "#5B3A5C",
    status: "watching",
  },
  {
    id: "black-light",
    title: "Black Light",
    kind: "movie",
    year: 2025,
    genres: ["Thriller"],
    runtimeMinutes: 104,
    artworkColor: "#3E2F1C",
  },
  {
    id: "the-last-shore",
    title: "The Last Shore",
    kind: "movie",
    year: 2025,
    genres: ["Drama"],
    runtimeMinutes: 132,
    artworkColor: "#1E4A45",
    communityRating: 4.7,
  },
];

export const mockEpisodes: Episode[] = [
  {
    id: "fault-lines-s3e1",
    seriesId: "fault-lines",
    season: 3,
    number: 1,
    title: "The Signal",
    runtimeMinutes: 42,
    rating: 4.5,
    ratingCount: 2,
    watched: false,
    airDate: "2024-03-04",
  },
  {
    id: "fault-lines-s3e2",
    seriesId: "fault-lines",
    season: 3,
    number: 2,
    title: "Grey Zone",
    runtimeMinutes: 42,
    watched: false,
    airDate: "2024-03-11",
  },
];

export function findMedia(id: string): Media | undefined {
  return mockMedia.find((m) => m.id === id);
}
