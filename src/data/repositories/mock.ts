import { mockEpisodes, mockMedia } from "../mock/media";
import { mockActivity, mockFriends } from "../mock/social";
import { mockHistory, mockLists, mockUpcoming, mockUser } from "../mock/user";
import { UserProfile, WatchStatus } from "@/types/media";
import { MediaRepository, SocialRepository, TrackingRepository, UserRepository } from "./types";
import { deriveEffectiveStatus, isAwaitingUnreleasedEpisode } from "@/domain/watchStatus";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export class MockMediaRepository implements MediaRepository {
  async listTrending() {
    await delay();
    // With only a handful of mock titles, "trending" is the full catalog —
    // Discover's Series/Movies/genre sections need enough items to be
    // meaningfully populated rather than the previous 3-item slice.
    return mockMedia;
  }
  async listComingSoon() {
    await delay();
    // Approximation for the mock repository: current-or-future year is close
    // enough for dev data — the real TMDB repository does exact date
    // filtering (see TmdbMediaRepository.listComingSoon).
    return mockMedia.filter((m) => m.year >= new Date().getFullYear());
  }
  async browseCatalog() {
    await delay();
    return { items: mockMedia, hasMore: false };
  }
  async listForYou(preferences: { genres: string[]; platforms: string[] }) {
    await delay();
    // Mock titles carry no platform data, so only genres are applied here.
    if (preferences.genres.length === 0) return [];
    return mockMedia.filter((m) => m.genres.some((g) => preferences.genres.includes(g)));
  }
  async listContinueWatching() {
    await delay();
    // Same real-progress-derived logic as TmdbMediaRepository: series are
    // "watching" based on actual watched-episode count, not just the raw
    // stored status flag.
    return mockMedia
      .map((m) => {
        const watchedEpisodeCount =
          m.kind === "movie" ? 0 : mockEpisodes.filter((e) => e.seriesId === m.id && e.watched).length;
        return { ...m, watchedEpisodeCount, status: deriveEffectiveStatus(m, watchedEpisodeCount) };
      })
      .filter((m) => m.status === "watching" && !isAwaitingUnreleasedEpisode(m, m.watchedEpisodeCount))
      .map(({ watchedEpisodeCount, ...m }) => m);
  }
  async search(query: string) {
    await delay(150);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return mockMedia.filter((m) => m.title.toLowerCase().includes(q));
  }
  async getById(id: string) {
    await delay();
    return mockMedia.find((m) => m.id === id);
  }
  async getEpisodes(seriesId: string, season?: number) {
    await delay();
    return mockEpisodes.filter((e) => e.seriesId === seriesId && (season === undefined || e.season === season));
  }
  async getEpisodeById(episodeId: string) {
    await delay();
    return mockEpisodes.find((e) => e.id === episodeId);
  }
  async getRecommendations(id: string) {
    await delay();
    const source = mockMedia.find((m) => m.id === id);
    if (!source) return [];
    // No real recommendation engine in mock mode — same-genre titles (minus
    // itself) is a reasonable stand-in.
    return mockMedia.filter((m) => m.id !== id && m.genres.some((g) => source.genres.includes(g)));
  }
  async setWatchStatus(mediaId: string, status: WatchStatus | null) {
    await delay(100);
    const m = mockMedia.find((x) => x.id === mediaId);
    if (m) m.status = status ?? undefined;
  }
  async setUserRating(mediaId: string, rating: number) {
    await delay(100);
    const m = mockMedia.find((x) => x.id === mediaId);
    if (m) m.userRating = rating;
  }
  async toggleEpisodeWatched(episodeId: string) {
    await delay(100);
    const e = mockEpisodes.find((x) => x.id === episodeId);
    if (e) e.watched = !e.watched;
  }
  async setEpisodesWatched(episodeIds: string[], watched: boolean) {
    await delay(100);
    for (const id of episodeIds) {
      const e = mockEpisodes.find((x) => x.id === id);
      if (e) e.watched = watched;
    }
  }
  async getSeriesWatchedEpisodeCount(seriesId: string) {
    return mockEpisodes.filter((e) => e.seriesId === seriesId && e.watched).length;
  }
}

export class MockTrackingRepository implements TrackingRepository {
  async getUpcoming() {
    await delay();
    return mockUpcoming;
  }
  async getHistory() {
    await delay();
    return mockHistory;
  }
  async logWatch(_label: string) {
    await delay(100);
  }
  async removeWatch() {
    await delay(100);
  }
}

export class MockSocialRepository implements SocialRepository {
  async getFriends() {
    await delay();
    return mockFriends;
  }
  async getActivityFeed() {
    await delay();
    return mockActivity;
  }
}

const mockFavorites: string[] = [];

export class MockUserRepository implements UserRepository {
  async toggleFavorite(mediaId: string) {
    await delay(100);
    const idx = mockFavorites.indexOf(mediaId);
    if (idx >= 0) {
      mockFavorites.splice(idx, 1);
      return false;
    }
    mockFavorites.push(mediaId);
    return true;
  }
  async getProfile() {
    await delay();
    return mockUser;
  }
  async getLists() {
    await delay();
    return mockLists;
  }

  async updateProfile(
    patch: Partial<Pick<UserProfile, "firstName" | "bio" | "avatarColor" | "avatarIcon" | "bannerMode" | "bannerImageUri">>
  ) {
    await delay(150);
    Object.assign(mockUser, patch);
    return mockUser;
  }
  async createList(name: string) {
    await delay(150);
    const list = { id: `list-${Date.now()}`, name, mediaIds: [] as string[] };
    mockLists.push(list);
    return list;
  }
  async renameList(listId: string, name: string) {
    await delay(100);
    const list = mockLists.find((l) => l.id === listId);
    if (list) list.name = name;
  }
  async removeFromList(listId: string, mediaId: string) {
    await delay(100);
    const list = mockLists.find((l) => l.id === listId);
    if (list) list.mediaIds = list.mediaIds.filter((id) => id !== mediaId);
  }
  async addToList(listId: string, mediaId: string) {
    await delay(100);
    const list = mockLists.find((l) => l.id === listId);
    if (list && !list.mediaIds.includes(mediaId)) list.mediaIds.push(mediaId);
  }
}
