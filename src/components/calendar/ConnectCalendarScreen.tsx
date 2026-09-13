"use client";

// An overlay modal (not a full-screen gate) — sits on top of the blank
// calendar preview and can be dismissed via "skip" without blocking the
// goal-entry section below it. Ported from Stitch's "Connect Your Calendar"
// screen (project 729063316895781965).
export function ConnectCalendarScreen({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 p-4 backdrop-blur-[5px]">
      <div className="flex w-full max-w-lg flex-col items-center rounded-[2rem] border border-[#f0e3d0] bg-white/95 p-6 text-center shadow-[0_20px_48px_-10px_rgba(120,90,70,0.14)] sm:p-8">
        <h2 className="mb-2 font-fraunces text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
          Your calendar is looking a little lonely!
        </h2>
        <p className="mb-6 max-w-md text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
          Connect it so we don&apos;t accidentally schedule a 5k run in the middle of your boss&apos;s keynote
          monologue.
        </p>

        <div className="mb-5 flex w-full max-w-sm flex-col gap-3">
          <a
            href="/api/auth/google/start"
            className="flex w-full items-center justify-center gap-3.5 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-xs transition-all duration-200 hover:bg-slate-50 hover:shadow"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                fill="#4285F4"
              />
              <path
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                fill="#34A853"
              />
              <path
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12c0 2.03.45 3.84 1.25 5.42l4.03-3.15z"
                fill="#FBBC05"
              />
              <path
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google Calendar
          </a>
          <a
            href="/api/auth/microsoft/start"
            className="flex w-full items-center justify-center gap-3.5 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-xs transition-all duration-200 hover:bg-slate-50 hover:shadow"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M14.5 2H3.5C2.67 2 2 2.67 2 3.5v17c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-17c0-.83-.67-1.5-1.5-1.5z"
                fill="#0078D4"
              />
              <path d="M15 6h7c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1h-7V6z" fill="#28A8EA" />
              <path d="M2.5 12h12v9.5c0 .28-.22.5-.5.5h-11a.5.5 0 01-.5-.5V12z" fill="#005A9E" />
              <path d="M14.5 2h-11a.5.5 0 00-.5.5V12h12V2.5a.5.5 0 00-.5-.5z" fill="#106EBE" />
              <circle cx="8.5" cy="12" r="3" fill="#ffffff" />
            </svg>
            Continue with Microsoft Outlook
          </a>
        </div>

        <p className="mb-3 text-[11px] font-medium tracking-wide text-slate-400">
          Read-only access during draft planning • Zero surprise invites sent to your boss • 100% private
        </p>

        <button
          onClick={onSkip}
          className="text-xs font-bold text-amber-700 underline decoration-amber-300 underline-offset-4 transition-colors hover:text-amber-800"
        >
          Or skip for now &amp; explore as guest →
        </button>
      </div>
    </div>
  );
}
