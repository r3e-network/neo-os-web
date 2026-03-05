package neoflow

func (s *Service) tryAcquireTriggerSlot() bool {
	if s == nil || s.triggerSem == nil {
		return true
	}
	select {
	case s.triggerSem <- struct{}{}:
		return true
	default:
		return false
	}
}

func (s *Service) releaseTriggerSlot() {
	if s == nil || s.triggerSem == nil {
		return
	}
	<-s.triggerSem
}

func (s *Service) tryAcquireAnchoredTaskSlot() bool {
	if s == nil || s.anchoredTaskSem == nil {
		return true
	}
	select {
	case s.anchoredTaskSem <- struct{}{}:
		return true
	default:
		return false
	}
}

func (s *Service) releaseAnchoredTaskSlot() {
	if s == nil || s.anchoredTaskSem == nil {
		return
	}
	<-s.anchoredTaskSem
}
