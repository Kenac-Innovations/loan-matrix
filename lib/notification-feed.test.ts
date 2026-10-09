import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alertToFeedItem,
  filterFeed,
  groupFeedByDay,
  notificationToFeedItem,
  parseFeedDate,
  relativeTime,
  toInternalHref,
  type FeedItem,
} from "./notification-feed";
import type { FineractNotification } from "../shared/types/notification";

// Local time, so the day boundaries are the same in every timezone
const NOW = new Date(2026, 9, 9, 12, 0, 0); // 9 Oct 2026, 12:00

function item(overrides: Partial<FeedItem> & { key: string }): FeedItem {
  return {
    source: "alert",
    id: overrides.key,
    title: "Title",
    body: "",
    createdAt: null,
    isRead: false,
    href: null,
    actionLabel: null,
    kind: "INFO",
    ...overrides,
  };
}

test("parseFeedDate handles ISO strings", () => {
  const iso = "2026-10-09T10:15:00.000Z";
  assert.equal(parseFeedDate(iso)?.getTime(), Date.parse(iso));
});

test("parseFeedDate handles Fineract [y, m, d, h, min, s] arrays with 1-based month", () => {
  assert.deepEqual(
    parseFeedDate([2026, 10, 9, 8, 30, 15]),
    new Date(2026, 9, 9, 8, 30, 15)
  );
});

test("parseFeedDate defaults missing time parts in arrays to midnight", () => {
  assert.deepEqual(parseFeedDate([2026, 3, 12]), new Date(2026, 2, 12));
});

test("parseFeedDate rejects empty, missing and invalid values", () => {
  assert.equal(parseFeedDate(null), null);
  assert.equal(parseFeedDate(undefined), null);
  assert.equal(parseFeedDate(""), null);
  assert.equal(parseFeedDate("not a date"), null);
  assert.equal(parseFeedDate([2026, 13, 1]), null);
  assert.equal(parseFeedDate([2026, 2, 31]), null);
});

test("alertToFeedItem maps alert fields", () => {
  const feed = alertToFeedItem({
    id: "abc",
    type: "WARNING",
    title: "Cash variance",
    message: "Short by 20",
    actionUrl: "/cashier",
    actionLabel: "Review",
    isRead: false,
    createdAt: "2026-10-09T10:00:00.000Z",
  });
  assert.equal(feed.key, "alert:abc");
  assert.equal(feed.source, "alert");
  assert.equal(feed.title, "Cash variance");
  assert.equal(feed.body, "Short by 20");
  assert.equal(feed.href, "/cashier");
  assert.equal(feed.actionLabel, "Review");
  assert.equal(feed.kind, "WARNING");
  assert.equal(feed.isRead, false);
  assert.equal(feed.createdAt?.getTime(), Date.parse("2026-10-09T10:00:00.000Z"));
});

test("notificationToFeedItem humanises the action and derives the category", () => {
  const base: FineractNotification = {
    id: 7,
    objectType: "Loan",
    objectId: 1,
    action: "created",
    actorId: 1,
    content: "Loan 000123 created",
    isRead: true,
    isSystemGenerated: false,
    createdAt: [2026, 10, 9, 9, 0, 0],
  };
  const feed = notificationToFeedItem(base);
  assert.equal(feed.key, "notification:7");
  assert.equal(feed.source, "notification");
  assert.equal(feed.title, "Created");
  assert.equal(feed.body, "Loan 000123 created");
  assert.equal(feed.kind, "LOAN");
  assert.equal(feed.isRead, true);
  assert.equal(feed.href, null);
  assert.deepEqual(feed.createdAt, new Date(2026, 9, 9, 9, 0, 0));

  const fallback = notificationToFeedItem({ ...base, action: "", objectType: "" });
  assert.equal(fallback.title, "Notification");
  assert.equal(fallback.kind, "OTHER");
});

