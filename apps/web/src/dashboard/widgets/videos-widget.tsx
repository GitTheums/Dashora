import { mockVideos } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function VideosWidget() {
  return (
    <WidgetShell
      title="Videos"
      description="Recent uploads"
      variant="media"
      colSpan={4}
      tabletSpan={8}
      mobileSpan={4}
    >
      <div className="video-grid">
        {mockVideos.map((video) => (
          <a key={video.id} className="video-card" href={`#video-${video.id}`}>
            <div
              className="video-card__thumb"
              style={{
                background: `linear-gradient(145deg, hsl(${video.hue} 55% 42%), hsl(${video.hue + 28} 45% 22%))`,
              }}
            >
              <span className="video-card__duration meta-value">{video.duration}</span>
            </div>
            <p className="list-title">{video.title}</p>
            <p className="list-meta">
              <span>{video.creator}</span>
              <span aria-hidden="true">·</span>
              <span className="meta-value">{video.age}</span>
            </p>
          </a>
        ))}
      </div>
    </WidgetShell>
  );
}
