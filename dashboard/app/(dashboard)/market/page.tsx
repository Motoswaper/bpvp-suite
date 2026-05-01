"use client";

import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { AmmDesk } from "@/components/market/AmmDesk";
import { LegacyOrderBook } from "@/components/market/LegacyOrderBook";
import { useLocale } from "@/lib/useLocale";

export default function Page() {
  const { isSpanish } = useLocale();

  return (
    <section className="space-y-4">
      <Navbar title="Market" />
      <ModuleGuide
        whatThisDoes="This module exposes AMM and orderbook market activity from the running engine state."
        whatToTry="Review liquidity, place small test swaps/orders, and confirm state updates without errors."
        walletHint='Wallet linking is optional for UI testing. If needed, link a wallet from "Profile" first.'
      />
      <Card title={isSpanish ? "Mesa AMM (Vista Institucional)" : "AMM Desk (Institutional Preview)"}>
        <AmmDesk />
      </Card>
      <LegacyOrderBook />
    </section>
  );
}
