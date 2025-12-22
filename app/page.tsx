import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="Popqiz"
            width={300}
            height={150}
            priority
            className="w-auto h-auto max-w-full"
          />
        </div>

        {/* Primary CTA */}
        <Link
          href="/start"
          className="block w-full bg-brand text-white text-xl font-semibold py-5 px-6 rounded-2xl text-center shadow-lg active:scale-[0.98]"
        >
          Start a Popqiz
        </Link>

        {/* Secondary CTA */}
        <Link
          href="/join"
          className="block w-full bg-surface text-text-primary-dark text-lg font-medium py-4 px-6 rounded-2xl text-center border-2 border-text-secondary-dark/20 active:scale-[0.98]"
        >
          Join
        </Link>
      </div>
    </main>
  );
}

