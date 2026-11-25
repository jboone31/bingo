import { LocalTime } from "@/components/LocalTime";

/** The draft date in the viewer's time zone, or a note that it is not set. */
export function DraftDateLine({ draftAt }: { draftAt: string | null }) {
  return (
    <p>
      {draftAt ? (
        <>
          Draft: <LocalTime iso={draftAt} />
        </>
      ) : (
        "Draft date to be set"
      )}
    </p>
  );
}
