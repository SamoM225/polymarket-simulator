"use client";

import { useState } from "react";

import { useMarketStore } from "../hooks/useMarketStore";
import { OutcomeId } from "../lib/types";
import {
  Navbar,
  MarketList,
  BettingPanel,
  Portfolio,
  AuthModal,
  Toast,
} from "./components";

export default function Home() {
  const store = useMarketStore();
  const [authOpen, setAuthOpen] = useState(false);

  const isAuthed = store.user.authenticated ?? false;

  const handleSelectMarket = (marketId: string) => {
    store.selectMarket(marketId);
  };

  const handlePlaceBet = (marketId: string, outcomeId: OutcomeId, amount: number) => {
    store.placeBet(marketId, outcomeId, amount);
  };

  const handleLogin = async (email: string) => {
    const error = await store.login(email);
    return error;
  };

  const handleLogout = () => {
    store.logout();
  };

  const handleToggleSimulation = () => {
    store.toggleSimulation(
      store.simulation.status === "running" ? "idle" : "running"
    );
  };

  const handleAddBalance = (amount: number) => {
    store.addBalance(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <Navbar
        userId={store.user.id}
        balance={store.user.balance}
        isAuthenticated={isAuthed}
        simulationStatus={store.simulation.status}
        onLoginClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onToggleSimulation={handleToggleSimulation}
        onAddBalance={handleAddBalance}
      />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1.4fr_1fr]">
          <MarketList
            markets={store.markets}
            selectedMarketId={store.selectedMarketId}
            onSelectMarket={handleSelectMarket}
          />

          <BettingPanel
            market={store.selectedMarket}
            maxBet={100}
            isAuthenticated={isAuthed}
            onPlaceBet={handlePlaceBet}
            onLoginRequired={() => setAuthOpen(true)}
          />

          <Portfolio
            markets={store.markets}
            positions={store.positions}
            simulationStatus={store.simulation.status}
            simulationIntervalMs={500}
            onClosePosition={store.closePosition}
            onToggleSimulation={handleToggleSimulation}
          />
        </div>
      </main>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={handleLogin}
      />

      {/* Toast Notifications */}
      {store.lastActionMessage && (
        <Toast
          message={store.lastActionMessage}
          onDismiss={store.clearMessage}
        />
      )}
    </div>
  );
}
