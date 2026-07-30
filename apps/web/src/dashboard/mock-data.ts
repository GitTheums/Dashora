export type DashboardPageId = "home" | "markets" | "gaming" | "homelab";

/** @deprecated Prefer persisted pages from the dashboard API. Kept for widget mock fixtures. */
export const DASHBOARD_PAGES: Array<{ id: DashboardPageId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "markets", label: "Markets" },
  { id: "gaming", label: "Gaming" },
  { id: "homelab", label: "Homelab" },
];

export const mockWeather = {
  location: "Amsterdam",
  condition: "Partly cloudy",
  temperatureC: 17,
  feelsLikeC: 15,
  highC: 19,
  lowC: 12,
  humidity: 68,
  windKph: 14,
  hourly: [
    { hour: "09", tempC: 14 },
    { hour: "10", tempC: 15 },
    { hour: "11", tempC: 16 },
    { hour: "12", tempC: 17 },
    { hour: "13", tempC: 18 },
    { hour: "14", tempC: 19 },
    { hour: "15", tempC: 18 },
    { hour: "16", tempC: 17 },
  ],
};

export const mockCalendar = {
  monthLabel: "July 2026",
  weekLabel: "Week 31",
  today: 30,
  days: [
    { date: 27, outside: true },
    { date: 28, outside: true },
    { date: 29, outside: true },
    { date: 30, outside: false, today: true },
    { date: 31, outside: false },
    { date: 1, outside: true },
    { date: 2, outside: true },
    { date: 3, outside: false },
    { date: 4, outside: false },
    { date: 5, outside: false, event: true },
    { date: 6, outside: false },
    { date: 7, outside: false },
    { date: 8, outside: false },
    { date: 9, outside: false, event: true },
  ],
  upcoming: [
    { time: "10:00", title: "Sprint planning", when: "Today" },
    { time: "14:30", title: "Homelab maintenance", when: "Fri" },
    { time: "09:00", title: "Market review", when: "Mon" },
  ],
};

export const mockRss = [
  {
    id: "rss-1",
    title: "Designing calm data surfaces for dense dashboards",
    source: "Interface Notes",
    age: "2h",
  },
  {
    id: "rss-2",
    title: "Why personal ops tools should feel native, not busy",
    source: "Localhost Weekly",
    age: "5h",
  },
  {
    id: "rss-3",
    title: "A practical guide to readable status indicators",
    source: "Signal Craft",
    age: "1d",
  },
  {
    id: "rss-4",
    title: "Self-hosted caching patterns that stay honest",
    source: "Ops Digest",
    age: "1d",
  },
];

export const mockHackerNews = [
  {
    id: "hn-1",
    title: "Show HN: A tiny layout engine for personal dashboards",
    points: 312,
    comments: 84,
    age: "3h",
    domain: "github.com",
  },
  {
    id: "hn-2",
    title: "SQLite as an application file format, revisited",
    points: 487,
    comments: 129,
    age: "6h",
    domain: "sqlite.org",
  },
  {
    id: "hn-3",
    title: "The case for slower refresh loops in monitoring UIs",
    points: 198,
    comments: 61,
    age: "8h",
    domain: "blog.example",
  },
  {
    id: "hn-4",
    title: "Accessible focus states that survive dark mode",
    points: 156,
    comments: 42,
    age: "11h",
    domain: "a11y.dev",
  },
];

export const mockVideos = [
  {
    id: "vid-1",
    title: "Building a resilient widget cache",
    creator: "Ops Lab",
    age: "12h",
    duration: "14:22",
    hue: 262,
  },
  {
    id: "vid-2",
    title: "Weather APIs without the surprise bill",
    creator: "Northwind Cloud",
    age: "1d",
    duration: "09:48",
    hue: 198,
  },
  {
    id: "vid-3",
    title: "Microcharts that stay out of the way",
    creator: "Chart Garden",
    age: "2d",
    duration: "11:05",
    hue: 168,
  },
];

export const mockRepository = {
  name: "dashora/dashora",
  description: "Self-hosted personal dashboard",
  stars: 1284,
  forks: 96,
  openPullRequests: [
    { id: "pr-1", title: "Add widget shell state banners", age: "2h" },
    { id: "pr-2", title: "Tighten grid spacing tokens", age: "1d" },
  ],
  openIssues: [
    { id: "issue-1", title: "Document layout span conventions", age: "3d" },
    { id: "issue-2", title: "Improve stale refresh copy", age: "5d" },
  ],
};

export const mockMarkets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: "$67,420",
    changePct: 2.14,
    sparkline: [62, 64, 63, 66, 65, 68, 67, 70, 69, 72],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: "$3,418",
    changePct: -1.22,
    sparkline: [78, 76, 77, 74, 73, 75, 72, 71, 70, 69],
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    price: "$128.40",
    changePct: 0.86,
    sparkline: [55, 56, 58, 57, 60, 59, 61, 63, 62, 64],
  },
  {
    symbol: "AAPL",
    name: "Apple",
    price: "$214.90",
    changePct: -0.34,
    sparkline: [70, 71, 69, 68, 70, 69, 67, 68, 66, 65],
  },
];

export const mockBookmarks = [
  { id: "bm-1", label: "Dashora docs", url: "docs.local", group: "Product" },
  { id: "bm-2", label: "Homelab grafana", url: "grafana.lan", group: "Ops" },
  { id: "bm-3", label: "RSS reader", url: "feeds.lan", group: "Reading" },
  { id: "bm-4", label: "Market board", url: "markets.lan", group: "Finance" },
  { id: "bm-5", label: "CI status", url: "ci.lan", group: "Ops" },
  { id: "bm-6", label: "Design tokens", url: "tokens.local", group: "Product" },
];

export const mockServices = [
  { id: "svc-1", name: "API gateway", status: "operational" as const, latencyMs: 42 },
  { id: "svc-2", name: "Media server", status: "operational" as const, latencyMs: 18 },
  { id: "svc-3", name: "Backup agent", status: "degraded" as const, latencyMs: 210 },
  { id: "svc-4", name: "DNS resolver", status: "operational" as const, latencyMs: 9 },
  { id: "svc-5", name: "VPN endpoint", status: "down" as const, latencyMs: null },
  { id: "svc-6", name: "Photo library", status: "operational" as const, latencyMs: 55 },
];
