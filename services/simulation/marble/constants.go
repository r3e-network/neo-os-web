// Package neosimulation provides simulation service for automated transaction testing.
// This file contains all named constants extracted from simulation business logic.
package neosimulation

import "time"

// =============================================================================
// GAS Amount Constants (in smallest unit, 8 decimals: 1 GAS = 100_000_000)
// =============================================================================

const (
	// GASDecimals is the number of decimal places for GAS token.
	GASDecimals = 100_000_000 // 1 GAS

	// Lottery
	LotteryTicketPrice = 10_000_000 // 0.1 GAS per ticket

	// Coin Flip
	CoinFlipMinBet = 5_000_000 // 0.05 GAS minimum bet

	// Dice Game
	DiceGameBetAmount = 8_000_000 // 0.08 GAS per bet

	// Scratch Card
	ScratchCardBasePrice = 2_000_000 // 0.02 GAS base price per card type level

	// Mega Millions
	MegaMillionsTicketPrice = 20_000_000 // 0.2 GAS per ticket

	// Gas Spin
	GasSpinMinBet = 5_000_000 // 0.05 GAS minimum spin bet

	// Neo Crash
	NeoCrashBetUnit = 10_000_000 // 0.1 GAS bet unit

	// Throne of Gas
	ThroneOfGasBidUnit = 10_000_000 // 0.1 GAS bid unit

	// Doomsday Clock
	DoomsdayKeyPrice = 100_000_000 // 1 GAS per key

	// Burn League
	BurnLeagueAmount = 20_000_000 // 0.2 GAS burn amount

	// Puzzle Mining
	PuzzleMiningFee = 5_000_000 // 0.05 GAS per puzzle

	// Fog Puzzle
	FogPuzzleRevealFee = 5_000_000 // 0.05 GAS per reveal

	// Crypto Riddle
	CryptoRiddleFee = 10_000_000 // 0.1 GAS per riddle

	// Secret Poker
	SecretPokerBuyIn = 50_000_000 // 0.5 GAS buy-in

	// Micro Predict
	MicroPredictBet = 10_000_000 // 0.1 GAS per prediction

	// Red Envelope
	RedEnvelopeAmount = 20_000_000 // 0.2 GAS per envelope

	// Red Envelope claim unit
	RedEnvelopeClaimUnit = 1_000_000 // 0.01 GAS claim unit

	// Gas Circle
	GasCircleDepositAmount = 10_000_000 // 0.1 GAS per deposit

	// Time Capsule
	TimeCapsuleBuryFee = 20_000_000 // 0.2 GAS to bury
	TimeCapsuleFishFee = 5_000_000  // 0.05 GAS to fish

	// Dev Tipping
	DevTippingUnit = 100_000_000 // 1 GAS tipping unit

	// Graveyard
	GraveyardBurialFee = 10_000_000 // 0.1 GAS per burial

	// Flash Loan
	FlashLoanAmount = 100_000_000 // 1 GAS loan amount
	FlashLoanFee    = 1_000_000   // 0.01 GAS fee

	// Heritage Trust
	HeritageTrustDeposit = 100_000_000 // 1 GAS deposit

	// Compound Capsule
	CompoundCapsuleDeposit = 50_000_000 // 0.5 GAS deposit

	// Self Loan
	SelfLoanAmount = 100_000_000 // 1 GAS loan

	// Unbreakable Vault
	UnbreakableVaultDeposit = 50_000_000 // 0.5 GAS deposit

	// Gov Booster
	GovBoosterMinStake = 100_000_000 // 1 GAS minimum stake

	// Guardian Policy
	GuardianPolicyFee = 5_000_000 // 0.05 GAS fee

	// Daily Checkin
	DailyCheckinFee = 100_000 // 0.001 GAS check-in fee

	// Gov Merc
	GovMercVoteFee = 10_000_000 // 0.1 GAS per vote

	// Masquerade DAO
	MasqueradeDAOFee = 5_000_000 // 0.05 GAS per vote

	// Garden of Neo
	GardenOfNeoPlantFee = 10_000_000 // 0.1 GAS per plant

	// On-Chain Tarot
	OnChainTarotFee = 5_000_000 // 0.05 GAS per reading

	// Ex-Files
	ExFilesFee = 5_000_000 // 0.05 GAS per share

	// Breakup Contract
	BreakupContractFee = 10_000_000 // 0.1 GAS per contract

	// Million Piece Map
	MillionPieceMapPixelPrice = 1_000_000 // 0.01 GAS per pixel

	// Canvas
	CanvasDrawFee = 1_000_000 // 0.01 GAS per draw

	// Candidate Vote
	CandidateVoteFee = 10_000_000 // 0.1 GAS per vote

	// Neoburger
	NeoburgerStakeAmount = 100_000_000 // 1 GAS stake

	// Grant Share
	GrantShareAmount = 50_000_000 // 0.5 GAS per grant action

	// Neo NS
	NeoNSBasePrice        = 10_000_000 // 0.1 GAS base price
	NeoNSRegistrationMult = 5          // Registration costs 5x base price
)

