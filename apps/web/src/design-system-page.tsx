import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CommandMenu,
  type CommandMenuItem,
  Dialog,
  Drawer,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  SectionHeader,
  Select,
  Skeleton,
  Stack,
  Switch,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTrigger,
  Tooltip,
  useTheme,
} from "@dashora/ui";
import { type ReactNode, useMemo, useState } from "react";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.2 9.4A5.75 5.75 0 0 1 6.6 2.8 5.75 5.75 0 1 0 13.2 9.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.75v1.25M8 13v1.25M1.75 8H3M13 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DemoSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="ds-page__section">
      <SectionHeader title={title} description={description} eyebrow="Primitive" />
      <div className="ds-page__canvas">{children}</div>
    </section>
  );
}

export function DesignSystemPage() {
  const { resolved, toggle, mode, setMode } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);

  const commandItems = useMemo<CommandMenuItem[]>(
    () => [
      {
        id: "theme",
        label: "Toggle theme",
        group: "Appearance",
        shortcut: "T",
        onSelect: toggle,
      },
      {
        id: "dialog",
        label: "Open dialog",
        group: "Overlays",
        onSelect: () => {
          setDialogOpen(true);
        },
      },
      {
        id: "drawer",
        label: "Open drawer",
        group: "Overlays",
        onSelect: () => {
          setDrawerOpen(true);
        },
      },
      {
        id: "disabled",
        label: "Disabled action",
        group: "Overlays",
        disabled: true,
      },
    ],
    [toggle],
  );

  return (
    <div className="ds-page">
      <header className="ds-page__topbar">
        <div>
          <p className="ds-page__eyebrow">Private development route</p>
          <h1 className="ds-page__title">Dashora design system</h1>
        </div>
        <div className="ds-page__topbar-actions">
          <Select
            aria-label="Theme mode"
            value={mode}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "light" || next === "dark" || next === "system") {
                setMode(next);
              }
            }}
            options={[
              { value: "system", label: "System" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
          />
          <IconButton label="Toggle light and dark" variant="solid" onClick={toggle}>
            {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
          </IconButton>
          <Button variant="secondary" onClick={() => setCommandOpen(true)}>
            Command menu
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Home
          </Button>
        </div>
      </header>

      <Stack gap="xl">
        <DemoSection
          title="Buttons"
          description="Primary, secondary, ghost, and danger actions with size and disabled states."
        >
          <div className="ds-page__row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <IconButton label="Settings" variant="solid">
              <SettingsIcon />
            </IconButton>
            <IconButton label="Settings ghost" disabled>
              <SettingsIcon />
            </IconButton>
          </div>
        </DemoSection>

        <DemoSection title="Badges" description="Compact metadata chips using mono type.">
          <div className="ds-page__row">
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="secondary">Secondary</Badge>
            <Badge tone="success">Ready</Badge>
            <Badge tone="warning">Stale</Badge>
            <Badge tone="danger">Error</Badge>
          </div>
        </DemoSection>

        <DemoSection
          title="Cards"
          description="Layered surfaces with 16–20px radii and thin borders."
        >
          <div className="ds-page__grid">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Default card</CardTitle>
                  <CardDescription>Quiet border and restrained shadow.</CardDescription>
                </div>
                <Badge tone="secondary">live</Badge>
              </CardHeader>
              <CardBody>Dense content remains readable without crowding controls.</CardBody>
              <CardFooter>
                <Button size="sm" variant="secondary">
                  Configure
                </Button>
                <Button size="sm">Refresh</Button>
              </CardFooter>
            </Card>
            <Card elevated interactive>
              <CardHeader>
                <div>
                  <CardTitle>Elevated interactive</CardTitle>
                  <CardDescription>Hover feedback without glass effects.</CardDescription>
                </div>
              </CardHeader>
              <CardBody>Use for clickable widget shells and selection states.</CardBody>
            </Card>
          </div>
        </DemoSection>

        <DemoSection title="Tabs" description="Keyboard-reachable segmented navigation.">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="states" disabled>
                Disabled
              </TabsTrigger>
            </TabsList>
            <TabsPanel value="overview">
              <p className="ds-page__copy">
                Cool stone neutrals with pine primary and steel secondary accents.
              </p>
            </TabsPanel>
            <TabsPanel value="tokens">
              <p className="ds-page__copy">
                Colors, typography, spacing, radii, shadows, motion, z-index, and breakpoints.
              </p>
            </TabsPanel>
          </Tabs>
        </DemoSection>

        <DemoSection
          title="Form controls"
          description="Inputs, selects, and switches with validation."
        >
          <div className="ds-page__grid">
            <Input label="Widget title" placeholder="Weather" hint="Shown in the widget chrome." />
            <Input label="API token" mono placeholder="ds_••••" error="Token format is invalid." />
            <Select
              label="Refresh interval"
              defaultValue="5m"
              options={[
                { value: "1m", label: "Every minute" },
                { value: "5m", label: "Every 5 minutes" },
                { value: "15m", label: "Every 15 minutes" },
              ]}
            />
            <Switch
              label="Enable auto-refresh"
              checked={switchOn}
              onChange={(event) => {
                setSwitchOn(event.target.checked);
              }}
            />
            <Switch label="Disabled switch" disabled />
          </div>
        </DemoSection>

        <DemoSection title="Feedback" description="Loading, empty, and error presentations.">
          <div className="ds-page__grid">
            <Card>
              <CardTitle>Skeleton</CardTitle>
              <Stack gap="sm">
                <Skeleton variant="title" />
                <Skeleton variant="text" />
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="block" />
              </Stack>
            </Card>
            <EmptyState
              title="No widgets yet"
              description="Add a widget to this page when you are ready to compose the dashboard."
              action={<Button size="sm">Add widget</Button>}
            />
            <ErrorState
              title="Failed to load feed"
              description="The provider request timed out. Check connectivity, then try again."
              action={
                <Button size="sm" variant="secondary">
                  Retry
                </Button>
              }
            />
          </div>
        </DemoSection>

        <DemoSection
          title="Overlays"
          description="Tooltip, menu, dialog, drawer, and command shell."
        >
          <div className="ds-page__row">
            <Tooltip content="Visible keyboard focus and calm hover timing.">
              <Button variant="secondary">Hover tooltip</Button>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="secondary">Open menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => undefined}>Edit layout</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => undefined}>Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger onSelect={() => undefined}>
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
            <Button variant="ghost" onClick={() => setCommandOpen(true)}>
              Open command menu
            </Button>
          </div>
        </DemoSection>

        <DemoSection
          title="Section header"
          description="Page and panel titles with optional actions."
        >
          <SectionHeader
            eyebrow="Page"
            title="Operations"
            description="High-density monitoring surfaces without cramped spacing."
            actions={
              <>
                <Button size="sm" variant="secondary">
                  Export
                </Button>
                <Button size="sm">Add widget</Button>
              </>
            }
          />
        </DemoSection>
      </Stack>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Confirm refresh"
        description="Stale provider data will be replaced with a fresh response."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Refresh now</Button>
          </>
        }
      >
        <p className="ds-page__copy">
          Dialogs trap focus, restore it on close, and honor Escape and reduced motion.
        </p>
      </Dialog>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Widget settings"
        description="Configuration stays on the server; secrets never reach the browser."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDrawerOpen(false)}>Save</Button>
          </>
        }
      >
        <Stack gap="md">
          <Input label="Display name" defaultValue="Status" />
          <Select
            label="Density"
            defaultValue="comfortable"
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ]}
          />
        </Stack>
      </Drawer>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} items={commandItems} />
    </div>
  );
}
