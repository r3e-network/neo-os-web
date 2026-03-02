const fs = require('fs');

const file = 'services/simulation/marble/simulator_types.go';
let code = fs.readFileSync(file, 'utf8');

// The simulation service had 64+ apps hardcoded. Let's truncate it to just what's actually relevant to the remaining template factory (or at least keep it small).
// The goal is to not delete the whole simulator as it might break tests, but rather limit the slice.
const newFunc = `func AllMiniApps() []MiniAppConfig {
        return []MiniAppConfig{
                {AppID: "builtin-lottery", Name: "Neo Lottery", Category: "gaming", Interval: 5 * time.Second, BetAmount: 10000000, Description: "Buy lottery tickets, draw winners"},
                {AppID: "builtin-coin-flip", Name: "Neo Coin Flip", Category: "gaming", Interval: 3 * time.Second, BetAmount: 5000000, Description: "50/50 coin flip, double or nothing"},
                {AppID: "builtin-dice-game", Name: "Neo Dice", Category: "gaming", Interval: 4 * time.Second, BetAmount: 8000000, Description: "Roll dice, win up to 6x"},
                {AppID: "builtin-prediction-market", Name: "Prediction Market", Category: "defi", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Bet on price movements"},
        }
}`;

code = code.replace(/func AllMiniApps\(\) \[\]MiniAppConfig \{\n[\s\S]*?\n\}/, newFunc);
fs.writeFileSync(file, code);

