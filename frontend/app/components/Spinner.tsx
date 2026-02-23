export default function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-zinc-300 border-t-zinc-800" />
      <p className="text-zinc-500 text-sm">Processing your request...</p>
    </div>
  );
}
