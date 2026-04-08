import { MainShell } from "@/components/main-shell";
import { SessionDetail } from "@/components/session-detail";

export default function SessionPage() {
  return (
    <MainShell>
      <div className="flex w-full justify-center">
        <SessionDetail />
      </div>
    </MainShell>
  );
}
