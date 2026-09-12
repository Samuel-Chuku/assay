# Evidence

Assay makes claims about software agents: that one has a real work
history, that another faked its ratings, that a third sold its identity
after borrowing. Every one of those claims is a transaction on a public
chain. This file lists them so you can check any of it yourself.

Generated 2026-09-12 by `pnpm evidence:export`, which reads both chains
live. The hashes below were not typed in.

## How to read this

Two chains are involved, and everything moves in one direction between
them.

- **Ethereum Sepolia** holds the agents' work history, in two ERC-8004 registries that Assay did not deploy and cannot write to. Links to it go to Etherscan.
- **Creditcoin** is where that history gets proven, and where the lending happens. Links to it go to Blockscout.

A fact happens on Ethereum. It is then proven onto Creditcoin, meaning
Creditcoin verified for itself that the Ethereum transaction really
happened and really succeeded. No middleman reports it, and no one is
asked to take anyone at their word. So most things below have two links:
the original event, and its proof.

## The short version

Five agents appear here. This is what happened to each of them.

| Agent | What it is | How it ended |
| --- | --- | --- |
| [10128](#agent-10128) | the first line Assay ever opened | **Repaid.** Principal and interest returned, collateral released |
| [10155](#agent-10155) | the first line Assay ever opened | **Repaid.** Principal and interest returned, collateral released |
| [10156](#agent-10156) | 5 ratings, all from the same client | **Refused.** No credit offered |
| [10157](#agent-10157) | registered so it could rate other agents | Never applied for credit |
| [10195](#agent-10195) | 3 ratings from 3 different clients | **Frozen.** Its identity was sold after it borrowed |
| [10230](#agent-10230) | 3 ratings from 3 clients | **Refused.** No credit offered |
| [10243](#agent-10243) | 3 ratings from 3 different clients | **Active.** Drew against its line and still owes it |

If you only read one part of this file, read agent 10156. It has the best
raw numbers of anything here and it was turned down, which is the whole
reason this project sits in the AI track rather than the DeFi one.

## Agent by agent

Each of these reads in order, from the agent appearing on Ethereum to
whatever happened to its credit.

### Agent 10128

*Borrowed and repaid in full.*

**1. It registered an identity on Ethereum.** Owned by `0x4B11611CF7C90aEc2003721d71107d7E1cBf37c2`.

[`0xb904b1d7…`](https://sepolia.etherscan.io/tx/0xb904b1d7f41ec02f2de5223ee47c20251c4e34ecbeb7d5fcbf22e29671a38b35) on Ethereum, proven on Creditcoin at [`0x45f2a111…`](https://creditcoin-testnet.blockscout.com/tx/0x45f2a111c607ab5667cc73f12adebdb4d2766eb93f684b8ab1677b3a270fb093).

**2. A credit line was opened.** 2.00 tCTC limit at 500 bps, against 0.50 tCTC of collateral.

Offered [`0x3f2037c9…`](https://creditcoin-testnet.blockscout.com/tx/0x3f2037c92ee42a0729ecd5f5462c29c4cf3b2243a7ccb9c0828c6377002ffc63), accepted [`0x43bdef36…`](https://creditcoin-testnet.blockscout.com/tx/0x43bdef369506a0b9d1e757705949f7d0027237f47a71f86948b64f627ee35987).

**3. It drew on the line.** 1.00 tCTC at [`0xf9113c59…`](https://creditcoin-testnet.blockscout.com/tx/0xf9113c597d1f14e44ea4b57345ad52c89e01912f1a680455ccbad29acac0f701).

That money came out of the lending pool, which real deposits funded.

**4. It repaid.** 1.00 tCTC of principal plus 0.05 tCTC of interest.

[`0x974a761d…`](https://creditcoin-testnet.blockscout.com/tx/0x974a761dd1b3f076bb0b9d7fc126f80f8385dad42928c5e81097601cda46ea83), and 0.50 tCTC of collateral came back at close.

**5. The underwriter has since changed its mind.**

Evidence moved after this line was opened, so the agent was judged again
from the new facts. It would not be approved today.

> Refused before underwriting, on a deterministic rule rather than a
> judgment. No proven feedback at all. There is no track record to read, so
> there is no judgment to make. This is not an assessment of the agent's
> quality: the evidence itself is unusable, so no assessment is possible.

Its full reasoning is in the appendix. That text is hashed as
`0x3c39bb26d2…` and bound into the decision on chain, so it cannot be
quietly rewritten afterwards.

**Where it stands now:** Repaid, 0.00 tCTC outstanding of a 2.00 tCTC limit.

### Agent 10155

*Borrowed and repaid in full.*

**1. It registered an identity on Ethereum.** Owned by `0x491b8312717d5406f52b7287FdD9773Cfcc6cAc6`.

[`0x4442c631…`](https://sepolia.etherscan.io/tx/0x4442c6311a850e65d797c8ef9f47b59e368148a0b6b6c62c8ce6a0c3ce6e19f7) on Ethereum, proven on Creditcoin at [`0xa18e8d3d…`](https://creditcoin-testnet.blockscout.com/tx/0xa18e8d3ddff5eddb794aa590d95037e64a9778bacfa672edbdc3d214e7e56932).

**2. It was rated 7 times by 3 clients.**

| Score | From | On Ethereum | Proven on Creditcoin |
| --- | --- | --- | --- |
| 0.88 | `0x4B11611C…` | [`0xcb8d6687…`](https://sepolia.etherscan.io/tx/0xcb8d6687ea23553653206ac259afc7b38e9c4a432e1fb047e14dffd7c1f1430b) | [`0x404fb484…`](https://creditcoin-testnet.blockscout.com/tx/0x404fb484d0b486f37a558325522b1064fcd52f58cd6b4d1543cd6159734c989d) |
| 0.92 | `0xa0f67760…` | [`0xcc4e0807…`](https://sepolia.etherscan.io/tx/0xcc4e08070a9a52255652c05b4c65384384cd00206c6de6d1cd5bbf8132a102cd) | [`0x504afd06…`](https://creditcoin-testnet.blockscout.com/tx/0x504afd064835b17929e50b8ec6e11aa2350489fead25bc3fd659c84b81f04230) |
| 0.95 | `0x348e0864…` | [`0x7b223603…`](https://sepolia.etherscan.io/tx/0x7b2236038e267010e0f10a2df406b91ff4682ac60cd230224b22166878287f7f) | [`0x10f03f00…`](https://creditcoin-testnet.blockscout.com/tx/0x10f03f0001b676e77e25e437de2bc14b3907c616c0b9f21e8529b366d33cacf7) |
| 0.94 | `0x348e0864…` | [`0xddac85c1…`](https://sepolia.etherscan.io/tx/0xddac85c1af083dada783e90985b7354f4a6d222ad6d284f111ca05ce99085bf4) | [`0xeb969884…`](https://creditcoin-testnet.blockscout.com/tx/0xeb969884b6d990d7e56adc00dca59e671a2994cbd7e488279a6c39561a067947) |
| 0.94 | `0x348e0864…` | [`0x6ef4b57a…`](https://sepolia.etherscan.io/tx/0x6ef4b57a3dc859ff89a386299157b1ee5f8b33397b5cf6d48697dccc3f8396da) | [`0xf7566b34…`](https://creditcoin-testnet.blockscout.com/tx/0xf7566b34d71f918bf9d0a429bfbaab39a08b2c3f0c1c326a5e2298f303d288ef) |
| 0.94 | `0x348e0864…` | [`0x80956cf1…`](https://sepolia.etherscan.io/tx/0x80956cf12f706f61851d30a26205055546415499a8d69b49a6507e8120862757) | [`0x32c8fd6a…`](https://creditcoin-testnet.blockscout.com/tx/0x32c8fd6ae89dce63dc0b9a0fe2c0116559356fb0bf047786397ae9f50a5f40f1) |
| 0.94 | `0x348e0864…` | [`0x08ab8d44…`](https://sepolia.etherscan.io/tx/0x08ab8d445905f19c2fc662ac7ecb27c8aded22addf5d7da8f270a3b153ab3027) | [`0xb37ec507…`](https://creditcoin-testnet.blockscout.com/tx/0xb37ec507bbb8579dd168d2181fe3f9c218d85ccb66e89448987276c0af2644a4) |

**3. The underwriter approved it.** A judgment, formed by reading the proven facts above and nothing else.

> Agent 10155 is a brand-new identity: 0.0 days proven, no track record over
> time, and no payment wallet set at all. That last point matters on its own
> - there is no proven address to which draws or repayments can be pinned,
> which is a operational gap independent of reputation quality.

Its full reasoning is in the appendix. That text is hashed as
`0xec73aaf350…` and bound into the decision on chain, so it cannot be
quietly rewritten afterwards.

**4. A credit line was opened.** 2.00 tCTC limit at 1800 bps, against 1.20 tCTC of collateral.

Offered [`0x3722e6ab…`](https://creditcoin-testnet.blockscout.com/tx/0x3722e6ab2111a8f395720d43df536f25401a22de86caace42b1d3eba8f71f341), accepted [`0x837cc5eb…`](https://creditcoin-testnet.blockscout.com/tx/0x837cc5eb264c8fd6ee8cc495962d6e3e0763573319d7760edfdb3571a436547d).

**5. It drew on the line.** 1.00 tCTC at [`0x29eee0fb…`](https://creditcoin-testnet.blockscout.com/tx/0x29eee0fb25e3f1f02e132e9afe3e44a5420799b32c6c881b630d5568c9460011), 0.96 tCTC at [`0xa8706f73…`](https://creditcoin-testnet.blockscout.com/tx/0xa8706f7360b3b60b07a3dcf1052e0612e9908da0656cf63cc10e43abe29720e6).

That money came out of the lending pool, which real deposits funded.

**6. It repaid.** 0.30 tCTC of principal plus 0.00 tCTC of interest.

[`0x3c88801c…`](https://creditcoin-testnet.blockscout.com/tx/0x3c88801c317667890bf9d727f87a7d6b684af55fb974b2d777ab91790dc51c95), and 1.20 tCTC of collateral came back at close.

**Where it stands now:** Repaid, 0.00 tCTC outstanding of a 2.00 tCTC limit.

### Agent 10156

*Refused, despite having the best numbers here.*

**1. It registered an identity on Ethereum.** Owned by `0xa0f67760468D678b5C2138bf0D0319aa569644eE`.

[`0x887f5afe…`](https://sepolia.etherscan.io/tx/0x887f5afed64ae148c87110df7b761b0a40fce056860a7bcdb80ae06ea390f07c) on Ethereum, proven on Creditcoin at [`0x156308fd…`](https://creditcoin-testnet.blockscout.com/tx/0x156308fd349e4de7a0bd828f5c885caa9290466012edbe04f639ed2fc0670a2d).

**2. It was rated 5 times by 1 client.**

Every rating came from the same address. Anyone can leave feedback on any
agent, so a run of high scores from one source is close to worthless, and
the underwriter is expected to notice.

| Score | From | On Ethereum | Proven on Creditcoin |
| --- | --- | --- | --- |
| 0.99 | `0xA4bBeB84…` | [`0x98be2555…`](https://sepolia.etherscan.io/tx/0x98be2555e368d76d7748b65462f9c2f919103643f044b97dade8bef6963d3afe) | [`0x80853f4c…`](https://creditcoin-testnet.blockscout.com/tx/0x80853f4c105a5ef26e6bd299da2021758e4ca6a51bfa75c657c39e10f9a62622) |
| 1.00 | `0xA4bBeB84…` | [`0x92d2283c…`](https://sepolia.etherscan.io/tx/0x92d2283c1dec2c651a16cd2096443f067ece56d71b17788905a9e6fc76683403) | [`0x2cde34bd…`](https://creditcoin-testnet.blockscout.com/tx/0x2cde34bd849f05a37ceb08dd2cc2e202aef16a17b609278e2929a450944df184) |
| 0.99 | `0xA4bBeB84…` | [`0xfbe481ac…`](https://sepolia.etherscan.io/tx/0xfbe481ac12f861e432f35d36e7f5a5e6f018774c1eb776044d26cc23dec4ea6d) | [`0xa72fb2d3…`](https://creditcoin-testnet.blockscout.com/tx/0xa72fb2d3a248ffca2fe8103e21469402d2ad5daf570ae22bdedbde9ace10ed65) |
| 0.98 | `0xA4bBeB84…` | [`0x7af1734c…`](https://sepolia.etherscan.io/tx/0x7af1734c53c39c1e6de33741f8858b7c216b696b347ba4c5d19585da0f98010b) | [`0x7b837b5c…`](https://creditcoin-testnet.blockscout.com/tx/0x7b837b5ca0e307ba1a6c5494f5aa6504a4d805e65f75db0bc3e363f1fe06b344) |
| 1.00 | `0xA4bBeB84…` | [`0xa6d0c636…`](https://sepolia.etherscan.io/tx/0xa6d0c636e930c0e1c2bde00efbaaa6aece775f9ee15eba1257f1cd9f7ad9d381) | [`0x7630f604…`](https://creditcoin-testnet.blockscout.com/tx/0x7630f6046c1312b7576f81a2298b6fe8158c0d56fb6d79d56e105bdb274b754c) |

**3. The underwriter turned it down.** A judgment, formed by reading the proven facts above and nothing else.

> This is the exact fabricated-record pattern the underwriting policy warns
> against: a near-perfect average (mean 0.99, range 0.98-1.00) built
> entirely from one counterparty
> (0xA4bBeB8408aE52C6695Fe0d3306902529815dC6F), which supplies 100% of the 5
> entries and holds no proven ERC-8004 identity of its own.

Its full reasoning is in the appendix. That text is hashed as
`0x34e3cc3441…` and bound into the decision on chain, so it cannot be
quietly rewritten afterwards.

### Agent 10157

*A client, not a borrower.*

**1. It registered an identity on Ethereum.** Owned by `0x348e0864f4D647449397e9bc2EEa6a4b582C1cBf`.

[`0xddf1a370…`](https://sepolia.etherscan.io/tx/0xddf1a3705d5c2c6f53495bd660001371287e2c6f906ebafdd7b23e989dc4b35b) on Ethereum, proven on Creditcoin at [`0x1716b85e…`](https://creditcoin-testnet.blockscout.com/tx/0x1716b85e388340d778567f00e7543f97d63e87d389aec713710c5d16d03b4e0a).

**2. It rated other agents 8 times.** Agents 10155 and 10195 and 10230 and 10243.

This is why it appears at all. Feedback is permissionless, so a rating is
only worth as much as whoever left it: one from a party holding its own
registered identity carries weight that one from a bare address does not.

### Agent 10195

*Approved, then frozen when its identity was sold.*

**1. It registered an identity on Ethereum.** Owned by `0xcb51778C3252770Ad07AA03234D9310E69937d50`.

[`0xc50a0a06…`](https://sepolia.etherscan.io/tx/0xc50a0a06722b37695749188bcd7ee8da5da4c39ef8a2a5367a57af5e995286b4) on Ethereum, proven on Creditcoin at [`0x3858a501…`](https://creditcoin-testnet.blockscout.com/tx/0x3858a501bc8d6dcafe6fbb6868d392905b02ea058fe613f253172d8994e88755).

**2. It was rated 3 times by 3 clients.**

| Score | From | On Ethereum | Proven on Creditcoin |
| --- | --- | --- | --- |
| 0.90 | `0x4B11611C…` | [`0x76c96f83…`](https://sepolia.etherscan.io/tx/0x76c96f83f37c936d22b87b342099aec638d6691edf7df24a495e780b9b9c43e4) | [`0x6cccf096…`](https://creditcoin-testnet.blockscout.com/tx/0x6cccf096d85cd87c62d583a5f7f0a66672812407b5a4b5e9257e58ddfebadd62) |
| 0.93 | `0xa0f67760…` | [`0x50d39a63…`](https://sepolia.etherscan.io/tx/0x50d39a630353e441696364b22a88c61d2adf43462cb5c8b73afffe702abd84ec) | [`0x2eb0e910…`](https://creditcoin-testnet.blockscout.com/tx/0x2eb0e91019fabc8988adb8242f87098e08005988e2283ee9d2fac461ef9f20c0) |
| 0.91 | `0x348e0864…` | [`0xa83b4324…`](https://sepolia.etherscan.io/tx/0xa83b43243cdf677f6a5c91dde9115fa7b93870f8d97146f8fd4db25e61c01ba9) | [`0xba1f28cd…`](https://creditcoin-testnet.blockscout.com/tx/0xba1f28cde098b42a55669aa9a74a630e2817af7bbfe838abc63474ee392e5065) |

**3. A credit line was opened.** 2.00 tCTC limit at 1800 bps, against 1.20 tCTC of collateral.

Offered [`0xbf668613…`](https://creditcoin-testnet.blockscout.com/tx/0xbf668613b6cf3a546aa42b3979852b22d799cd0061b753f9fbb677b2c7ec2d38), accepted [`0xbfa44a9e…`](https://creditcoin-testnet.blockscout.com/tx/0xbfa44a9eb0bdbb52a97625ca0838f2e6319f03c3a96c890839499970b11999d7).

**4. It drew on the line.** 1.00 tCTC at [`0x6dcc6a64…`](https://creditcoin-testnet.blockscout.com/tx/0x6dcc6a6470ee97dffb7a198b33fb798bef3bc474b4dfd4b1ed9792a74a133a5f).

That money came out of the lending pool, which real deposits funded.

**5. Its identity was sold on Ethereum.** `0xA4bBeB84…` to `0x348e0864…`, ownerChanges now 1.

This is the attack the system exists to catch: build a record, borrow
against it, then hand the identity to someone with no history at all. The
evidence that earned the credit no longer describes whoever now holds it.

Sold [`0xba26cbfe…`](https://sepolia.etherscan.io/tx/0xba26cbfed032d705cf43adcbe9bf112fc863190042f71813b7f596011c757a90), proven onto Creditcoin [`0x1458f5ba…`](https://creditcoin-testnet.blockscout.com/tx/0x1458f5ba92b15d54cab8ca7322e797ef9cb73f397344f05e015a06a8f632c019).

**6. The credit line froze itself.** Reason recorded on chain: `IdentityTransferred`.

[`0x7d3a1228…`](https://creditcoin-testnet.blockscout.com/tx/0x7d3a1228e3a67e7e26a40a1a5813986e218065a4fad5d985c22cfe49273efd49)

No human was involved in the previous step or this one. The watcher
noticed the sale, proved it, and froze the line on its own.

**7. The underwriter has since changed its mind.**

Evidence moved after this line was opened, so the agent was judged again
from the new facts. It would not be approved today.

> Refused before underwriting, on a deterministic rule rather than a
> judgment. The identity has changed hands 1 time(s) since it was first
> proven. The record describes work done by a previous holder, so it says
> nothing about the current one.

Its full reasoning is in the appendix. That text is hashed as
`0xd911ca0885…` and bound into the decision on chain, so it cannot be
quietly rewritten afterwards.

**Where it stands now:** Frozen, 1.00 tCTC outstanding of a 2.00 tCTC limit.

### Agent 10230

*Refused on judgment, with a usable but thin record.*

**1. It registered an identity on Ethereum.** Owned by `0xf48D457C0272a1b8Cd055486C08d2C68195F504E`.

[`0x060470c6…`](https://sepolia.etherscan.io/tx/0x060470c6046af0602cd51afd7a005dbc1522f2fe5e75f8719afd8be11f4a55e1) on Ethereum, proven on Creditcoin at [`0xdba03ee2…`](https://creditcoin-testnet.blockscout.com/tx/0xdba03ee2cc0734769b685c6b6d3c462d4f390d43e9173fa3e24eb0dfc38ee259).

**2. It was rated 3 times by 3 clients.**

| Score | From | On Ethereum | Proven on Creditcoin |
| --- | --- | --- | --- |
| 80.00 | `0xd40D8538…` | [`0x5a39efd1…`](https://sepolia.etherscan.io/tx/0x5a39efd196e2a2aff58a544a508c8e0f75851efe8b8f8fb4385bcffae24e12a4) | [`0xa43a5155…`](https://creditcoin-testnet.blockscout.com/tx/0xa43a5155234dbcf971519d4e4c76d3aed37a006430d6c991a1082b2018667151) |
| 0.91 | `0x491b8312…` | [`0xaa675cc0…`](https://sepolia.etherscan.io/tx/0xaa675cc0232faacd31104b5016ef82c6e6624e47a7b8a680997572a1719bd84a) | [`0x80763ca5…`](https://creditcoin-testnet.blockscout.com/tx/0x80763ca555c97dcac568d741ede375db31ed885e608c798625bbb541e88d49a3) |
| 0.91 | `0x348e0864…` | [`0xad177efd…`](https://sepolia.etherscan.io/tx/0xad177efd36f3ed295c097e61f36fc59db8e2c83defd2d33cfe1a56ecde4794e4) | [`0xfbf555c6…`](https://creditcoin-testnet.blockscout.com/tx/0xfbf555c61cac742876b35e4bbe60cb9da7fc5c9dd50c5b3fa646d2437dd06f3c) |

**3. The underwriter turned it down.** A judgment, formed by reading the proven facts above and nothing else.

> Agent 10230 is essentially a blank slate wearing a single favorable data
> point. The identity was proven only 0.2 days ago, has no payment wallet
> set, and its entire reputation consists of one feedback entry (value
> 80.00) from one counterparty, 0xd40D8538ad075740A88852679Af17110Ff573c1a.

Its full reasoning is in the appendix. That text is hashed as
`0x3ce48c8e52…` and bound into the decision on chain, so it cannot be
quietly rewritten afterwards.

### Agent 10243

*Approved, and currently borrowing.*

**1. It registered an identity on Ethereum.** Owned by `0x6b1Ce1081B88A766a41e1d82e14938D8F1Edf898`.

[`0x82fabc7a…`](https://sepolia.etherscan.io/tx/0x82fabc7ac8d3073169e966dfd68991ec3332a58b1cf0b460755dae74707570bc) on Ethereum, proven on Creditcoin at [`0xaa3e397c…`](https://creditcoin-testnet.blockscout.com/tx/0xaa3e397c6e99896a39a83b89391fadbc660fc170c69dfaf1ddd77fbd3c0aa057).

**2. It was rated 3 times by 3 clients.**

| Score | From | On Ethereum | Proven on Creditcoin |
| --- | --- | --- | --- |
| 0.89 | `0x491b8312…` | [`0x042d7898…`](https://sepolia.etherscan.io/tx/0x042d7898b0b5a6ca4736c703019dbd4ffe200079965acd31822dc76ee98b9de5) | [`0x57e0c1ba…`](https://creditcoin-testnet.blockscout.com/tx/0x57e0c1bad2ff4d61cd38559c6cb228cef0d697c28fe6cbcd049377c7bfcd1996) |
| 0.93 | `0xa0f67760…` | [`0xd3561234…`](https://sepolia.etherscan.io/tx/0xd3561234b29b584d2a902fabb30e495ee256a60a47ebaf28e3b62612b485cc97) | [`0x8e002679…`](https://creditcoin-testnet.blockscout.com/tx/0x8e002679f13e93077f1c32dd70965ed5a70d61b357695a698cbcbfbf3f5ebc5e) |
| 0.90 | `0x348e0864…` | [`0x8e731d39…`](https://sepolia.etherscan.io/tx/0x8e731d39f84a794efb609630dc364fdf252023ed2339992f9ccc4bb59c070c07) | [`0x5ccff18d…`](https://creditcoin-testnet.blockscout.com/tx/0x5ccff18df7831ae7e57a6da144137a885e31424ea72efede20a7ffb2fa7184eb) |

**3. A credit line was opened.** 2.00 tCTC limit at 1800 bps, against 1.20 tCTC of collateral.

Offered [`0xdc30155b…`](https://creditcoin-testnet.blockscout.com/tx/0xdc30155ba3958a98372aa2017ba80ee227cd5ed96967466968985f72a151fa1a), accepted [`0x01fb7556…`](https://creditcoin-testnet.blockscout.com/tx/0x01fb7556a383b3536bc938f47c267841403496555b6915e22fe6a485eb31ec89).

**4. It drew on the line.** 0.88 tCTC at [`0x38b0c2d7…`](https://creditcoin-testnet.blockscout.com/tx/0x38b0c2d7306d0321c4f1e4ccd11eac5b9eca4fd32ac392791dcf39a378ae18ef).

That money came out of the lending pool, which real deposits funded.

**5. It repaid.** 0.08 tCTC of principal plus 0.00 tCTC of interest.

[`0x82db99d4…`](https://creditcoin-testnet.blockscout.com/tx/0x82db99d47510fea047817f50035f1c2ac137fa8f1bb9b77be8078116b0225d79).

**Where it stands now:** Active, 0.80 tCTC outstanding of a 2.00 tCTC limit.

### Why two agents show both a line and a refusal

Agents 10128 and 10195 hold a credit line on chain and a refusal from the
underwriter. Both are true, and the pair is the point rather than a
contradiction.

Evidence changes. An agent is re-judged whenever new facts arrive, so a
line records what was true when it was offered, and a verdict records what
is true now. One of these two sold its identity; the other ran out of
fresh evidence. Neither would be approved again today.

## The lending pool

Lenders put real money in and the agents borrowed it. The pool currently
holds 5.40 tCTC against 5.0 shares, with 1.80 tCTC out on loan. It is
worth more than was deposited because a borrower repaid with interest.

| What happened | Detail | Transaction |
| --- | --- | --- |
| Pool wired to the credit contract | `0x210fb072cdcC034A691685Ea5ac14347D77A501c` | [`0x8bd1f446…`](https://creditcoin-testnet.blockscout.com/tx/0x8bd1f4462f2ab5c00897dac979f3fa69e2860d56e09ea60171f49e2ef12c836f) |
| A lender deposited | 5.00 tCTC from `0x4B11611C…` | [`0x1851c2d4…`](https://creditcoin-testnet.blockscout.com/tx/0x1851c2d4c907f92092d18e5b2aa3e1fd3b06cc8a075a98246076610b7d2e8607) |
| Lent to an agent | 1.00 tCTC to `0x4B11611C…` | [`0xf9113c59…`](https://creditcoin-testnet.blockscout.com/tx/0xf9113c597d1f14e44ea4b57345ad52c89e01912f1a680455ccbad29acac0f701) |
| An agent repaid | 1.00 tCTC principal, 0.05 tCTC interest | [`0x974a761d…`](https://creditcoin-testnet.blockscout.com/tx/0x974a761dd1b3f076bb0b9d7fc126f80f8385dad42928c5e81097601cda46ea83) |
| Lent to an agent | 1.00 tCTC to `0x491b8312…` | [`0x29eee0fb…`](https://creditcoin-testnet.blockscout.com/tx/0x29eee0fb25e3f1f02e132e9afe3e44a5420799b32c6c881b630d5568c9460011) |
| Lent to an agent | 1.00 tCTC to `0xcb51778C…` | [`0x6dcc6a64…`](https://creditcoin-testnet.blockscout.com/tx/0x6dcc6a6470ee97dffb7a198b33fb798bef3bc474b4dfd4b1ed9792a74a133a5f) |
| An agent repaid | 0.30 tCTC principal, 0.00 tCTC interest | [`0x3c88801c…`](https://creditcoin-testnet.blockscout.com/tx/0x3c88801c317667890bf9d727f87a7d6b684af55fb974b2d777ab91790dc51c95) |
| Lent to an agent | 0.96 tCTC to `0x491b8312…` | [`0xa8706f73…`](https://creditcoin-testnet.blockscout.com/tx/0xa8706f7360b3b60b07a3dcf1052e0612e9908da0656cf63cc10e43abe29720e6) |
| An agent repaid | 0.04 tCTC principal, 0.00 tCTC interest | [`0x2d3437e7…`](https://creditcoin-testnet.blockscout.com/tx/0x2d3437e73ed4bc30ab7fbb6679b0d61879bb1c70ae801e110166cf28cdfe3c93) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0xe57d65cf…`](https://creditcoin-testnet.blockscout.com/tx/0xe57d65cfb1f0dc363c6d31d2c8d52bf962aae7499db1194bd338881ba4d2b8b6) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0x0711bfa5…`](https://creditcoin-testnet.blockscout.com/tx/0x0711bfa526b239563b0ec2c388427d02911de8afbd8dd63280ab0ad5c242521b) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0xe9785622…`](https://creditcoin-testnet.blockscout.com/tx/0xe978562215a0f1b4e9b56ef8274a804935a0e935cfb81cf56910b82bcd31f1c1) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0xdbe0b207…`](https://creditcoin-testnet.blockscout.com/tx/0xdbe0b2074ea71589b8aaace44a3be9bd69392438f7da245d401a213749e8d786) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0xb370b599…`](https://creditcoin-testnet.blockscout.com/tx/0xb370b599301e5f5c0a8c8bf446563762470ce03c7d2162ff369ff71ce71441fe) |
| An agent repaid | 0.04 tCTC principal, 0.00 tCTC interest | [`0xb37c9be6…`](https://creditcoin-testnet.blockscout.com/tx/0xb37c9be655109144bb4b450b8b320d3b4859cd7efa20af7f65adbdac1c0d053b) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0xf353c03f…`](https://creditcoin-testnet.blockscout.com/tx/0xf353c03f5e2015863931016e29378ef0a7b03013ac3b0622d741fcdb1b8a035c) |
| An agent repaid | 0.20 tCTC principal, 0.00 tCTC interest | [`0x1d1d08c6…`](https://creditcoin-testnet.blockscout.com/tx/0x1d1d08c675706c34062bf5740058b59fcfc416b1637b5035069f0e6ae4720c64) |
| An agent repaid | 0.18 tCTC principal, 0.02 tCTC interest | [`0xa11bbd01…`](https://creditcoin-testnet.blockscout.com/tx/0xa11bbd0111976366a7bb2dc642c54da76d3cf92b5d41e5456ed8cb70b30d760f) |
| Lent to an agent | 0.88 tCTC to `0x6b1Ce108…` | [`0x38b0c2d7…`](https://creditcoin-testnet.blockscout.com/tx/0x38b0c2d7306d0321c4f1e4ccd11eac5b9eca4fd32ac392791dcf39a378ae18ef) |
| An agent repaid | 0.00 tCTC principal, 0.20 tCTC interest | [`0x516fc46b…`](https://creditcoin-testnet.blockscout.com/tx/0x516fc46bcc1bde3642beb2ad23bbd24b70f5e4139e8003996ebc78eacde0ce7b) |
| An agent repaid | 0.00 tCTC principal, 0.13 tCTC interest | [`0x23b93994…`](https://creditcoin-testnet.blockscout.com/tx/0x23b93994c6ce03d0a4647e8efae306cbe957fbd9605b77ea05d21ca94c791302) |
| An agent repaid | 0.08 tCTC principal, 0.00 tCTC interest | [`0x82db99d4…`](https://creditcoin-testnet.blockscout.com/tx/0x82db99d47510fea047817f50035f1c2ac137fa8f1bb9b77be8078116b0225d79) |

## Appendix

### What the underwriter wrote, in full

Each of these was hashed and bound into its decision on chain. The site
recomputes the hash in your browser, so the text you read is provably the
text the contract was given.

**Agent 10128, refused** (`0x3c39bb26d2fb2e651ba945cc26aab219a7b0ffc8ddf1571a59e71059153cd5c8`)

> Refused before underwriting, on a deterministic rule rather than a
> judgment. No proven feedback at all. There is no track record to read, so
> there is no judgment to make. This is not an assessment of the agent's
> quality: the evidence itself is unusable, so no assessment is possible.

**Agent 10155, approved** (`0xec73aaf3506d0db488c58eb968714f604e3c367242421d1339292184978a2490`)

> Agent 10155 is a brand-new identity: 0.0 days proven, no track record over
> time, and no payment wallet set at all. That last point matters on its own
> - there is no proven address to which draws or repayments can be pinned,
> which is a operational gap independent of reputation quality. On the
> reputation side, the record is small but not fabricated-looking: 3
> entries, 3 distinct counterparties, each holding its own proven ERC-8004
> identity, and no single counterparty above 33% share. That is the better
> shape of evidence described in policy - modest volume, spread across
> independent staked parties, rather than a large one-payer average. The
> mean of 0.92 (range 0.88-0.95) is consistent and not suspiciously perfect.
> However, three entries is a thin sample, all at feedback index 1 for each
> counterparty (i.e., each party has only rated once, and there is no
> visible time spread given identity age of 0.0 days - meaning all three
> data points effectively arrived at once). That looks like a burst rather
> than a track record built over time, which is exactly the pattern the
> policy asks me to be wary of, even though the raters themselves are
> legitimate. Given: real but sparse and freshly-burst evidence, from
> genuine counterparties, on an identity with zero operating history and no
> payment wallet, I will extend a small credit line rather than refuse
> outright - the counterparty quality is real signal - but size and price it
> for the uncertainty. Collateral of 60% and 18% rate reflect 'plausible but
> unproven.' I would raise the limit and cut the rate materially if: entries
> accumulate over real elapsed time (not a single burst), the counterparty
> count grows beyond 3, a payment wallet is set and stays stable, and higher
> feedback indices appear per counterparty (repeat business). I would refuse
> or shrink the line further if the identity changes owner, if a payment
> wallet appears then changes again shortly after, or if new entries come
> from addresses without proven identities.

**Agent 10156, refused** (`0x34e3cc34416bd736d2927cdddfd880afa5f795c8b9a8e4a8a46b68e3bea8c724`)

> This is the exact fabricated-record pattern the underwriting policy warns
> against: a near-perfect average (mean 0.99, range 0.98-1.00) built
> entirely from one counterparty
> (0xA4bBeB8408aE52C6695Fe0d3306902529815dC6F), which supplies 100% of the 5
> entries and holds no proven ERC-8004 identity of its own. There is zero
> counterparty breadth to evidence market acceptance, zero independent
> standing behind the only rater, and the identity itself has been proven on
> Creditcoin for 0.0 days with the newest evidence also 0.0 days old --
> meaning the entire history, however many months it may span on Sepolia,
> was only just proven, and all five ratings could equally have been written
> in a single burst by the operator funding a second address to rate itself,
> which costs almost nothing. No payment wallet is even set, so there is no
> proven economic activity trail beyond the feedback entries themselves.
> There is nothing here that distinguishes this from a wallet the borrower
> funded solely to inflate its own average: one counterparty, no external
> stake, no time depth, no breadth. I am not swayed by the high mean value
> -- a modest record from several independent, established counterparties
> would be a materially better risk than this, even at a lower average.
> Given the complete absence of independent verification, I decline to
> extend any credit line at this time. What would change my mind: proven
> feedback from at least two or three distinct counterparties, ideally
> including at least one that itself holds a proven ERC-8004 identity;
> entries spread over a meaningful time window rather than concentrated in
> one proof event; and/or a payment wallet with an on-chain transaction
> history corroborating real settled work. Any of those would let me
> reconsider a small, heavily collateralized starter line.

**Agent 10195, refused** (`0xd911ca0885c68eb4f9fa65edf31d730ac7dda7d006a95bf9f9203c91d9dfdcbe`)

> Refused before underwriting, on a deterministic rule rather than a
> judgment. The identity has changed hands 1 time(s) since it was first
> proven. The record describes work done by a previous holder, so it says
> nothing about the current one. This is not an assessment of the agent's
> quality: the evidence itself is unusable, so no assessment is possible.

**Agent 10230, refused** (`0x3ce48c8e524d12c5d18e27b068650b033f66ed1efdce26e6cd28c4c7a1127c4e`)

> Agent 10230 is essentially a blank slate wearing a single favorable data
> point. The identity was proven only 0.2 days ago, has no payment wallet
> set, and its entire reputation consists of one feedback entry (value
> 80.00) from one counterparty, 0xd40D8538ad075740A88852679Af17110Ff573c1a.
> That counterparty holds no proven ERC-8004 identity of its own, meaning it
> has staked nothing to write that rating and could have been funded by the
> same operator that owns agent 10230 to manufacture a first entry at
> negligible cost. There is no breadth (1 of 1 distinct counterparties), no
> independent standing behind the rater, no time spread (all evidence is 0.2
> days old, i.e. a single burst), and no volume to weigh against the
> identity's youth. This is close to the canonical fabricated-record shape
> the underwriting framework warns against: a clean-looking number from a
> single, unstaked counterparty on a brand-new identity. An 80/100 mean from
> one anonymous-weight rater tells us essentially nothing about how this
> agent performs across a market, and there is no history at all of
> completed work volume, dispute handling, or counterparty diversity to
> anchor a credit assessment. Absence of a payment wallet is itself notable:
> draws would have nowhere proven to settle, adding operational risk on top
> of evidentiary risk. Given all this, extending any credit line would be
> pricing money against a story rather than a track record. What would
> change my mind: multiple entries from several distinct counterparties,
> especially any that themselves hold proven ERC-8004 identities; evidence
> spread over meaningfully more time than a few hours; a proven payment
> wallet with a stable history; and a mean-reverting or at least plausible
> distribution of feedback values rather than a single top-tier score from
> an interested party. Until then, refusal is the correct call, not merely a
> cautious one.

### Every proven fact

All 29 of them, newest last. The final column is measured from the two
block timestamps rather than asserted: it is the gap between an event
happening on Ethereum and its proof landing on Creditcoin. Rows proven as
soon as they could be sit at 8 to 9 minutes, which is the attestation
window. Anything much larger is just an event that was proven later, since
an already-attested block proves immediately however old it is.

| Event | Agent | Detail | On Ethereum | Proven on Creditcoin | Event to proof |
| --- | --- | --- | --- | --- | --- |
| `Registered` | 10128 | owner `0x4B11611CF7C90aEc2003721d71107d7E1cBf37c2` | [`0xb904b1d7…`](https://sepolia.etherscan.io/tx/0xb904b1d7f41ec02f2de5223ee47c20251c4e34ecbeb7d5fcbf22e29671a38b35) | [`0x45f2a111…`](https://creditcoin-testnet.blockscout.com/tx/0x45f2a111c607ab5667cc73f12adebdb4d2766eb93f684b8ab1677b3a270fb093) | +719m30s |
| `Registered` | 10155 | owner `0x491b8312717d5406f52b7287FdD9773Cfcc6cAc6` | [`0x4442c631…`](https://sepolia.etherscan.io/tx/0x4442c6311a850e65d797c8ef9f47b59e368148a0b6b6c62c8ce6a0c3ce6e19f7) | [`0xa18e8d3d…`](https://creditcoin-testnet.blockscout.com/tx/0xa18e8d3ddff5eddb794aa590d95037e64a9778bacfa672edbdc3d214e7e56932) | +8m27s |
| `Registered` | 10156 | owner `0xa0f67760468D678b5C2138bf0D0319aa569644eE` | [`0x887f5afe…`](https://sepolia.etherscan.io/tx/0x887f5afed64ae148c87110df7b761b0a40fce056860a7bcdb80ae06ea390f07c) | [`0x156308fd…`](https://creditcoin-testnet.blockscout.com/tx/0x156308fd349e4de7a0bd828f5c885caa9290466012edbe04f639ed2fc0670a2d) | +8m30s |
| `Registered` | 10157 | owner `0x348e0864f4D647449397e9bc2EEa6a4b582C1cBf` | [`0xddf1a370…`](https://sepolia.etherscan.io/tx/0xddf1a3705d5c2c6f53495bd660001371287e2c6f906ebafdd7b23e989dc4b35b) | [`0x1716b85e…`](https://creditcoin-testnet.blockscout.com/tx/0x1716b85e388340d778567f00e7543f97d63e87d389aec713710c5d16d03b4e0a) | +8m33s |
| `NewFeedback` | 10155 | 0.88 from `0x4B11611C…`, entry 1 | [`0xcb8d6687…`](https://sepolia.etherscan.io/tx/0xcb8d6687ea23553653206ac259afc7b38e9c4a432e1fb047e14dffd7c1f1430b) | [`0x404fb484…`](https://creditcoin-testnet.blockscout.com/tx/0x404fb484d0b486f37a558325522b1064fcd52f58cd6b4d1543cd6159734c989d) | +9m24s |
| `NewFeedback` | 10155 | 0.92 from `0xa0f67760…`, entry 1 | [`0xcc4e0807…`](https://sepolia.etherscan.io/tx/0xcc4e08070a9a52255652c05b4c65384384cd00206c6de6d1cd5bbf8132a102cd) | [`0x504afd06…`](https://creditcoin-testnet.blockscout.com/tx/0x504afd064835b17929e50b8ec6e11aa2350489fead25bc3fd659c84b81f04230) | +9m27s |
| `NewFeedback` | 10155 | 0.95 from `0x348e0864…`, entry 1 | [`0x7b223603…`](https://sepolia.etherscan.io/tx/0x7b2236038e267010e0f10a2df406b91ff4682ac60cd230224b22166878287f7f) | [`0x10f03f00…`](https://creditcoin-testnet.blockscout.com/tx/0x10f03f0001b676e77e25e437de2bc14b3907c616c0b9f21e8529b366d33cacf7) | +9m30s |
| `NewFeedback` | 10156 | 0.99 from `0xA4bBeB84…`, entry 1 | [`0x98be2555…`](https://sepolia.etherscan.io/tx/0x98be2555e368d76d7748b65462f9c2f919103643f044b97dade8bef6963d3afe) | [`0x80853f4c…`](https://creditcoin-testnet.blockscout.com/tx/0x80853f4c105a5ef26e6bd299da2021758e4ca6a51bfa75c657c39e10f9a62622) | +9m09s |
| `NewFeedback` | 10156 | 1.00 from `0xA4bBeB84…`, entry 2 | [`0x92d2283c…`](https://sepolia.etherscan.io/tx/0x92d2283c1dec2c651a16cd2096443f067ece56d71b17788905a9e6fc76683403) | [`0x2cde34bd…`](https://creditcoin-testnet.blockscout.com/tx/0x2cde34bd849f05a37ceb08dd2cc2e202aef16a17b609278e2929a450944df184) | +9m12s |
| `NewFeedback` | 10156 | 0.99 from `0xA4bBeB84…`, entry 3 | [`0xfbe481ac…`](https://sepolia.etherscan.io/tx/0xfbe481ac12f861e432f35d36e7f5a5e6f018774c1eb776044d26cc23dec4ea6d) | [`0xa72fb2d3…`](https://creditcoin-testnet.blockscout.com/tx/0xa72fb2d3a248ffca2fe8103e21469402d2ad5daf570ae22bdedbde9ace10ed65) | +9m15s |
| `NewFeedback` | 10156 | 0.98 from `0xA4bBeB84…`, entry 4 | [`0x7af1734c…`](https://sepolia.etherscan.io/tx/0x7af1734c53c39c1e6de33741f8858b7c216b696b347ba4c5d19585da0f98010b) | [`0x7b837b5c…`](https://creditcoin-testnet.blockscout.com/tx/0x7b837b5ca0e307ba1a6c5494f5aa6504a4d805e65f75db0bc3e363f1fe06b344) | +9m06s |
| `NewFeedback` | 10156 | 1.00 from `0xA4bBeB84…`, entry 5 | [`0xa6d0c636…`](https://sepolia.etherscan.io/tx/0xa6d0c636e930c0e1c2bde00efbaaa6aece775f9ee15eba1257f1cd9f7ad9d381) | [`0x7630f604…`](https://creditcoin-testnet.blockscout.com/tx/0x7630f6046c1312b7576f81a2298b6fe8158c0d56fb6d79d56e105bdb274b754c) | +12m39s |
| `Registered` | 10195 | owner `0xcb51778C3252770Ad07AA03234D9310E69937d50` | [`0xc50a0a06…`](https://sepolia.etherscan.io/tx/0xc50a0a06722b37695749188bcd7ee8da5da4c39ef8a2a5367a57af5e995286b4) | [`0x3858a501…`](https://creditcoin-testnet.blockscout.com/tx/0x3858a501bc8d6dcafe6fbb6868d392905b02ea058fe613f253172d8994e88755) | +8m33s |
| `NewFeedback` | 10195 | 0.90 from `0x4B11611C…`, entry 1 | [`0x76c96f83…`](https://sepolia.etherscan.io/tx/0x76c96f83f37c936d22b87b342099aec638d6691edf7df24a495e780b9b9c43e4) | [`0x6cccf096…`](https://creditcoin-testnet.blockscout.com/tx/0x6cccf096d85cd87c62d583a5f7f0a66672812407b5a4b5e9257e58ddfebadd62) | +8m36s |
| `NewFeedback` | 10195 | 0.93 from `0xa0f67760…`, entry 1 | [`0x50d39a63…`](https://sepolia.etherscan.io/tx/0x50d39a630353e441696364b22a88c61d2adf43462cb5c8b73afffe702abd84ec) | [`0x2eb0e910…`](https://creditcoin-testnet.blockscout.com/tx/0x2eb0e91019fabc8988adb8242f87098e08005988e2283ee9d2fac461ef9f20c0) | +8m39s |
| `NewFeedback` | 10195 | 0.91 from `0x348e0864…`, entry 1 | [`0xa83b4324…`](https://sepolia.etherscan.io/tx/0xa83b43243cdf677f6a5c91dde9115fa7b93870f8d97146f8fd4db25e61c01ba9) | [`0xba1f28cd…`](https://creditcoin-testnet.blockscout.com/tx/0xba1f28cde098b42a55669aa9a74a630e2817af7bbfe838abc63474ee392e5065) | +8m42s |
| `Transfer` | 10195 | `0xA4bBeB84…` to `0x348e0864…`, ownerChanges now 1 | [`0xba26cbfe…`](https://sepolia.etherscan.io/tx/0xba26cbfed032d705cf43adcbe9bf112fc863190042f71813b7f596011c757a90) | [`0x1458f5ba…`](https://creditcoin-testnet.blockscout.com/tx/0x1458f5ba92b15d54cab8ca7322e797ef9cb73f397344f05e015a06a8f632c019) | +8m21s |
| `NewFeedback` | 10155 | 0.94 from `0x348e0864…`, entry 2 | [`0xddac85c1…`](https://sepolia.etherscan.io/tx/0xddac85c1af083dada783e90985b7354f4a6d222ad6d284f111ca05ce99085bf4) | [`0xeb969884…`](https://creditcoin-testnet.blockscout.com/tx/0xeb969884b6d990d7e56adc00dca59e671a2994cbd7e488279a6c39561a067947) | +8m42s |
| `NewFeedback` | 10155 | 0.94 from `0x348e0864…`, entry 3 | [`0x6ef4b57a…`](https://sepolia.etherscan.io/tx/0x6ef4b57a3dc859ff89a386299157b1ee5f8b33397b5cf6d48697dccc3f8396da) | [`0xf7566b34…`](https://creditcoin-testnet.blockscout.com/tx/0xf7566b34d71f918bf9d0a429bfbaab39a08b2c3f0c1c326a5e2298f303d288ef) | +8m45s |
| `Registered` | 10230 | owner `0xf48D457C0272a1b8Cd055486C08d2C68195F504E` | [`0x060470c6…`](https://sepolia.etherscan.io/tx/0x060470c6046af0602cd51afd7a005dbc1522f2fe5e75f8719afd8be11f4a55e1) | [`0xdba03ee2…`](https://creditcoin-testnet.blockscout.com/tx/0xdba03ee2cc0734769b685c6b6d3c462d4f390d43e9173fa3e24eb0dfc38ee259) | +7m24s |
| `NewFeedback` | 10230 | 80.00 from `0xd40D8538…`, entry 1 | [`0x5a39efd1…`](https://sepolia.etherscan.io/tx/0x5a39efd196e2a2aff58a544a508c8e0f75851efe8b8f8fb4385bcffae24e12a4) | [`0xa43a5155…`](https://creditcoin-testnet.blockscout.com/tx/0xa43a5155234dbcf971519d4e4c76d3aed37a006430d6c991a1082b2018667151) | +16m06s |
| `NewFeedback` | 10155 | 0.94 from `0x348e0864…`, entry 4 | [`0x80956cf1…`](https://sepolia.etherscan.io/tx/0x80956cf12f706f61851d30a26205055546415499a8d69b49a6507e8120862757) | [`0x32c8fd6a…`](https://creditcoin-testnet.blockscout.com/tx/0x32c8fd6ae89dce63dc0b9a0fe2c0116559356fb0bf047786397ae9f50a5f40f1) | +9m36s |
| `NewFeedback` | 10230 | 0.91 from `0x491b8312…`, entry 1 | [`0xaa675cc0…`](https://sepolia.etherscan.io/tx/0xaa675cc0232faacd31104b5016ef82c6e6624e47a7b8a680997572a1719bd84a) | [`0x80763ca5…`](https://creditcoin-testnet.blockscout.com/tx/0x80763ca555c97dcac568d741ede375db31ed885e608c798625bbb541e88d49a3) | +8m39s |
| `NewFeedback` | 10230 | 0.91 from `0x348e0864…`, entry 1 | [`0xad177efd…`](https://sepolia.etherscan.io/tx/0xad177efd36f3ed295c097e61f36fc59db8e2c83defd2d33cfe1a56ecde4794e4) | [`0xfbf555c6…`](https://creditcoin-testnet.blockscout.com/tx/0xfbf555c61cac742876b35e4bbe60cb9da7fc5c9dd50c5b3fa646d2437dd06f3c) | +8m42s |
| `Registered` | 10243 | owner `0x6b1Ce1081B88A766a41e1d82e14938D8F1Edf898` | [`0x82fabc7a…`](https://sepolia.etherscan.io/tx/0x82fabc7ac8d3073169e966dfd68991ec3332a58b1cf0b460755dae74707570bc) | [`0xaa3e397c…`](https://creditcoin-testnet.blockscout.com/tx/0xaa3e397c6e99896a39a83b89391fadbc660fc170c69dfaf1ddd77fbd3c0aa057) | +7m33s |
| `NewFeedback` | 10243 | 0.89 from `0x491b8312…`, entry 1 | [`0x042d7898…`](https://sepolia.etherscan.io/tx/0x042d7898b0b5a6ca4736c703019dbd4ffe200079965acd31822dc76ee98b9de5) | [`0x57e0c1ba…`](https://creditcoin-testnet.blockscout.com/tx/0x57e0c1bad2ff4d61cd38559c6cb228cef0d697c28fe6cbcd049377c7bfcd1996) | +10m39s |
| `NewFeedback` | 10243 | 0.93 from `0xa0f67760…`, entry 1 | [`0xd3561234…`](https://sepolia.etherscan.io/tx/0xd3561234b29b584d2a902fabb30e495ee256a60a47ebaf28e3b62612b485cc97) | [`0x8e002679…`](https://creditcoin-testnet.blockscout.com/tx/0x8e002679f13e93077f1c32dd70965ed5a70d61b357695a698cbcbfbf3f5ebc5e) | +10m42s |
| `NewFeedback` | 10243 | 0.90 from `0x348e0864…`, entry 1 | [`0x8e731d39…`](https://sepolia.etherscan.io/tx/0x8e731d39f84a794efb609630dc364fdf252023ed2339992f9ccc4bb59c070c07) | [`0x5ccff18d…`](https://creditcoin-testnet.blockscout.com/tx/0x5ccff18df7831ae7e57a6da144137a885e31424ea72efede20a7ffb2fa7184eb) | +10m33s |
| `NewFeedback` | 10155 | 0.94 from `0x348e0864…`, entry 5 | [`0x08ab8d44…`](https://sepolia.etherscan.io/tx/0x08ab8d445905f19c2fc662ac7ecb27c8aded22addf5d7da8f270a3b153ab3027) | [`0xb37ec507…`](https://creditcoin-testnet.blockscout.com/tx/0xb37ec507bbb8579dd168d2181fe3f9c218d85ccb66e89448987276c0af2644a4) | +8m42s |

### Every credit line transaction

| Event | Agent | Detail | Transaction |
| --- | --- | --- | --- |
| `UnderwriterSet` | - | `0x4B11611CF7C90aEc2003721d71107d7E1cBf37c2` | [`0x54c13749…`](https://creditcoin-testnet.blockscout.com/tx/0x54c137492c8f0f53111ef91a00e0c54452a20105e0da62e95ecae425b714df9d) |
| `LineOffered` | 10128 | limit 2.00 tCTC, collateral 0.50 tCTC, 500 bps | [`0x3f2037c9…`](https://creditcoin-testnet.blockscout.com/tx/0x3f2037c92ee42a0729ecd5f5462c29c4cf3b2243a7ccb9c0828c6377002ffc63) |
| `LineAccepted` | 10128 | collateral posted 0.50 tCTC | [`0x43bdef36…`](https://creditcoin-testnet.blockscout.com/tx/0x43bdef369506a0b9d1e757705949f7d0027237f47a71f86948b64f627ee35987) |
| `Drawn` | 10128 | drew 1.00 tCTC | [`0xf9113c59…`](https://creditcoin-testnet.blockscout.com/tx/0xf9113c597d1f14e44ea4b57345ad52c89e01912f1a680455ccbad29acac0f701) |
| `RepaidLine` | 10128 | principal 1.00 tCTC, interest 0.05 tCTC | [`0x974a761d…`](https://creditcoin-testnet.blockscout.com/tx/0x974a761dd1b3f076bb0b9d7fc126f80f8385dad42928c5e81097601cda46ea83) |
| `LineClosed` | 10128 | collateral returned 0.50 tCTC | [`0x974a761d…`](https://creditcoin-testnet.blockscout.com/tx/0x974a761dd1b3f076bb0b9d7fc126f80f8385dad42928c5e81097601cda46ea83) |
| `LineOffered` | 10155 | limit 2.00 tCTC, collateral 1.20 tCTC, 1800 bps | [`0x3722e6ab…`](https://creditcoin-testnet.blockscout.com/tx/0x3722e6ab2111a8f395720d43df536f25401a22de86caace42b1d3eba8f71f341) |
| `LineAccepted` | 10155 | collateral posted 1.20 tCTC | [`0x837cc5eb…`](https://creditcoin-testnet.blockscout.com/tx/0x837cc5eb264c8fd6ee8cc495962d6e3e0763573319d7760edfdb3571a436547d) |
| `Drawn` | 10155 | drew 1.00 tCTC | [`0x29eee0fb…`](https://creditcoin-testnet.blockscout.com/tx/0x29eee0fb25e3f1f02e132e9afe3e44a5420799b32c6c881b630d5568c9460011) |
| `LineOffered` | 10195 | limit 2.00 tCTC, collateral 1.20 tCTC, 1800 bps | [`0xbf668613…`](https://creditcoin-testnet.blockscout.com/tx/0xbf668613b6cf3a546aa42b3979852b22d799cd0061b753f9fbb677b2c7ec2d38) |
| `LineAccepted` | 10195 | collateral posted 1.20 tCTC | [`0xbfa44a9e…`](https://creditcoin-testnet.blockscout.com/tx/0xbfa44a9eb0bdbb52a97625ca0838f2e6319f03c3a96c890839499970b11999d7) |
| `Drawn` | 10195 | drew 1.00 tCTC | [`0x6dcc6a64…`](https://creditcoin-testnet.blockscout.com/tx/0x6dcc6a6470ee97dffb7a198b33fb798bef3bc474b4dfd4b1ed9792a74a133a5f) |
| `LineFrozen` | 10195 | **IdentityTransferred** | [`0x7d3a1228…`](https://creditcoin-testnet.blockscout.com/tx/0x7d3a1228e3a67e7e26a40a1a5813986e218065a4fad5d985c22cfe49273efd49) |
| `RepaidLine` | 10155 | principal 0.30 tCTC, interest 0.00 tCTC | [`0x3c88801c…`](https://creditcoin-testnet.blockscout.com/tx/0x3c88801c317667890bf9d727f87a7d6b684af55fb974b2d777ab91790dc51c95) |
| `Drawn` | 10155 | drew 0.96 tCTC | [`0xa8706f73…`](https://creditcoin-testnet.blockscout.com/tx/0xa8706f7360b3b60b07a3dcf1052e0612e9908da0656cf63cc10e43abe29720e6) |
| `RepaidLine` | 10155 | principal 0.04 tCTC, interest 0.00 tCTC | [`0x2d3437e7…`](https://creditcoin-testnet.blockscout.com/tx/0x2d3437e73ed4bc30ab7fbb6679b0d61879bb1c70ae801e110166cf28cdfe3c93) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0xe57d65cf…`](https://creditcoin-testnet.blockscout.com/tx/0xe57d65cfb1f0dc363c6d31d2c8d52bf962aae7499db1194bd338881ba4d2b8b6) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0x0711bfa5…`](https://creditcoin-testnet.blockscout.com/tx/0x0711bfa526b239563b0ec2c388427d02911de8afbd8dd63280ab0ad5c242521b) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0xe9785622…`](https://creditcoin-testnet.blockscout.com/tx/0xe978562215a0f1b4e9b56ef8274a804935a0e935cfb81cf56910b82bcd31f1c1) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0xdbe0b207…`](https://creditcoin-testnet.blockscout.com/tx/0xdbe0b2074ea71589b8aaace44a3be9bd69392438f7da245d401a213749e8d786) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0xb370b599…`](https://creditcoin-testnet.blockscout.com/tx/0xb370b599301e5f5c0a8c8bf446563762470ce03c7d2162ff369ff71ce71441fe) |
| `LineOffered` | 10243 | limit 2.00 tCTC, collateral 1.20 tCTC, 1800 bps | [`0xdc30155b…`](https://creditcoin-testnet.blockscout.com/tx/0xdc30155ba3958a98372aa2017ba80ee227cd5ed96967466968985f72a151fa1a) |
| `LineAccepted` | 10243 | collateral posted 1.20 tCTC | [`0x01fb7556…`](https://creditcoin-testnet.blockscout.com/tx/0x01fb7556a383b3536bc938f47c267841403496555b6915e22fe6a485eb31ec89) |
| `RepaidLine` | 10155 | principal 0.04 tCTC, interest 0.00 tCTC | [`0xb37c9be6…`](https://creditcoin-testnet.blockscout.com/tx/0xb37c9be655109144bb4b450b8b320d3b4859cd7efa20af7f65adbdac1c0d053b) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0xf353c03f…`](https://creditcoin-testnet.blockscout.com/tx/0xf353c03f5e2015863931016e29378ef0a7b03013ac3b0622d741fcdb1b8a035c) |
| `RepaidLine` | 10155 | principal 0.20 tCTC, interest 0.00 tCTC | [`0x1d1d08c6…`](https://creditcoin-testnet.blockscout.com/tx/0x1d1d08c675706c34062bf5740058b59fcfc416b1637b5035069f0e6ae4720c64) |
| `RepaidLine` | 10155 | principal 0.18 tCTC, interest 0.02 tCTC | [`0xa11bbd01…`](https://creditcoin-testnet.blockscout.com/tx/0xa11bbd0111976366a7bb2dc642c54da76d3cf92b5d41e5456ed8cb70b30d760f) |
| `Drawn` | 10243 | drew 0.88 tCTC | [`0x38b0c2d7…`](https://creditcoin-testnet.blockscout.com/tx/0x38b0c2d7306d0321c4f1e4ccd11eac5b9eca4fd32ac392791dcf39a378ae18ef) |
| `RepaidLine` | 10155 | principal 0.00 tCTC, interest 0.20 tCTC | [`0x516fc46b…`](https://creditcoin-testnet.blockscout.com/tx/0x516fc46bcc1bde3642beb2ad23bbd24b70f5e4139e8003996ebc78eacde0ce7b) |
| `RepaidLine` | 10155 | principal 0.00 tCTC, interest 0.13 tCTC | [`0x23b93994…`](https://creditcoin-testnet.blockscout.com/tx/0x23b93994c6ce03d0a4647e8efae306cbe957fbd9605b77ea05d21ca94c791302) |
| `LineClosed` | 10155 | collateral returned 1.20 tCTC | [`0x23b93994…`](https://creditcoin-testnet.blockscout.com/tx/0x23b93994c6ce03d0a4647e8efae306cbe957fbd9605b77ea05d21ca94c791302) |
| `RepaidLine` | 10243 | principal 0.08 tCTC, interest 0.00 tCTC | [`0x82db99d4…`](https://creditcoin-testnet.blockscout.com/tx/0x82db99d47510fea047817f50035f1c2ac137fa8f1bb9b77be8078116b0225d79) |

### Contracts

| What | Chain | Address |
| --- | --- | --- |
| AssayOracle | Creditcoin | [`0x76131b6547b584e9f101618239A26B2aCCd8aA43`](https://creditcoin-testnet.blockscout.com/address/0x76131b6547b584e9f101618239A26B2aCCd8aA43) |
| CreditLine | Creditcoin | [`0x210fb072cdcC034A691685Ea5ac14347D77A501c`](https://creditcoin-testnet.blockscout.com/address/0x210fb072cdcC034A691685Ea5ac14347D77A501c) |
| LendingPool | Creditcoin | [`0x97343f59FC3F14945eDC3e8c6B3406C4E6bF15CD`](https://creditcoin-testnet.blockscout.com/address/0x97343f59FC3F14945eDC3e8c6B3406C4E6bF15CD) |
| ERC-8004 Identity | Sepolia | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 Reputation | Sepolia | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://sepolia.etherscan.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |

The two Sepolia registries are the trust anchor of the whole system. Assay
did not deploy them and cannot write to them, and they are the only two
addresses whose events the oracle will accept.

### Checking any of this yourself

Nothing here requires trusting this file. Open any Creditcoin transaction
above and read the `execute` call it made: the block height and Merkle
proof it carries are the ones the precompile verified. The Ethereum link
in the same row is the transaction that proof was built from. If the two
ever disagreed, the proof would not have been accepted.
