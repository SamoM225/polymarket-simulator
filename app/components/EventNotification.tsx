"use client";

import { useEffect, useState } from "react";
import { OUTCOME_LABELS } from "../../lib/marketUtils";
import { Market, OutcomeId } from "../../lib/types";

interface EventNotificationProps {
  eventType: string;
  market: Market | null;
  outcomeId: OutcomeId;
  onDismiss: () => void;
}

/**
 * Notifikácia pre veľké eventy v simulácii (góly, fauly, atď.)
 */
export function EventNotification({
  eventType,
  market,
  outcomeId,
  onDismiss,
}: EventNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!market) return null;

  const teamName = outcomeId === "home" 
    ? market.homeTeam 
    : outcomeId === "away" 
    ? market.awayTeam 
    : "Remíza";

  return (
    <div
      className={`fixed top-20 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
    >
      <div className="animate-bounce rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-6 py-4 shadow-2xl">
        <div className="flex items-center gap-3 text-white">
          <span className="text-3xl">{eventType.split(" ")[0]}</span>
          <div>
            <p className="text-lg font-bold">{eventType}</p>
            <p className="text-sm opacity-90">
              {market.homeTeam} vs {market.awayTeam} • {teamName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
