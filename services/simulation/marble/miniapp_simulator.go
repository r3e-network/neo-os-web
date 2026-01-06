// Package neosimulation provides MiniApp workflow simulation.
package neosimulation

import (
	"fmt"
	"sync/atomic"
)

// MiniAppSimulator simulates all MiniApp workflows.
type MiniAppSimulator struct {
	invoker       ContractInvokerInterface
	userAddresses []string

	// Gaming stats
	lotteryTickets      int64
	lotteryDraws        int64
	lotteryPayouts      int64
	coinFlipBets        int64
	coinFlipWins        int64
	coinFlipPayouts     int64
	diceGameBets        int64
	diceGameWins        int64
	diceGamePayouts     int64
	scratchCardBuys     int64
	scratchCardWins     int64
	scratchCardPayouts  int64
	megaMillionsTickets int64
	megaMillionsDraws   int64
	megaMillionsWins    int64
	megaMillionsPayouts int64
	gasSpinBets         int64
	gasSpinWins         int64
	gasSpinPayouts      int64

	// DeFi stats
	predictionBets      int64
	predictionResolves  int64
	predictionPayouts   int64
	flashloanBorrows    int64
	flashloanRepays     int64
	priceQueries        int64
	pricePredictBets    int64
	pricePredictWins    int64
	pricePredictPayouts int64
	turboOptionsBets    int64
	turboOptionsWins    int64
	turboOptionsPayouts int64
	ilGuardDeposits     int64
	ilGuardClaims       int64

	// Social stats
	secretVoteCasts   int64
	secretVoteTallies int64
	secretPokerGames  int64
	secretPokerWins   int64
	microPredictBets  int64
	microPredictWins  int64
	redEnvelopeSends  int64
	redEnvelopeClaims int64
	gasCircleDeposits int64
	gasCircleWins     int64

	// Governance & Advanced stats
	govBoosterVotes  int64
	fogChessGames    int64
	fogChessWins     int64

	// New MiniApps stats (Phase 5)
	neoCrashBets        int64
	neoCrashCashouts    int64
	neoCrashPayouts     int64
	candleWarsBets      int64
	candleWarsWins      int64
	dutchAuctionBids    int64
	dutchAuctionSales   int64
	parasiteStakes      int64
	parasiteAttacks     int64
	throneOfGasClaims   int64
	throneOfGasTaxes    int64
	noLossLotteryStakes int64
	noLossLotteryWins   int64
	doomsdayClockKeys   int64
	doomsdayClockWins   int64
	payToViewPurchases  int64
	payToViewCreates    int64

	// New MiniApps stats (Phase 6 - TEE-powered)
	schrodingerAdopts    int64
	schrodingerObserves  int64
	schrodingerTrades    int64
	algoBattleUploads    int64
	algoBattleMatches    int64
	algoBattleWins       int64
	timeCapsuleBuries    int64
	timeCapsuleReveals   int64
	timeCapsuleFishes    int64
	gardenOfNeoPlants    int64
	gardenOfNeoHarvests  int64
	devTippingTips       int64

	// Phase 7 stats
	aiSoulmateChats      int64
	deadSwitchSetups     int64
	heritageTrustCreates int64
	darkRadioBroadcasts  int64
	zkBadgeMints         int64
	graveyardBurials     int64
	compoundDeposits     int64
	selfLoanBorrows      int64
	darkPoolSwaps        int64
	burnLeagueBurns      int64
	govMercVotes         int64

	// Phase 8 stats
	quantumSwaps         int64
	tarotReadings        int64
	exFilesShares        int64
	screamSubmits        int64
	breakupContracts     int64
	geoSpotlightBids     int64
	puzzleSolves         int64
	chimeraMerges        int64
	pianoNotes           int64
	bountyHunts          int64
	masqueradeVotes      int64
	meltingDeposits      int64
	vaultLocks           int64
	whisperSends         int64
	mapPieceBuys         int64
	fogPuzzleReveals     int64
	riddleSolves         int64

	// Phase 9 stats (new MiniApps)
	canvasDraws          int64
	candidateVotes       int64
	neoburgerStakes      int64
	guardianPolicySets   int64
	dailyCheckins        int64
	dailyCheckinClaims   int64

	// Phase 10 stats (GrantShare, Neo Chat, Neo NS)
	grantShareFunds    int64
	grantShareCreates  int64
	neoChatMessages    int64
	neoChatRooms       int64
	neoNSRegistrations int64
	neoNSRenewals      int64

	simulationErrors int64

	missingUserAddressesLogged uint32
}

