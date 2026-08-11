import { ActivityItem, Friend } from "@/types/media";

export const mockFriends: Friend[] = [
  { id: "lea", name: "Lea", xp: 1240 },
  { id: "theo", name: "Theo", xp: 980 },
  { id: "nina", name: "Nina", xp: 12 },
  { id: "marc", name: "Marc", xp: 210 },
];

export const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    friendName: "Lea",
    action: "watched the finale of Fault Lines",
    timeAgo: "2d ago",
    mediaTitle: "Fault Lines",
    artworkColor: "#274257",
    rating: 5,
    likeCount: 6,
  },
  {
    id: "act-2",
    friendName: "Theo",
    action: "started Nocturne",
    timeAgo: "5d ago",
    mediaTitle: "Nocturne",
    artworkColor: "#5B3A5C",
    likeCount: 2,
  },
];