// =============================================================================
// Game Mechanic Constants
// =============================================================================

const (
	// Lottery
	LotteryDrawEveryNTickets = 5 // Draw triggered every N tickets
	LotteryPrizeMultiplier   = 3 // Winner gets 3x the ticket amount

	// Coin Flip
	CoinFlipPayoutMultiplier = 2 // Winner gets 2x bet

	// Dice Game
	DiceMinFace          = 1 // Minimum dice face value
	DiceMaxFace          = 6 // Maximum dice face value
	DicePayoutMultiplier = 6 // Winner gets 6x bet (1-in-6 odds)

	// Scratch Card
	ScratchCardMinType     = 1 // Minimum card type
	ScratchCardMaxType     = 3 // Maximum card type
	ScratchCardWinChance   = 5 // 1-in-5 chance to win
	ScratchCardPrizeFactor = 2 // Prize = amount * cardType * factor

	// Mega Millions
	MegaMillionsMaxTickets    = 3   // Max tickets per purchase
	MegaMillionsDrawEveryN    = 10  // Draw every N tickets
	MegaMillionsMaxPrizeLevel = 9   // Prize levels 1-9
	MegaMillionsWinThreshold  = 3   // Prize levels <= 3 win
	MegaMillionsMainNumbers   = 5   // Count of main numbers per ticket
	MegaMillionsMainMax       = 70  // Main number range 1-70
	MegaMillionsMegaBallMax   = 25  // Mega ball range 1-25
	MegaMillionsPrize1x       = 100 // Top prize multiplier
	MegaMillionsPrize2x       = 50  // Second prize multiplier
	MegaMillionsPrize3x       = 20  // Third prize multiplier

	// Gas Spin
	GasSpinSegments = 8 // Number of wheel segments

	// Neo Crash
	NeoCrashMaxBetUnits     = 10  // Max bet = 10 units (1 GAS)
	NeoCrashCashoutChance   = 10  // Out of 10 (60% = 6/10)
	NeoCrashCashoutSuccess  = 6   // Cashout if roll <= 6
	NeoCrashMinMultiplier   = 110 // 1.10x minimum cashout multiplier (in hundredths)
	NeoCrashMaxMultiplier   = 300 // 3.00x maximum cashout multiplier (in hundredths)
	NeoCrashMultiplierScale = 100 // Divider to convert hundredths to float

	// Throne of Gas
	ThroneMinBidUnits = 11 // Minimum bid = 1.1 GAS (11 units of 0.1)
	ThroneMaxBidUnits = 30 // Maximum bid = 3.0 GAS (30 units of 0.1)
	ThroneTaxDivisor  = 10 // Tax = bid / 10 (10%)

	// Doomsday Clock
	DoomsdayMaxKeys   = 5   // Max keys per purchase
	DoomsdayWinChance = 100 // 1-in-100 chance (1% timer expiry)
	DoomsdayWinRoll   = 1   // Win if roll == 1

	// Secret Poker
	SecretPokerWinChance   = 4 // 1-in-4 chance to win
	SecretPokerPayoutMult  = 3 // Winner gets 3x buy-in
	SecretPokerTableEveryN = 5 // New table every 5 games
	SecretPokerHandEveryN  = 4 // Start hand every 4 joins

	// Micro Predict
	MicroPredictPayoutRate = 1.9 // Winner gets 1.9x bet
	MicroPredictMinPrice   = 30000
	MicroPredictMaxPrice   = 50000
	MicroPredictPriceScale = 100_000_000 // Price in 8 decimals

	// Red Envelope
	RedEnvelopeMinPackets  = 3       // Minimum packets per envelope
	RedEnvelopeMaxPackets  = 10      // Maximum packets per envelope
	RedEnvelopeExpiryMS    = 3600000 // 1 hour expiry in milliseconds
	RedEnvelopeMinClaims   = 1       // Min claims per envelope
	RedEnvelopeMaxClaims   = 3       // Max claims per envelope
	RedEnvelopeMaxClaimAmt = 20      // Max claim amount in units

	// Gas Circle
	GasCircleMaxMembers   = 10 // Max members per circle
	GasCircleCreateEveryN = 10 // New circle every 10 deposits
	GasCircleWinChance    = 10 // 1-in-10 chance to win
	GasCirclePayoutMult   = 10 // Winner gets 10x deposit

	// Time Capsule
	TimeCapsuleBuryChance    = 4   // Out of 10 actions: 40% bury
	TimeCapsuleFishChance    = 8   // Out of 10 actions: 40% fish (5-8)
	TimeCapsuleMaxUnlockDays = 365 // Max unlock time in days

	// Dev Tipping
	DevTippingMaxAmount = 10 // Max tip = 10 GAS
	DevTippingMaxDevID  = 8  // Developer IDs 1-8

	// Gov Booster
	GovBoosterMinLockDays = 7  // Minimum lock period
	GovBoosterMaxLockDays = 90 // Maximum lock period

	// Daily Checkin
	DailyCheckinRewardChance = 100 // Out of 100
	DailyCheckinRewardRoll   = 20  // Claim if roll <= 20 (20%)

	// Grant Share
	GrantShareCreateChance = 4 // Out of 5 (randomInt(0,4)==0 => 20% create)
	GrantShareMaxGrantID   = 100

	// Neo NS
	NeoNSMinDomainNum   = 1000
	NeoNSMaxDomainNum   = 9999
	NeoNSRenewMinNum    = 1
	NeoNSRenewMaxNum    = 500
	NeoNSRegisterChance = 2 // Out of 3 (randomInt(0,2)==0 => 33% register)
)