// NewMiniAppSimulator creates a new MiniApp simulator.
func NewMiniAppSimulator(invoker ContractInvokerInterface, userAddresses []string) *MiniAppSimulator {
	return &MiniAppSimulator{
		invoker:       invoker,
		userAddresses: userAddresses,
	}
}

// getRandomUserAddress returns a random user address for payouts.
func (s *MiniAppSimulator) getRandomUserAddress() string {
	if len(s.userAddresses) == 0 {
		return ""
	}
	return s.userAddresses[randomInt(0, len(s.userAddresses)-1)]
}

func (s *MiniAppSimulator) getRandomUserAddressOrWarn(appID, action string) (string, bool) {
	address := s.getRandomUserAddress()
	if address == "" {
		atomic.AddInt64(&s.simulationErrors, 1)
		if atomic.CompareAndSwapUint32(&s.missingUserAddressesLogged, 0, 1) {
			fmt.Printf("neosimulation: skipping %s for %s: no user addresses configured\n", action, appID)
		}
		return "", false
	}
	return address, true
}

// GetStats returns current simulation statistics.
func (s *MiniAppSimulator) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"gaming": map[string]interface{}{
			"lottery":       map[string]int64{"tickets": atomic.LoadInt64(&s.lotteryTickets), "draws": atomic.LoadInt64(&s.lotteryDraws), "payouts": atomic.LoadInt64(&s.lotteryPayouts)},
			"coin_flip":     map[string]int64{"bets": atomic.LoadInt64(&s.coinFlipBets), "wins": atomic.LoadInt64(&s.coinFlipWins), "payouts": atomic.LoadInt64(&s.coinFlipPayouts)},
			"dice_game":     map[string]int64{"bets": atomic.LoadInt64(&s.diceGameBets), "wins": atomic.LoadInt64(&s.diceGameWins), "payouts": atomic.LoadInt64(&s.diceGamePayouts)},
			"scratch_card":  map[string]int64{"buys": atomic.LoadInt64(&s.scratchCardBuys), "wins": atomic.LoadInt64(&s.scratchCardWins), "payouts": atomic.LoadInt64(&s.scratchCardPayouts)},
			"mega_millions": map[string]int64{"tickets": atomic.LoadInt64(&s.megaMillionsTickets), "draws": atomic.LoadInt64(&s.megaMillionsDraws), "wins": atomic.LoadInt64(&s.megaMillionsWins)},
			"gas_spin":      map[string]int64{"bets": atomic.LoadInt64(&s.gasSpinBets), "wins": atomic.LoadInt64(&s.gasSpinWins), "payouts": atomic.LoadInt64(&s.gasSpinPayouts)},
		},
		"defi": map[string]interface{}{
			"prediction":    map[string]int64{"bets": atomic.LoadInt64(&s.predictionBets), "resolves": atomic.LoadInt64(&s.predictionResolves), "payouts": atomic.LoadInt64(&s.predictionPayouts)},
			"flashloan":     map[string]int64{"borrows": atomic.LoadInt64(&s.flashloanBorrows), "repays": atomic.LoadInt64(&s.flashloanRepays)},
			"price_ticker":  map[string]int64{"queries": atomic.LoadInt64(&s.priceQueries)},
			"price_predict": map[string]int64{"bets": atomic.LoadInt64(&s.pricePredictBets), "wins": atomic.LoadInt64(&s.pricePredictWins), "payouts": atomic.LoadInt64(&s.pricePredictPayouts)},
			"turbo_options": map[string]int64{"bets": atomic.LoadInt64(&s.turboOptionsBets), "wins": atomic.LoadInt64(&s.turboOptionsWins), "payouts": atomic.LoadInt64(&s.turboOptionsPayouts)},
			"il_guard":      map[string]int64{"deposits": atomic.LoadInt64(&s.ilGuardDeposits), "claims": atomic.LoadInt64(&s.ilGuardClaims)},
		},
		"social": map[string]interface{}{
			"secret_vote":   map[string]int64{"casts": atomic.LoadInt64(&s.secretVoteCasts), "tallies": atomic.LoadInt64(&s.secretVoteTallies)},
			"secret_poker":  map[string]int64{"games": atomic.LoadInt64(&s.secretPokerGames), "wins": atomic.LoadInt64(&s.secretPokerWins)},
			"micro_predict": map[string]int64{"bets": atomic.LoadInt64(&s.microPredictBets), "wins": atomic.LoadInt64(&s.microPredictWins)},
			"red_envelope":  map[string]int64{"sends": atomic.LoadInt64(&s.redEnvelopeSends), "claims": atomic.LoadInt64(&s.redEnvelopeClaims)},
			"gas_circle":    map[string]int64{"deposits": atomic.LoadInt64(&s.gasCircleDeposits), "wins": atomic.LoadInt64(&s.gasCircleWins)},
		},
		"other": map[string]interface{}{
			"gov_booster": map[string]int64{"votes": atomic.LoadInt64(&s.govBoosterVotes)},
			"fog_chess":   map[string]int64{"games": atomic.LoadInt64(&s.fogChessGames), "wins": atomic.LoadInt64(&s.fogChessWins)},
		},
		"phase5": map[string]interface{}{
			"neo_crash":        map[string]int64{"bets": atomic.LoadInt64(&s.neoCrashBets), "cashouts": atomic.LoadInt64(&s.neoCrashCashouts), "payouts": atomic.LoadInt64(&s.neoCrashPayouts)},
			"candle_wars":      map[string]int64{"bets": atomic.LoadInt64(&s.candleWarsBets), "wins": atomic.LoadInt64(&s.candleWarsWins)},
			"dutch_auction":    map[string]int64{"bids": atomic.LoadInt64(&s.dutchAuctionBids), "sales": atomic.LoadInt64(&s.dutchAuctionSales)},
			"parasite":         map[string]int64{"stakes": atomic.LoadInt64(&s.parasiteStakes), "attacks": atomic.LoadInt64(&s.parasiteAttacks)},
			"throne_of_gas":    map[string]int64{"claims": atomic.LoadInt64(&s.throneOfGasClaims), "taxes": atomic.LoadInt64(&s.throneOfGasTaxes)},
			"no_loss_lottery":  map[string]int64{"stakes": atomic.LoadInt64(&s.noLossLotteryStakes), "wins": atomic.LoadInt64(&s.noLossLotteryWins)},
			"doomsday_clock":   map[string]int64{"keys": atomic.LoadInt64(&s.doomsdayClockKeys), "wins": atomic.LoadInt64(&s.doomsdayClockWins)},
			"pay_to_view":      map[string]int64{"purchases": atomic.LoadInt64(&s.payToViewPurchases), "creates": atomic.LoadInt64(&s.payToViewCreates)},
		},
		"phase6": map[string]interface{}{
			"schrodinger_nft":  map[string]int64{"adopts": atomic.LoadInt64(&s.schrodingerAdopts), "observes": atomic.LoadInt64(&s.schrodingerObserves), "trades": atomic.LoadInt64(&s.schrodingerTrades)},
			"algo_battle":      map[string]int64{"uploads": atomic.LoadInt64(&s.algoBattleUploads), "matches": atomic.LoadInt64(&s.algoBattleMatches), "wins": atomic.LoadInt64(&s.algoBattleWins)},
			"time_capsule":     map[string]int64{"buries": atomic.LoadInt64(&s.timeCapsuleBuries), "reveals": atomic.LoadInt64(&s.timeCapsuleReveals), "fishes": atomic.LoadInt64(&s.timeCapsuleFishes)},
			"garden_of_neo":    map[string]int64{"plants": atomic.LoadInt64(&s.gardenOfNeoPlants), "harvests": atomic.LoadInt64(&s.gardenOfNeoHarvests)},
			"dev_tipping":      map[string]int64{"tips": atomic.LoadInt64(&s.devTippingTips)},
		},
		"phase7": map[string]interface{}{
			"ai_soulmate":      map[string]int64{"chats": atomic.LoadInt64(&s.aiSoulmateChats)},
			"dead_switch":      map[string]int64{"setups": atomic.LoadInt64(&s.deadSwitchSetups)},
			"heritage_trust":   map[string]int64{"creates": atomic.LoadInt64(&s.heritageTrustCreates)},
			"dark_radio":       map[string]int64{"broadcasts": atomic.LoadInt64(&s.darkRadioBroadcasts)},
			"zk_badge":         map[string]int64{"mints": atomic.LoadInt64(&s.zkBadgeMints)},
			"graveyard":        map[string]int64{"burials": atomic.LoadInt64(&s.graveyardBurials)},
			"compound_capsule": map[string]int64{"deposits": atomic.LoadInt64(&s.compoundDeposits)},
			"self_loan":        map[string]int64{"borrows": atomic.LoadInt64(&s.selfLoanBorrows)},
			"dark_pool":        map[string]int64{"swaps": atomic.LoadInt64(&s.darkPoolSwaps)},
			"burn_league":      map[string]int64{"burns": atomic.LoadInt64(&s.burnLeagueBurns)},
			"gov_merc":         map[string]int64{"votes": atomic.LoadInt64(&s.govMercVotes)},
		},
		"phase8": map[string]interface{}{
			"quantum_swap":      map[string]int64{"swaps": atomic.LoadInt64(&s.quantumSwaps)},
			"onchain_tarot":     map[string]int64{"readings": atomic.LoadInt64(&s.tarotReadings)},
			"ex_files":          map[string]int64{"shares": atomic.LoadInt64(&s.exFilesShares)},
			"scream_to_earn":    map[string]int64{"submits": atomic.LoadInt64(&s.screamSubmits)},
			"breakup_contract":  map[string]int64{"contracts": atomic.LoadInt64(&s.breakupContracts)},
			"geo_spotlight":     map[string]int64{"bids": atomic.LoadInt64(&s.geoSpotlightBids)},
			"puzzle_mining":     map[string]int64{"solves": atomic.LoadInt64(&s.puzzleSolves)},
			"nft_chimera":       map[string]int64{"merges": atomic.LoadInt64(&s.chimeraMerges)},
			"world_piano":       map[string]int64{"notes": atomic.LoadInt64(&s.pianoNotes)},
			"bounty_hunter":     map[string]int64{"hunts": atomic.LoadInt64(&s.bountyHunts)},
			"masquerade_dao":    map[string]int64{"votes": atomic.LoadInt64(&s.masqueradeVotes)},
			"melting_asset":     map[string]int64{"deposits": atomic.LoadInt64(&s.meltingDeposits)},
			"unbreakable_vault": map[string]int64{"locks": atomic.LoadInt64(&s.vaultLocks)},
			"whisper_chain":     map[string]int64{"sends": atomic.LoadInt64(&s.whisperSends)},
			"million_piece_map": map[string]int64{"buys": atomic.LoadInt64(&s.mapPieceBuys)},
			"fog_puzzle":        map[string]int64{"reveals": atomic.LoadInt64(&s.fogPuzzleReveals)},
			"crypto_riddle":     map[string]int64{"solves": atomic.LoadInt64(&s.riddleSolves)},
		},
		"phase10": map[string]interface{}{
			"grant_share":    map[string]int64{"funds": atomic.LoadInt64(&s.grantShareFunds), "creates": atomic.LoadInt64(&s.grantShareCreates)},
			"neo_chat":       map[string]int64{"messages": atomic.LoadInt64(&s.neoChatMessages), "rooms": atomic.LoadInt64(&s.neoChatRooms)},
			"neo_ns":         map[string]int64{"registrations": atomic.LoadInt64(&s.neoNSRegistrations), "renewals": atomic.LoadInt64(&s.neoNSRenewals)},
			"daily_checkin":  map[string]int64{"checkins": atomic.LoadInt64(&s.dailyCheckins), "claims": atomic.LoadInt64(&s.dailyCheckinClaims)},
		},
		"errors": atomic.LoadInt64(&s.simulationErrors),
	}
}
