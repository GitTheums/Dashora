import { Stack } from "@dashora/ui";

export type AppProps = {
  appName: string;
};

export function App({ appName }: AppProps) {
  return (
    <main className="page">
      <Stack gap="md" className="panel">
        <p className="eyebrow">{appName}</p>
        <h1>Dashora development environment is running</h1>
        <p className="lede">
          Frontend and API scaffolding are ready. Add widgets and routes when you are prepared to
          build features.
        </p>
      </Stack>
    </main>
  );
}
