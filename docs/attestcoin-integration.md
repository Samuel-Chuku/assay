# Attestcoin integration

How Assay reads Ethereum from Creditcoin, what it refuses to believe, and what
running it in production taught us.

## The problem this solves

An agent's work history lives in the ERC-8004 registries on Ethereum. The lending
happens on Creditcoin. Moving facts between the two is normally an oracle
problem: someone observes chain A, reports to chain B, and the whole system
inherits that reporter's honesty.

Attestcoin removes the reporter. Attestors sign what they observe on Ethereum,
Creditcoin validators verify those signatures as part of consensus, and a
precompile at `0x0000000000000000000000000000000000000FD2` confirms on chain that
a given transaction was included in a valid Ethereum block. Assay never asks
anyone to take its word for a fact.

This document describes what we built on top of that.

## What Assay reads

Five events, from two contracts, both hardcoded.

**Identity Registry, `0x8004A818BFB912233c491871b3d84c89A494BD9e`**

| Event | Signature hash | Purpose |
| --- | --- | --- |
| `Registered(uint256,string,address)` | `0xca52e62c…c449bc4a` | an identity exists and who owns it |
| `Transfer(address,address,uint256)` | `0xddf252ad…f523b3ef` | the identity changed hands |
| `MetadataSet(uint256,string,string,bytes)` | `0x2c149ed5…db8a1468b` | the payment wallet changed |

**Reputation Registry, `0x8004B663056A597Dffe9eCcC1965A193B7388713`**

| Event | Signature hash | Purpose |
| --- | --- | --- |
| `NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)` | `0x6a4a6174…5e58febc` | a client rated the agent |

These signatures were not taken from a specification. We scanned forty thousand
blocks of real registry logs, resolved every `topic0` observed, pulled the
verified implementation source behind each ERC-1967 proxy, and confirmed each
hash with `cast keccak`. Every event seen on chain matched. The scan lives in
`scripts/scan-registry-events.ts` and can be re-run when the registries are
upgraded, which matters because both are UUPS proxies and their event set can
change.

One finding from reading the deployed source: **the payment wallet has no event
of its own.** `setAgentWallet` writes reserved metadata and emits `MetadataSet`
with `keccak256("agentWallet")` in `topics[2]`. That is the only on-chain path to
detecting a wallet change, and a transfer clears the wallet the same way, so the
two triggers are coupled at the source.

## The five checks

Every proof runs these in order inside `AssayOracle._processAndEmitEvent`, before
any business logic.

**1. The transaction type is valid.** `EvmV1Decoder.getTransactionType` followed
by `isValidTransactionType`.

**2. The transaction succeeded.** `receipt.receiptStatus == 1`.

The precompile proves *inclusion*, not success. A reverted transaction is still
validly included in a valid block. Without this check, a failed payment would
underwrite as revenue.

**3. The event is present.** `getLogsByEventSignature` returns at least one log
matching the signature we asked for.

**4. The emitter is one of the two registries.** This is the security model, and
it is worth stating precisely why.

Event signatures are public. Anyone can deploy a contract that emits a
byte-identical `NewFeedback` with invented values, and prove that transaction to
us. It really happened, it really succeeded, and the precompile will confirm all
of it. Nothing about the proof is false. What makes the fact worthless is *who
emitted it*.

So the oracle compares `log.address_` against two constants compiled into the
contract. A log from anywhere else is skipped, and a proof containing no log from
a trusted registry reverts. Trust comes from the emitter, never from the payload.

This is tested adversarially: a proof carrying an impostor's log alongside a
genuine one records only the genuine one.

**5. Only then, business logic.** Extract the fields and store them.

Replay is handled above this by `ASCBase`, which keeps `processedQueries` and
reverts before the handler runs. We do not add a second guard.

## What gets stored

`AgentRecord` holds the identity, the payment wallet, a feedback count, and two
counters: `ownerChanges` and `walletChanges`.

Those are **monotonic counters, not current-state comparisons**, and that
decision matters. Proofs can arrive in any order, because attestation covers
blocks at its own pace and an operator can prove an old event after a new one. A
"latest wins" model would let an old proof overwrite a newer fact and silently
un-freeze a credit line. A counter cannot go backwards. `CreditLine` snapshots
both counters when it offers a line, and any later difference means the world
moved after underwriting, whatever order the evidence arrived in.

## The freeze triggers

A credit line is bound to an ERC-8004 identity, and that identity is a
transferable NFT whose payment wallet can be swapped. Both are attacks:

- **Identity transferred.** An agent builds a record, borrows against it, then
  sells the token. The evidence that earned the credit no longer describes
  whoever holds the line.
- **Payment wallet changed.** Proven revenue can no longer be traced to the
  address being underwritten.
- **Evidence stale.** The newest proof is past its freshness bound. This is the
  fail-closed rule: absent evidence is not treated as good evidence.

