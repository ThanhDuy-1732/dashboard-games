import { useEffect, useState } from "react";
import type { GameSession, SessionUpdate } from "@nha-choi/protocol";
export function useGameSession(session: GameSession | null) {
  const [update, setUpdate] = useState<SessionUpdate | null>(null);
  useEffect(() => {
    if (!session) {
      setUpdate(null);
      return;
    }
    const unsubscribe = session.subscribe(setUpdate);
    return () => {
      unsubscribe();
      void session.close();
    };
  }, [session]);
  return update;
}
