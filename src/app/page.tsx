import { HomeContent } from "@/components/home-content";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Whirr
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          실시간 음성 전사 앱입니다. 마이크를 허용한 뒤 녹음을 시작하세요.
        </p>
      </div>
      <HomeContent />
    </main>
  );
}
