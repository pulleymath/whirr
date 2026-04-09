import { MainAppProviders } from "@/components/providers/main-app-providers";

export default function MainRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <MainAppProviders>{children}</MainAppProviders>
    </main>
  );
}
