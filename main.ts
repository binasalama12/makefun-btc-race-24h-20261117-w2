// EMA deviation reversion, for the bars-replay/v1 protocol. One asset
// (CBBTC against USDC), long only, one position at a time.
//
// The bot keeps one slow exponential average of the close. A close at least
// 0.50% under that average is bought, on the view that the deviation is
// mostly noise around a level the price revisits; the position is sold the
// first time a close gets back to the average. Entries and exits are both
// read off the same line, so the average has to be slow enough that ordinary
// chop does not cross it every few bars: at a 320-bar span a round trip
// costs the 4 bps fee, the 2 bps modelled slippage and the pool impact on a
// 600 USDC slice, and the typical deviation it harvests is several times
// that.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

/** EMA span in bars: the reversion target line. */
const EMA_SPAN = 320;
/** Buy when the close is this fraction below the EMA. */
const DIP = 0.005; // 0.50%
/** Sell once the close reaches this fraction above the EMA: the reversion
 *  usually overshoots the line a little, and giving it that room roughly
 *  doubled the dev-window result against selling at the line itself. */
const EXIT_PREMIUM = 0.001; // 0.10%
/** Protective stop: sell if the close falls this fraction below the entry
 *  reference, for the deviations that turn out to be real moves. */
const STOP_LOSS = 0.009; // 0.90%
/** Regime filter: no buys while the EMA itself is falling faster than
 *  SLOPE_MIN over the last SLOPE_WIN bars — a deviation under a falling
 *  line is a downtrend, not noise. */
const SLOPE_WIN = 60;
const SLOPE_MIN = -0.001; // -0.10% over the window
/** Fixed buy size: 600 USDC in raw quote units (6 decimals). */
const SLICE = 600_000_000n;
/** Take the modelled fill wherever it lands; a refused order here only
 *  delays the same decision to the next bar, but a refused exit can strand
 *  a position through the whole reversion. */
const MAX_SLIPPAGE_BPS = 10_000;

let ema: number | null = null;
let barsSeen = 0;
/** EMA values of the last SLOPE_WIN + 1 batches, oldest first. */
const emaTrail: number[] = [];
/** Close (in USDC) of the bar on which the open position's buy was decided. */
let entryRef: number | null = null;
/** The same, for a buy that has been sent but not yet seen in the account. */
let pendingRef: number | null = null;

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    const symbol = state.hello.symbols[0]?.symbol;
    if (symbol === undefined) return [];
    const closeRaw = state.close(symbol);
    if (closeRaw === null) return [];
    const close = Number(closeRaw) / 1e8; // CBBTC price scale: 8 decimals

    barsSeen += 1;
    if (ema === null) {
      ema = close;
    } else {
      const k = 2 / (EMA_SPAN + 1);
      ema += k * (close - ema);
    }
    emaTrail.push(ema);
    if (emaTrail.length > SLOPE_WIN + 1) emaTrail.shift();
    if (state.warmingUp) return [];

    const held = state.positions.get(symbol);
    const holding = held !== undefined && held.qty > 0n;

    if (holding) {
      if (entryRef === null) entryRef = pendingRef ?? close;
      pendingRef = null;
      if (close >= ema * (1 + EXIT_PREMIUM) || close <= entryRef * (1 - STOP_LOSS)) {
        return [{ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    entryRef = null;
    // No entries until the EMA has a full slope window of its own history
    // behind it: before that the regime filter would be reading the EMA's
    // seeding transient, and the first version of this bot, which traded
    // from bar EMA_SPAN on, gave back about a sixth of its dev result to
    // exactly those early, unfiltered entries.
    if (barsSeen < EMA_SPAN + SLOPE_WIN) return [];
    if (emaTrail.length > SLOPE_WIN) {
      const slope = ema / emaTrail[0] - 1;
      if (slope < SLOPE_MIN) return [];
    }
    if (close < ema * (1 - DIP)) {
      let slice = SLICE;
      if (state.cash < slice) slice = state.cash;
      const room = state.weightRoom(symbol);
      if (room < slice) slice = room;
      if (slice <= 0n || slice < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      pendingRef = close;
      return [{ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
