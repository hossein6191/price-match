"use client";

// The ledger, printed like a till's end-of-day report: what the contract holds (every shop's bond,
// every address's credit and every held claim fee, and nothing else), how much of the bonds open
// orders reserve, every atto that came in and went out, how the settled claims came out, the appeals,
// and price protection.

import { Aisle } from "@/components/bits";
import { ShelfButton } from "@/components/button";
import { NotDeployed, Placeholder, ReadError } from "@/components/read-state";
import { Receipt } from "@/components/receipt";
import { useAfterTx, useRead } from "@/components/use-read";
import { contractInUse, hasContract, isMock, readStats } from "@/lib/chain";
import { gen, short } from "@/lib/format";
import type { ReceiptLine } from "@/lib/receipt";
import type { Stats } from "@/lib/types";

const row = (label: string, value: string, strong?: boolean): ReceiptLine => ({ kind: "row", label, value, strong });

function zLines(s: Stats): { held: ReceiptLine[]; flows: ReceiptLine[]; claims: ReceiptLine[] } {
  return {
    held: [
      row("BONDS", gen(s.bondsAtto)),
      row("  RESERVED", gen(s.reservedAtto)),
      row("CREDITS", gen(s.creditsAtto)),
      row("FEES HELD", gen(s.stakesAtto)),
      { kind: "rule" },
      row("HELD", gen(s.heldAtto), true),
    ],
    flows: [
      row("BONDS FUNDED", gen(s.fundedAtto)),
      row("BONDS WITHDRAWN", gen(s.withdrawnAtto)),
      row("SALES TO SHOPS", gen(s.salesAtto)),
      row("REFUNDS FROM BONDS", gen(s.refundedAtto)),
      row("PRICE DROPS FROM BONDS", gen(s.droppedAtto)),
      row("FEES TO SHOPS", gen(s.feesToShopsAtto)),
      row("APPEAL BONDS LOST", gen(s.bondsForfeitedAtto)),
      row("CREDIT DEPOSITED", gen(s.depositedAtto)),
      row("CREDIT WITHDRAWN", gen(s.creditWithdrawnAtto)),
      row("REFUSED PAYMENTS", `${s.refusedPayments} · ${gen(s.returnedAtto)} BACK`),
    ],
    claims: [
      row("SHOPS", String(s.shops)),
      row("PRODUCTS", String(s.products)),
      row("ORDERS", String(s.orders)),
      row("  OPEN", String(s.openOrders)),
      row("  RELEASED", String(s.released)),
      { kind: "rule" },
      row("CLAIMS JUDGED", String(s.judged), true),
      row("  PENDING", String(s.pending)),
      row("  SETTLED", String(s.settled)),
      row("  PRICE MATCHED", String(s.matched)),
      row("  NOT IN STOCK", String(s.notInStock)),
      row("  NOT CHEAPER", String(s.notCheaper)),
      row("  DIFFERENT PRODUCT", String(s.different)),
      row("  UNCLEAR", String(s.unclear)),
      { kind: "rule" },
      row("APPEALS", String(s.appeals)),
      row("  OVERTURNED", String(s.overturned)),
      row("  UPHELD", String(s.upheld)),
      row("PRICE CHANGES", String(s.reprices)),
      row("DROPS PAID", String(s.drops)),
    ],
  };
}

export default function LedgerPage() {
  const stats = useRead(() => readStats(), [], { enabled: hasContract() });
  useAfterTx(() => void stats.refresh());
  if (!hasContract()) return <NotDeployed />;
  const s = stats.data;
  const z = s ? zLines(s) : null;
  const sumOk = s ? BigInt(s.bondsAtto) + BigInt(s.creditsAtto) + BigInt(s.stakesAtto) === BigInt(s.heldAtto) : true;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="kicker text-ink-3">Aisle 05</p>
        <h1 className="mt-1 text-[48px] sm:text-[60px]">The ledger</h1>
        <p className="mt-2 max-w-[68ch] text-ink-2">
          The contract&apos;s own totals from stats(), printed like a till&apos;s end-of-day report. It holds exactly every shop&apos;s bond, every address&apos;s credit and
          the fees of claims still pending, and no shop&apos;s reservations ever exceed its bond. Outcomes count settled claims by their final finding.
        </p>
      </div>
      {stats.error ? (
        <ReadError detail={stats.error} onRetry={stats.retry} />
      ) : !z || !s ? (
        <Placeholder lines={8} />
      ) : (
        <>
          <div className="grid justify-items-center gap-8 md:grid-cols-3 md:justify-items-stretch">
            <section aria-labelledby="held" className="w-full max-w-[330px]">
              <Aisle n="Z1" id="held" title="Held now" />
              <Receipt head={["PRICE MATCH", "Z REPORT · HELD", isMock ? "DEMO CONTRACT" : short(contractInUse())]} lines={z.held} foot={[sumOk ? "BONDS + CREDITS + FEES = HELD" : "TOTALS DO NOT ADD UP"]} />
            </section>
            <section aria-labelledby="flows" className="w-full max-w-[330px]">
              <Aisle n="Z2" id="flows" title="In and out" />
              <Receipt head={["PRICE MATCH", "Z REPORT · MONEY"]} lines={z.flows} foot={["EVERY ATTO, EVER"]} />
            </section>
            <section aria-labelledby="claims" className="w-full max-w-[330px]">
              <Aisle n="Z3" id="claims" title="Claims" />
              <Receipt head={["PRICE MATCH", "Z REPORT · CLAIMS"]} lines={z.claims} foot={["READ BY THE VALIDATORS"]} />
            </section>
          </div>
          <ShelfButton size="sm" onClick={() => void stats.refresh()} className="self-start">
            Print again
          </ShelfButton>
        </>
      )}
    </div>
  );
}
