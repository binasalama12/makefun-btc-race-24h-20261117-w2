[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/binasalama12/makefun-btc-race-24h-20261117-w2/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/binasalama12/makefun-btc-race-24h-20261117-w2/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

# EMA Deviation Reversion — cbBTC/USDC

Repository: makefun-btc-race-24h-20261117-w2

Competition: https://make.fun/bounty/btc-race-24h-20261117-0603

A mean-reversion bot for the make.fun BTC race. It tracks a 320-bar
exponential moving average of the cbBTC close and treats that line as the
price the market keeps coming back to. When a bar closes at least 0.50%
below the line, the bot buys a 600 USDC slice at the next bar's open; it
sells the whole position once a bar closes back at the line plus a small
0.10% premium, since a reversion usually overshoots its average a little.
There is no profit target measured from the entry and no clock on the
trade: the exit is the reversion event, whenever it happens. Two guards
keep the idea honest: the bot will not buy while the average itself is
falling faster than 0.10% over the last 60 bars (a deviation under a
falling line is a downtrend, not noise), and a position is cut if the
close falls 0.90% below its entry reference. While the price runs above
the line the bot simply holds cash and waits for the next stretch. All of
its decisions are
deterministic functions of the bar stream — the hello, each batch of bars
and the orders it answers — so replays reproduce exactly.
