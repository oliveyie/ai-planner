"use client";

import { useEffect, useState } from "react";

// Splits into reveal units of "one word plus any whitespace right after it"
// (rather than word/whitespace as separate units) so a newline or space
// appears together with the word before it — otherwise the gap between
// words would visually double up on its own delayed tick.
function splitIntoWordChunks(text: string): string[] {
  const tokens = text.split(/(\s+)/);
  const chunks: string[] = [];
  for (const token of tokens) {
    if (token === "") continue;
    if (/^\s+$/.test(token) && chunks.length > 0) {
      chunks[chunks.length - 1] += token;
    } else {
      chunks.push(token);
    }
  }
  return chunks;
}

// Reveals `text` progressively, one word at a time, for Mr. Whimble's chat
// replies. Pass a `key` that changes with the message (e.g. its id) so a new
// message remounts this fresh — a plain mount naturally starts at "" with no
// imperative reset needed (avoids the react-hooks/set-state-in-effect
// pitfall this app hit once before; see CalendarShell's git history).
export function TypewriterText({ text, speedMs = 90 }: { text: string; speedMs?: number }) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    const chunks = splitIntoWordChunks(text);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(chunks.slice(0, i).join(""));
      if (i >= chunks.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs]);

  return (
    <>
      {shown}
      {shown.length < text.length && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
    </>
  );
}
