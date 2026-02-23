import VoiceRecorder from "./components/VoiceRecorder";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 mb-1">
          Voice AI Travel Planner
        </h1>
        <p className="text-zinc-500 mb-8">
          Click record and tell me where you want to go
        </p>
        <VoiceRecorder />
      </div>
    </div>
  );
}
