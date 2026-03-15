package neofeeds

import "errors"

var (
	// ErrPairRequired indicates a missing or empty price pair input.
	ErrPairRequired = errors.New("pair required")
	// ErrPriceDataUnavailable indicates that upstream sources could not provide a valid price.
	ErrPriceDataUnavailable = errors.New("price data unavailable")
	// ErrPriceFeedNotFound indicates that the requested feed is unknown.
	ErrPriceFeedNotFound = errors.New("price feed not found")
)
