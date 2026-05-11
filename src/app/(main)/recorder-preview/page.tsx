import { RecorderUiPreview } from "@/components/recorder-ui-preview";
import { notFound } from "next/navigation";

export default function RecorderPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-6">
      <RecorderUiPreview />
    </div>
  );
}
