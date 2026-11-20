"use client";

// Credit held by the contract for claim fees and appeal bonds: what this address holds, what the next
// step stakes, one-click amounts to add, and Withdraw. Every step's waiting panel comes from lib/guide.ts.

import * as React from "react";

import { ShelfButton } from "@/components/button";
import { IconCoins } from "@/components/icons";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock } from "@/lib/chain";
import { gen } from "@/lib/format";
import { sendingGuide, signGuide } from "@/lib/guide";
import type { Chip } from "@/lib/suggestions";
import { rememberTx } from "@/lib/tx-memory";

export function CreditBox({
  thing,
  creditAtto,
  needAtto,
  needWhat,
  chips,
  withdraw = true,
}: {
  /** the id the transactions are remembered under, e.g. "O4" */
  thing: string;
  creditAtto: string;
  /** what the next step stakes */
  needAtto: bigint;
  /** "a claim", "an appeal" */
  needWhat: string;
  chips: Chip<bigint>[];
  withdraw?: boolean;
}) {
  const deposit = useTx();
  const out = useTx();
  const credit = BigInt(/^\d+$/.test(creditAtto) ? creditAtto : "0");
  const short = credit < needAtto;
  const [pick, setPick] = React.useState<bigint>(chips.find((c) => c.value >= needAtto - credit)?.value ?? chips[0].value);
  const busy = (t: typeof deposit) => t.sending || (!!t.hash && !t.final);
  const add = async () => {
    const h = await deposit.start(calls.deposit(pick));
    if (h) rememberTx(thing, h, `Added ${gen(pick)} of credit`);
  };
  const take = async () => {
    const h = await out.start(calls.withdraw());
    if (h) rememberTx(thing, h, `Withdrew ${gen(credit)} of credit`);
  };
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-ink-2">
        You hold <span className="mono font-bold text-ink">{gen(credit)}</span> of credit. {needWhat[0].toUpperCase() + needWhat.slice(1)} stakes{" "}
        <span className="mono font-bold text-ink">{gen(needAtto)}</span> of it.
        {short ? ` Add at least ${gen(needAtto - credit)} first.` : " That is enough."} Credit stays yours until a finding or an appeal sends it on, and Withdraw returns all of it.
      </p>
      {short && (
        <>
          <Suggest label="Credit to add" chips={chips} onPick={setPick} isOn={(v) => v === pick} />
          <WalletGate need={pick} what="to add credit">
            <ShelfButton variant="tag" icon={<IconCoins />} disabled={busy(deposit)} onClick={() => void add()} className="self-start">
              Add {gen(pick)} of credit
            </ShelfButton>
          </WalletGate>
        </>
      )}
      <TxStage
        tx={deposit}
        sign={signGuide({ fn: "deposit", label: `Adding ${gen(pick)} of credit`, amountAtto: pick.toString(), mock: isMock })}
        sending={sendingGuide({ fn: "deposit", target: thing, amountAtto: pick.toString(), mock: isMock })}
        label="Adding credit"
      />
      {withdraw && credit > 0n && (
        <>
          <WalletGate what="to withdraw">
            <ShelfButton size="sm" disabled={busy(out)} onClick={() => void take()} className="self-start">
              Withdraw all {gen(credit)}
            </ShelfButton>
          </WalletGate>
          <TxStage
            tx={out}
            sign={signGuide({ fn: "withdraw", label: `Withdrawing ${gen(credit)} of credit`, amountAtto: credit.toString(), mock: isMock })}
            sending={sendingGuide({ fn: "withdraw", target: thing, amountAtto: credit.toString(), mock: isMock })}
            label="Withdrawing credit"
          />
        </>
      )}
    </div>
  );
}
