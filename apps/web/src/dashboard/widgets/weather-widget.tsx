import { BarChart } from "../microcharts.js";
import { mockWeather } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function WeatherWidget() {
  return (
    <WidgetShell
      title="Weather"
      description={mockWeather.location}
      variant="hero"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={4}
    >
      <div className="weather-widget">
        <div className="weather-widget__hero">
          <div>
            <p className="weather-widget__temp">
              <span className="weather-widget__temp-value">{mockWeather.temperatureC}</span>
              <span className="weather-widget__temp-unit">°C</span>
            </p>
            <p className="weather-widget__condition">{mockWeather.condition}</p>
          </div>
          <div className="weather-widget__meta">
            <div>
              <span className="meta-label">Feels like</span>
              <span className="meta-value">{mockWeather.feelsLikeC}°</span>
            </div>
            <div>
              <span className="meta-label">High / low</span>
              <span className="meta-value">
                {mockWeather.highC}° / {mockWeather.lowC}°
              </span>
            </div>
            <div>
              <span className="meta-label">Wind</span>
              <span className="meta-value">{mockWeather.windKph} km/h</span>
            </div>
            <div>
              <span className="meta-label">Humidity</span>
              <span className="meta-value">{mockWeather.humidity}%</span>
            </div>
          </div>
        </div>
        <BarChart
          values={mockWeather.hourly.map((item) => ({ label: item.hour, value: item.tempC }))}
          activeIndex={3}
        />
      </div>
    </WidgetShell>
  );
}
