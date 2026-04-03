export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Whirr
      </h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        실시간 음성 전사 앱입니다. 녹음 및 STT UI는 다음 피쳐에서 연결됩니다.
      </p>
    </main>
  );
}
