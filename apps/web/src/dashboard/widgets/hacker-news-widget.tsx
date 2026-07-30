import { mockHackerNews } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function HackerNewsWidget() {
  return (
    <WidgetShell
      title="Hacker News"
      description="Top stories"
      variant="default"
      colSpan={5}
      tabletSpan={8}
      mobileSpan={4}
    >
      <ol className="story-list">
        {mockHackerNews.map((item, index) => (
          <li key={item.id} className="story-list__item">
            <span className="story-list__rank meta-value" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <a className="list-title story-list__title" href={`#hn-${item.id}`}>
                {item.title}
              </a>
              <p className="list-meta">
                <span className="meta-value">{item.points}</span> points
                <span aria-hidden="true">·</span>
                <span className="meta-value">{item.comments}</span> comments
                <span aria-hidden="true">·</span>
                <span className="meta-value">{item.age}</span>
                <span aria-hidden="true">·</span>
                <span>{item.domain}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </WidgetShell>
  );
}
