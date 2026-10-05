// Shared, comprehensive genre list — used by Discover's Filters modal and
// onboarding's genre picker so both offer the same full set instead of two
// different, independently-maintained short lists.
export const ALL_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

// TMDB genre ids for each display label above, per catalog. TMDB's TV list
// has no History/Horror/Music/Romance/Thriller genres (TV folds Action and
// Adventure into one, Sci-Fi and Fantasy into another), so those labels only
// map on the movie side. Used to turn a user's saved genre preferences into
// /discover `with_genres` queries.
export const GENRE_TMDB_IDS: Record<string, { movie: number[]; tv: number[] }> = {
  Action: { movie: [28], tv: [10759] },
  Adventure: { movie: [12], tv: [10759] },
  Animation: { movie: [16], tv: [16] },
  Comedy: { movie: [35], tv: [35] },
  Crime: { movie: [80], tv: [80] },
  Documentary: { movie: [99], tv: [99] },
  Drama: { movie: [18], tv: [18] },
  Family: { movie: [10751], tv: [10751] },
  Fantasy: { movie: [14], tv: [10765] },
  History: { movie: [36], tv: [] },
  Horror: { movie: [27], tv: [] },
  Music: { movie: [10402], tv: [] },
  Mystery: { movie: [9648], tv: [9648] },
  Romance: { movie: [10749], tv: [] },
  "Sci-Fi": { movie: [878], tv: [10765] },
  Thriller: { movie: [53], tv: [] },
  War: { movie: [10752], tv: [10768] },
  Western: { movie: [37], tv: [37] },
};