// GasSpinMultipliers defines the payout multipliers for each wheel segment.
var GasSpinMultipliers = []float64{0, 0.5, 1, 1.5, 2, 3, 5, 10}

// MegaMillionsPrizeMultipliers maps prize level index to payout multiplier.
var MegaMillionsPrizeMultipliers = []int64{MegaMillionsPrize1x, MegaMillionsPrize2x, MegaMillionsPrize3x}

// =============================================================================
// Service Worker Timing Constants
// =============================================================================

const (
	// PriceFeedUpdateInterval is how often price feeds are updated.
	PriceFeedUpdateInterval = 5 * time.Second

	// PriceFeedInterSymbolDelay is the delay between updating different symbols.
	PriceFeedInterSymbolDelay = 500 * time.Millisecond

	// RandomnessRecordInterval is how often randomness is recorded on-chain.
	RandomnessRecordInterval = 10 * time.Second

	// AutoTopUpCheckInterval is how often pool account balances are checked.
	AutoTopUpCheckInterval = 30 * time.Second

	// AutoTopUpInitialDelay is the delay before the first top-up check.
	AutoTopUpInitialDelay = 5 * time.Second

	// AutoTopUpInterAccountDelay is the delay between funding individual accounts.
	AutoTopUpInterAccountDelay = 2 * time.Second

	// AutoStartDelay is the delay before auto-starting simulation.
	AutoStartDelay = 2 * time.Second

	// AutoTopUpMinGASBalance is the minimum GAS balance before triggering top-up (0.1 GAS).
	AutoTopUpMinGASBalance int64 = 10_000_000

	// AutoTopUpFundAmount is the amount to fund when balance is low (1 GAS).
	AutoTopUpFundAmount int64 = 100_000_000

	// AutoTopUpMaxAccounts is the max accounts to check per top-up run.
	AutoTopUpMaxAccounts = 10

	// AutomationTopUpCheckInterval is how often automation task balances are checked.
	AutomationTopUpCheckInterval = 60 * time.Second

	// AutomationTopUpInitialDelay is the delay before the first automation check.
	AutomationTopUpInitialDelay = 10 * time.Second

	// AutomationTopUpInterTaskDelay is the delay between funding individual tasks.
	AutomationTopUpInterTaskDelay = 5 * time.Second

	// AutomationMinTaskBalance is the minimum task balance before top-up (1 GAS).
	AutomationMinTaskBalance int64 = 100_000_000

	// AutomationTopUpAmount is the amount to fund automation tasks (10 GAS).
	AutomationTopUpAmount int64 = 1_000_000_000

	// AutomationMinBalanceNeeded is the minimum account balance for automation funding (11 GAS).
	AutomationMinBalanceNeeded int64 = 1_100_000_000

	// AutomationFundConfirmWait is the wait time after funding an automation account.
	AutomationFundConfirmWait = 5 * time.Second
)

// =============================================================================
// Miscellaneous Constants
// =============================================================================

const (
	// ShortHashLength is the max length for abbreviated transaction hashes.
	ShortHashLength = 16

	// FetchUserAddressCount is the number of user addresses to fetch from DB.
	FetchUserAddressCount = 200

	// FetchUserAddressTimeout is the timeout for fetching user addresses.
	FetchUserAddressTimeout = 30 * time.Second

	// PriceVariancePercent is the percentage variance for simulated price feeds.
	PriceVariancePercent = 2

	// DefaultReplayWindow is the default replay protection window for txproxy.
	DefaultReplayWindow = 1 * time.Hour
)
