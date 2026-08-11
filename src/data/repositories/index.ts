import { TmdbMediaRepository } from "./tmdb";
import { FirestoreSocialRepository, FirestoreTrackingRepository, FirestoreUserRepository } from "./firestore";

// Single wiring point: production screens only ever import from here.
//
// Catalog reads (trending/search/getById/getEpisodes) are TMDB-backed and
// read-only. Personal data (watch status, ratings, history, lists,
// friends/activity, profile, challenges) is Firestore-backed, one document
// per signed-in user (see ./firestore.ts + ./firestoreUser.ts) — a brand
// new uid has no document yet, so these all come back empty, which is what
// drives every screen's existing EmptyState UI for a new user.
//
// MockMediaRepository/MockTrackingRepository/etc. (./mock.ts) are kept
// as-is and can still be swapped in here for local UI development without
// a TMDB token or a signed-in Firebase user.
export const mediaRepository = new TmdbMediaRepository();
export const trackingRepository = new FirestoreTrackingRepository();
export const socialRepository = new FirestoreSocialRepository();
export const userRepository = new FirestoreUserRepository();

export * from "./types";
