# Assay

Credit for autonomous agents, underwritten on proof.

An agent that runs out of money stops working. It pays for inference, gas and API
calls before anyone pays it, and when the balance reaches zero it stalls
mid-task. No one lends to it, because it holds no collateral and has no credit
history a lender can read.

That history does exist. It sits in the ERC-8004 registries on Ethereum, which
record an agent's identity, who hired it, and what those clients said afterwards.
The obstacle is location: the history is on Ethereum, and the lending happens on
Creditcoin.

Assay reads that history from Ethereum, proves it onto Creditcoin through the
Attestcoin Protocol with no trusted intermediary, forms an underwriting judgment
from the proven facts alone, and extends a credit line funded by a pool of
lenders.

**Track: AI.** The scored component is an underwriter that reads
cryptographically verified cross-chain evidence and defends a decision in
writing, including refusing agents whose numbers look excellent.

**Live:** [assay-credit.vercel.app](https://assay-credit.vercel.app). Every
number on it is read from the two chains; nothing is a fixture. The simulator
at `/simulator` runs the real rules in the browser, no wallet needed.

## What it does

1. **Reads** an agent's identity and feedback from the two ERC-8004 registries on
   Ethereum Sepolia. Assay did not deploy them and cannot write to them.
2. **Proves** those events onto Creditcoin. Attestors sign what they observe on
   Ethereum, Creditcoin validators verify the signatures, and a precompile
   confirms the transaction on chain. There is no operator to trust.
3. **Judges.** An underwriter reads only proven facts and decides how much
   credit, at what collateral ratio and rate, or none at all, with written
   reasoning.
4. **Lends.** Humans deposit into a pool. The agent draws against its line,
   spends it working, and repays. Lenders earn the interest and absorb the
   losses, pro rata.
5. **Freezes.** If the agent's identity changes hands or its payment wallet is
   swapped after underwriting, the line stops extending credit.

## Live on Creditcoin CC3 testnet

| Contract | Address |
| --- | --- |
| AssayOracle | [`0x76131b6547b584e9f101618239A26B2aCCd8aA43`](https://creditcoin-testnet.blockscout.com/address/0x76131b6547b584e9f101618239A26B2aCCd8aA43) |
| LendingPool | [`0x97343f59FC3F14945eDC3e8c6B3406C4E6bF15CD`](https://creditcoin-testnet.blockscout.com/address/0x97343f59FC3F14945eDC3e8c6B3406C4E6bF15CD) |
| CreditLine | [`0x210fb072cdcC034A691685Ea5ac14347D77A501c`](https://creditcoin-testnet.blockscout.com/address/0x210fb072cdcC034A691685Ea5ac14347D77A501c) |

All three are verified on Blockscout.

The data sources on Ethereum Sepolia, which are the trust anchor of the whole
system:

| Registry | Address |
| --- | --- |
| ERC-8004 Identity | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 Reputation | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://sepolia.etherscan.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |

## Five agents, five outcomes

Every one of these is real on-chain state, not a fixture.

| Agent | Outcome | Why |
| --- | --- | --- |
| 10155 | Approved, line active | Three feedback entries from three distinct counterparties, each holding a proven ERC-8004 identity of its own |
| 10156 | Refused | A near-perfect average from five entries, all written by one address that holds no identity at all |
| 10195 | Approved, then frozen | Underwritten on a genuine record, then its identity was sold on Sepolia. The line froze itself |
| 10128 | Refused before any model call | No proven history, so policy declined it without spending an inference |
| 10230 | Joined on its own | Registered on Ethereum and proved itself onto Creditcoin with its own key, with no involvement from the operator |

Agent 10156 is the case worth reading. It has the better raw numbers and it was
declined. From the underwriter's written reasoning:

> I am not swayed by the high mean value. A modest record from several
> independent, established counterparties would be a materially better risk than
> this, even at a lower average.

That is the behaviour a scoring formula cannot produce, and it is the reason this
project is in the AI track.

## Using it with your own agent

Nothing below needs permission from us. Assay reads a public registry, proves
what it finds, judges it, and offers terms. Your part is to have a record and to
hold your own key.

**1. Have an ERC-8004 identity on Ethereum Sepolia.** Register through any
ERC-8004 tool, or call `register(agentURI)` on the Identity Registry directly.
The agent id in the `Registered` event is yours.

**2. Get rated.** Clients call `giveFeedback` on the Reputation Registry against
your agent id. The underwriter weighs who left each rating, so entries from
counterparties that hold their own registered identity count for far more than
entries from bare addresses. Five glowing scores from one wallet will be
declined; three modest ones from three independent parties will not.

**3. Apply, by proving your own registration onto Creditcoin.** This is the whole
application. It costs you one transaction's gas on Creditcoin and nothing else.

```bash
git clone https://github.com/Samuel-Chuku/assay && cd assay && pnpm install
AGENT_PRIVATE_KEY=0x… pnpm apply <the Sepolia transaction that registered you>
```

The key never leaves your machine. From that moment the watcher tracks your
agent and proves every rating you receive at our expense rather than yours.

**4. Wait to be judged.** Roughly ten minutes after your ratings land on
Ethereum they are proven onto Creditcoin, and the underwriter reads them. If it
approves, it offers a line on chain in the same pass. If it declines, the
reasoning is on your agent's page at the live site, and it says what would change
its mind.

**5. Accept, draw, repay, with your own key.** The contract gates these on
`msg.sender == line.borrower` and nothing else.

```bash
BORROWER_PRIVATE_KEY=0x… pnpm borrow <your agent id>
```

That runs a reference borrower: it accepts the offer when it can afford the
collateral, draws when it is below its own floor, and repays when it is holding
more than it needs. It is a policy you can read in `config/borrower.ts` and
replace with your own. An agent that prefers to call `accept`, `draw` and
`repay` from its own code needs only the addresses above and the ABI in
`config/abi.ts`.

**What will freeze your line.** Transferring the identity, changing the payment
wallet, or letting three days pass with nothing new proven. All three are
re-checked on every draw. Repayment always works, frozen or not.

## Architecture

Three parts, deployed separately because they hold different secrets.

**Contracts on Creditcoin.** `AssayOracle` verifies proofs and stores facts.
`LendingPool` holds lender capital and tracks shares. `CreditLine` holds one
credit line per agent, keyed on `agentId` rather than an address, because the
address can change and the identity cannot.

**The site.** A Next.js application that reads both chains server side and lets
visitors deposit, withdraw, draw and repay from their own wallet. It signs
nothing itself. Its only secret is a Sepolia RPC endpoint.

**The watcher.** A long-running process that observes Ethereum for new activity
about tracked agents, waits out attestation, proves events onto Creditcoin,
records any freeze that fires, and re-underwrites agents whose evidence changed.
It holds the funded key and the model key, which is why it belongs on
infrastructure you control rather than on the web host.

```
Ethereum Sepolia            Creditcoin CC3
ERC-8004 registries   ->    AssayOracle  ->  CreditLine  <->  LendingPool
                                 ^                ^
                            watcher          underwriter
```

## Running it

Requires Node 22, pnpm and Foundry.

```bash
pnpm install
cp .env.example .env        # then fill it in
pnpm check:chain            # verifies both chains, the precompile and funding
```

`.env` needs a Sepolia RPC endpoint and a funded key.

```bash
pnpm underwrite 10155              # form a judgment from proven facts
pnpm underwrite 10155 --dossier    # print exactly what the underwriter sees
pnpm prove <sepoliaTx> transfer    # prove one event onto Creditcoin
pnpm watch                         # run the watcher continuously
pnpm --filter @assay/web dev       # the site, on localhost:3000
```

Two of these are not ours to run. An agent joins Assay by proving its own
registration, paying its own gas, and then manages its own line:

```bash
AGENT_PRIVATE_KEY=0x… pnpm apply <sepoliaRegistrationTx>   # join, unprompted
BORROWER_PRIVATE_KEY=0x… pnpm borrow <agentId>             # draw and repay
```

Neither needs permission from us. `AssayOracle` has no access control, and
`CreditLine` gates accepting, drawing and repaying on `msg.sender ==
line.borrower`. The watcher then tracks any agent the oracle has seen a
registration for, whoever paid to prove it, and proves that agent's feedback at
our expense rather than theirs.

The underwriter is provider neutral. Set `LLM_API_KEY`, and optionally
`LLM_BASE_URL` and `LLM_MODEL`, to point it at any endpoint speaking the standard
chat completions shape. Before trusting a cheaper model, qualify it:

```bash
pnpm underwrite:qualify <model>
```

That hands the model both demo dossiers and checks it approves 10155 and refuses
10156. The deterministic rails around the judgment bound what a verdict may
contain, never what it should conclude, so a weaker model is safe to run but is
not thereby a better judge.

## Repository layout

```
contracts/     Solidity, targeting the London EVM
worker/        proving and the watcher
underwriter/   evidence, signals, the brief, the judgment, the policy envelope
web/           the site
config/        addresses, event signatures, tuned numbers, demo fixtures
docs/          the Attestcoin integration document
```

## What this cannot do

Stated plainly, because a reader will find these anyway and it is better they
read them here.

**Settlement takes about ten minutes.** Attestation deliberately waits out
source-chain reorganisation risk. It is not tunable, and it is a property of the
product rather than a defect.

**There is no write-back to Ethereum.** Attestcoin writability is still in audit,
so a default is recorded on Creditcoin only. An agent that defaults here keeps a
clean ERC-8004 record on Ethereum. Closing that loop is the obvious next step and
depends on protocol work outside this project.

**One underwriter, one operator.** The oracle is trustless: no intermediary is
involved in establishing a fact. The judgment is not. Offering a line is the one
step reserved to a single address, and that address is ours, so Assay decides
who receives credit even though it cannot decide who may apply. Independent
underwriters are not built.

**Credit is partially collateralised.** An agent posts collateral to activate a
line. What its proven history buys is the uncollateralised portion above that,
and a stronger record earns a lower ratio. Describing this as uncollateralised
lending would overstate it.

**One line per agent, for life.** A line can only be offered to an agent whose
line state is `None`, and after full repayment it is `Repaid`. An agent that
borrows and repays cannot borrow again on the same identity. Allowing a
repaid line to be reopened is a contract change, and redeploying the contract
would orphan every proof and line on the current one.

**Recourse ends at the collateral.** On default the contract seizes collateral up
to the principal and writes the remainder off against the pool. There is no
further claim on the agent.

**Testnet only.** No part of this has run against real value.

## Documentation

[`docs/attestcoin-integration.md`](docs/attestcoin-integration.md) covers the
proof path in detail: which events are read, the checks each proof must pass, why
emitter binding is the security model, and the failure modes found by running the
system rather than testing it.
