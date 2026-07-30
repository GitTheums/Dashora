import { mockRss } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function RssWidget() {
  return (
    <WidgetShell
      title="Reading list"
      description="RSS"
      variant="default"
      colSpan={4}
      tabletSpan={4}
      mobileSpan={4}
    >
      <ul className="feed-list">
        {mockRss.map((item) => (
          <li key={item.id}>
            <a className="feed-list__link" href={`#rss-${item.id}`}>
              <p className="list-title">{item.title}</p>
              <p className="list-meta">
                <span>{item.source}</span>
                <span aria-hidden="true">·</span>
                <span className="meta-value">{item.age}</span>
              </p>
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
