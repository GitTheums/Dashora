import { Badge } from "@dashora/ui";
import { mockRepository } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function RepositoryWidget() {
  return (
    <WidgetShell
      title="Repository"
      description={mockRepository.name}
      variant="default"
      colSpan={4}
      tabletSpan={4}
      mobileSpan={4}
    >
      <div className="repo-widget">
        <p className="repo-widget__desc">{mockRepository.description}</p>
        <div className="repo-widget__stats">
          <Badge tone="neutral">{mockRepository.stars} stars</Badge>
          <Badge tone="neutral">{mockRepository.forks} forks</Badge>
        </div>
        <div className="repo-widget__columns">
          <section>
            <h3 className="section-label">Open pull requests</h3>
            <ul className="compact-list">
              {mockRepository.openPullRequests.map((item) => (
                <li key={item.id}>
                  <p className="list-title">{item.title}</p>
                  <p className="list-meta">
                    <span className="meta-value">{item.age}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="section-label">Open issues</h3>
            <ul className="compact-list">
              {mockRepository.openIssues.map((item) => (
                <li key={item.id}>
                  <p className="list-title">{item.title}</p>
                  <p className="list-meta">
                    <span className="meta-value">{item.age}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </WidgetShell>
  );
}
