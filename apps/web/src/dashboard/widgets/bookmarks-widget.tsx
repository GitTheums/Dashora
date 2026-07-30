import { mockBookmarks } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function BookmarksWidget() {
  return (
    <WidgetShell
      title="Bookmarks"
      description="Quick links"
      variant="utility"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={2}
    >
      <ul className="bookmark-grid">
        {mockBookmarks.map((item) => (
          <li key={item.id}>
            <a className="bookmark-card" href={`#bookmark-${item.id}`}>
              <span className="bookmark-card__group">{item.group}</span>
              <span className="list-title">{item.label}</span>
              <span className="list-meta meta-value">{item.url}</span>
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