test("groupFeedByDay puts items into Today, Yesterday and Earlier at day boundaries", () => {
  const items = [
    item({ key: "today-start", createdAt: new Date(2026, 9, 9, 0, 0, 0) }),
    item({ key: "today-noon", createdAt: new Date(2026, 9, 9, 11, 0, 0) }),
    item({ key: "yesterday-end", createdAt: new Date(2026, 9, 8, 23, 59, 59, 999) }),
    item({ key: "yesterday-start", createdAt: new Date(2026, 9, 8, 0, 0, 0) }),
    item({ key: "earlier-end", createdAt: new Date(2026, 9, 7, 23, 59, 59, 999) }),
    item({ key: "undated", createdAt: null }),
  ];

  const groups = groupFeedByDay(items, NOW);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Today", "Yesterday", "Earlier"]
  );
  assert.deepEqual(
    groups[0].items.map((i) => i.key),
    ["today-noon", "today-start"]
  );
  assert.deepEqual(
    groups[1].items.map((i) => i.key),
    ["yesterday-end", "yesterday-start"]
  );
  assert.deepEqual(
    groups[2].items.map((i) => i.key),
    ["earlier-end", "undated"]
  );
});

test("groupFeedByDay omits empty groups", () => {
  const groups = groupFeedByDay(
    [item({ key: "old", createdAt: new Date(2026, 8, 1, 10, 0, 0) })],
    NOW
  );
  assert.deepEqual(groups.map((group) => group.label), ["Earlier"]);
  assert.deepEqual(groupFeedByDay([], NOW), []);
});

test("groupFeedByDay sorts newest first and does not mutate the input", () => {
  const items = [
    item({ key: "a", createdAt: new Date(2026, 9, 9, 1, 0, 0) }),
    item({ key: "b", createdAt: new Date(2026, 9, 9, 10, 0, 0) }),
    item({ key: "c", createdAt: new Date(2026, 9, 9, 5, 0, 0) }),
  ];
  const before = items.map((i) => i.key);
  const groups = groupFeedByDay(items, NOW);
  assert.deepEqual(groups[0].items.map((i) => i.key), ["b", "c", "a"]);
  assert.deepEqual(items.map((i) => i.key), before);
});

test("filterFeed supports all, unread and alerts tabs", () => {
  const items = [
    item({ key: "alert-unread", source: "alert", isRead: false }),
    item({ key: "alert-read", source: "alert", isRead: true }),
    item({ key: "notif-unread", source: "notification", isRead: false }),
    item({ key: "notif-read", source: "notification", isRead: true }),
  ];
  assert.deepEqual(
    filterFeed(items, "all").map((i) => i.key),
    ["alert-unread", "alert-read", "notif-unread", "notif-read"]
  );
  assert.deepEqual(
    filterFeed(items, "unread").map((i) => i.key),
    ["alert-unread", "notif-unread"]
  );
  assert.deepEqual(
    filterFeed(items, "alerts").map((i) => i.key),
    ["alert-unread", "alert-read"]
  );
});

test("relativeTime buckets", () => {
  assert.equal(relativeTime(new Date(NOW.getTime() - 30_000), NOW), "Just now");
  assert.equal(relativeTime(new Date(NOW.getTime() + 30_000), NOW), "Just now");
  assert.equal(relativeTime(new Date(NOW.getTime() - 5 * 60_000), NOW), "5 min ago");
  assert.equal(relativeTime(new Date(NOW.getTime() - 59 * 60_000), NOW), "59 min ago");
  assert.equal(relativeTime(new Date(2026, 9, 9, 9, 0, 0), NOW), "3 h ago");
  assert.equal(relativeTime(new Date(2026, 9, 9, 0, 30, 0), NOW), "11 h ago");
  assert.equal(relativeTime(new Date(2026, 9, 8, 23, 30, 0), NOW), "Yesterday");
  assert.equal(relativeTime(new Date(2026, 9, 3, 8, 0, 0), NOW), "3 Oct");
  assert.equal(relativeTime(new Date(2026, 2, 12, 8, 0, 0), NOW), "12 Mar");
  assert.equal(relativeTime(new Date(2025, 2, 12, 8, 0, 0), NOW), "12 Mar 2025");
});

test("toInternalHref keeps in-app paths and drops external URLs", () => {
  assert.equal(toInternalHref("/clients/12"), "/clients/12");
  assert.equal(toInternalHref("https://evil.example"), null);
  assert.equal(toInternalHref("//evil.example"), null);
  assert.equal(toInternalHref("/\\evil.example"), null);
  assert.equal(toInternalHref(null), null);
});
