"use client";

import { useState } from "react";
import { LocalTime } from "@/components/LocalTime";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import styles from "./Gallery.module.css";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const TONES: BadgeTone[] = ["neutral", "accent", "info", "success", "danger"];

/** Every shared component and variant, with a toggle to force dark. */
export function Gallery() {
  const [forceDark, setForceDark] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const toast = useToast();

  return (
    <div className={styles.gallery} data-theme={forceDark ? "dark" : undefined}>
      <PageHeader
        title="Components"
        subtitle="Dev gallery. Follows the system scheme unless forced dark."
        actions={
          <Button variant="secondary" onClick={() => setForceDark((v) => !v)}>
            {forceDark ? "Follow system" : "Force dark"}
          </Button>
        }
      />
      <div className={styles.stack}>
        <Panel title="Buttons">
          {VARIANTS.map((variant) => (
            <div key={variant} className={styles.row}>
              {SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {variant} {size}
                </Button>
              ))}
              <Button variant={variant} loading>
                Loading
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          ))}
        </Panel>

        <Panel title="Text field">
          <div className={styles.stack}>
            <TextField label="Plain" placeholder="Type here" />
            <TextField label="With hint" hint="Shown to other players." />
            <TextField label="With error" error="Enter 1 to 40 characters." />
          </div>
        </Panel>

        <Panel title="Badges">
          <div className={styles.row}>
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </div>
        </Panel>

        <Panel title="Dialog and toasts">
          <div className={styles.row}>
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button
              variant="secondary"
              onClick={() => toast.show("Info toast")}
            >
              Info toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.show("Saved", "success")}
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.show("Failed", "danger")}
            >
              Danger toast
            </Button>
          </div>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Start the draft?"
          >
            <p>This locks joining and splits players into groups.</p>
            <div className={styles.row}>
              <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </Dialog>
        </Panel>

        <Panel title="States">
          <div className={styles.stack}>
            <EmptyState
              title="No squares yet"
              message="Upload a CSV or add one at a time."
              action={<Button>Add square</Button>}
            />
            <ErrorState message="Could not load the pool." onRetry={() => {}} />
            <div className={styles.row}>
              <Spinner />
              <span>Spinner</span>
            </div>
            <Skeleton lines={3} />
          </div>
        </Panel>

        <Panel title="Type and time">
          <h1>Heading one</h1>
          <h2>Heading two</h2>
          <p>Body text in Inter. Muted and links follow tokens.</p>
          <p className={styles.numeral}>00:42</p>
          <p>
            Draft starts <LocalTime iso="2026-03-01T19:00:00.000Z" />
          </p>
        </Panel>
      </div>
    </div>
  );
}