A draw re-checks all three. It refuses without writing, because a revert would
roll back a freeze written in the same call, and `freezeIfTriggered` records the
freeze as a separate, permissionless call. `pendingFreezeReason` is a view, so
readers never see a line as healthy while a draw would already be refused.

This is not theoretical. Agent 10195 was underwritten on a genuine record, given
a line, and then had its identity sold on Sepolia. The watcher proved the
transfer, called `freezeIfTriggered`, and re-underwrote the agent to a refusal,
with no human involved:

```
agent 10195: ownerChanges=1  line=Frozen  reason=IdentityTransferred
```

## Recovering the link back to Ethereum

The oracle stores neither the source transaction hash nor the source block.
`ASCBase` does not pass them to the handler, and the decoded transaction does not
carry them. Rather than keep a side file that could drift, the site reconstructs
both from chain state:

```
submission calldata    ->  chainKey, blockHeight, merkleRoot, siblings
siblings + precompile  ->  transaction index within the source block
blockHeight + index    ->  the Sepolia transaction hash
```

`calculateTxIndex` on the block prover does the middle step. This means every
proven fact on the site carries a working link to both chains, derived from what
was actually proven, and the attestation delay it displays is measured from the
two block timestamps rather than asserted. Measured values in production have
ranged from `+9m06s` to `+12m39s`, consistent with the documented window.

## Failure modes found by running it

Unit tests did not find any of these. Each came from operating the system.

**The prover could not reach two of its four actions.** `AssayOracle` defines
four actions, but the proving script only exposed registration and feedback.
Transfer and wallet changes, the two that fire the freeze triggers, had no code
path. The triggers were unreachable in production while passing every test.

**One transaction can be proven exactly once.** `queryId` is derived from chain
key, block height and transaction index, and `ASCBase` rejects repeats. Selling
an identity emits `Transfer` and `MetadataSet` in a single transaction, so only
one of them can ever be recorded. We proved the wallet half first, which recorded
nothing because clearing a never-set wallet is not a change, and the ownership
transfer then became permanently unprovable. With that ordering, the line would
never have frozen.

The watcher now selects one action per transaction and ranks transfer above
wallet, because a transfer always implies a wallet clear while the reverse is not
true. The underlying limitation remains: a transaction emitting several
interesting events surrenders all but one. Recording all of them would require
the handler to process every matching event in a single pass, which is a contract
change.

**Attestation must be checked outside the proving call.** `prove` waits up to
twenty minutes for a height to be attested, which is correct for a one-shot
command and wrong inside a loop, where one unattested event stalls everything
queued behind it. The watcher checks coverage itself and defers.

**Proving a trigger does not record the freeze.** The oracle's counter moves, so
a draw reverts immediately, but the line's recorded state stays `Active` until
someone calls `freezeIfTriggered`. On a site claiming to show live state, that
gap reads as the freeze not working. The watcher makes the call.

## Operational notes

**Target the London EVM.** Creditcoin's EVM is London. Solidity 0.8.20 and later
default to Shanghai and emit `PUSH0`, which London does not support. The contract
deploys successfully and then reverts on every call with no useful error. We
verified this rather than assuming it: the same probe contract compiled to eleven
`PUSH0` opcodes under Shanghai and none under London.

**Buffer the gas.** Estimation on Creditcoin can run light. Every send applies a
1.35 multiplier. When estimation fails, the cause matters: a timeout says nothing
about whether the call would succeed, but a revert says it will fail, and sending
anyway burns gas on a guaranteed failure.

**Bound every log query.** Creditcoin's RPC abandons any `eth_getLogs` taking
longer than ten seconds. Scans are windowed rather than unbounded, and all four
event signatures are fetched in one filtered request rather than four concurrent
ones.

**Ask for the transaction, not the block.** Resolving a source hash by fetching
the Sepolia block and indexing into its transaction list took 23.7 seconds
against a free endpoint. `eth_getTransactionByBlockNumberAndIndex` returned the
same answer in 0.35 seconds.

**Attestation coverage is queryable.** `PrecompileChainInfoProvider` reports the
latest attested height for a chain key. That single value drives the watcher's
scheduling, the freshness bound, and the liveness indicator in the site's menu
bar.

## Depth of use

Assay uses Attestcoin for what it is for, and uses most of it:

- four distinct event types proven across two source contracts
- emitter binding against hardcoded addresses as the security model
- receipt status checked, so inclusion is never mistaken for success
- replay protection inherited from `ASCBase` rather than reimplemented
- attested height read from the chain-info precompile for scheduling, freshness
  and liveness
- transaction index recovered from the block prover to reconstruct source links
- fail-closed behaviour throughout: unavailable, stale or unprovable evidence
  freezes lending rather than falling back to unproven data

The parts of the protocol Assay does not use are the writability features, which
are still in third-party audit. That is why a default is recorded on Creditcoin
and never written back to Ethereum, and it is the single largest gap between this
system and a credit bureau that would actually deter defaults.
