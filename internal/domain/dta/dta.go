package dta

import appdta "github.com/R3E-Network/service_layer/internal/app/domain/dta"

type (
	Product       = appdta.Product
	ProductStatus = appdta.ProductStatus
	Order         = appdta.Order
	OrderType     = appdta.OrderType
	OrderStatus   = appdta.OrderStatus
)

const (
	ProductStatusInactive  = appdta.ProductStatusInactive
	ProductStatusActive    = appdta.ProductStatusActive
	ProductStatusSuspended = appdta.ProductStatusSuspended

	OrderTypeSubscription = appdta.OrderTypeSubscription
	OrderTypeRedemption   = appdta.OrderTypeRedemption

	OrderStatusPending  = appdta.OrderStatusPending
	OrderStatusApproved = appdta.OrderStatusApproved
	OrderStatusSettled  = appdta.OrderStatusSettled
	OrderStatusRejected = appdta.OrderStatusRejected
	OrderStatusCanceled = appdta.OrderStatusCanceled
)
