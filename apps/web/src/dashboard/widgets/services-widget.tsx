import { cx } from "@dashora/ui";
import { mockServices } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

const STATUS_LABEL = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
} as const;

export function ServicesWidget() {
  return (
    <WidgetShell
      title="Service status"
      description="Homelab"
      variant="dense"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={2}
    >
      <ul className="service-list">
        {mockServices.map((service) => (
          <li key={service.id} className="service-list__item">
            <span
              className={cx("status-dot", `status-dot--${service.status}`)}
              aria-hidden="true"
            />
            <div className="service-list__copy">
              <p className="list-title">{service.name}</p>
              <p className="list-meta">
                <span className="visually-hidden">Status:</span>
                {STATUS_LABEL[service.status]}
              </p>
            </div>
            <span className="meta-value service-list__latency">
              {service.latencyMs === null ? "—" : `${service.latencyMs} ms`}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
