package neorand

import (
	"net/http"

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
)

func (s *Service) handleRandom(w http.ResponseWriter, r *http.Request) {
	var req RandomRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	resp, err := s.Random(r.Context(), &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

func (s *Service) handleVerify(w http.ResponseWriter, r *http.Request) {
	var req VerifyRequest
	if !httputil.DecodeJSON(w, r, &req) {
		return
	}

	resp, err := s.Verify(&req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, resp)
}

