package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func handleBus(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		fmt.Println(`Usage:
  slctl bus events --event <name> [--payload JSON] [--payload-file path]        # admin token/JWT required
  slctl bus data --topic <topic> [--payload JSON] [--payload-file path]         # admin token/JWT required
  slctl bus compute [--payload JSON] [--payload-file path]                      # admin token/JWT required
  slctl bus stats --prom-url <http://prom:9090> [--token <prom-token>] [--range 5m]`)
		return nil
	}

	switch args[0] {
	case "events":
		fs := flag.NewFlagSet("bus events", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var event, payloadRaw, payloadFile string
		fs.StringVar(&event, "event", "", "Event name (required)")
		fs.StringVar(&payloadRaw, "payload", "", "Inline JSON payload")
		fs.StringVar(&payloadFile, "payload-file", "", "Path to JSON payload file")
		if err := fs.Parse(args[1:]); err != nil {
			return usageError(err)
		}
		if strings.TrimSpace(event) == "" {
			return errors.New("event is required")
		}
		payload, err := loadJSONPayload(payloadRaw, payloadFile)
		if err != nil {
			return err
		}
		body := map[string]any{"event": event}
		if payload != nil {
			body["payload"] = payload
		}
		data, err := client.request(ctx, http.MethodPost, "/system/events", body)
		if err != nil {
			return err
		}
		prettyPrint(data)
		return nil

	case "data":
		fs := flag.NewFlagSet("bus data", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var topic, payloadRaw, payloadFile string
		fs.StringVar(&topic, "topic", "", "Topic (stream/channel identifier) (required)")
		fs.StringVar(&payloadRaw, "payload", "", "Inline JSON payload")
		fs.StringVar(&payloadFile, "payload-file", "", "Path to JSON payload file")
		if err := fs.Parse(args[1:]); err != nil {
			return usageError(err)
		}
		if strings.TrimSpace(topic) == "" {
			return errors.New("topic is required")
		}
		payload, err := loadJSONPayload(payloadRaw, payloadFile)
		if err != nil {
			return err
		}
		body := map[string]any{"topic": topic}
		if payload != nil {
			body["payload"] = payload
		}
		data, err := client.request(ctx, http.MethodPost, "/system/data", body)
		if err != nil {
			return err
		}
		prettyPrint(data)
		return nil

	case "compute":
		fs := flag.NewFlagSet("bus compute", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		var payloadRaw, payloadFile string
		fs.StringVar(&payloadRaw, "payload", "", "Inline JSON payload")
		fs.StringVar(&payloadFile, "payload-file", "", "Path to JSON payload file")
		if err := fs.Parse(args[1:]); err != nil {
			return usageError(err)
		}
		payload, err := loadJSONPayload(payloadRaw, payloadFile)
		if err != nil {
			return err
		}
		if payload == nil {
			return errors.New("payload is required")
		}
		data, err := client.request(ctx, http.MethodPost, "/system/compute", map[string]any{"payload": payload})
		if err != nil {
			return err
		}
		prettyPrint(data)
		return nil

	case "stats":
		fs := flag.NewFlagSet("bus stats", flag.ContinueOnError)
		fs.SetOutput(io.Discard)
		promURL := fs.String("prom-url", "", "Prometheus base URL (e.g., http://localhost:9090). When empty, uses /system/status bus_fanout totals.")
		promToken := fs.String("token", "", "Prometheus bearer token (optional)")
		rng := fs.String("range", "5m", "Lookback window for fan-out counts (Prom duration, e.g., 5m)")
		if err := fs.Parse(args[1:]); err != nil {
			return usageError(err)
		}
		if strings.TrimSpace(*promURL) == "" {
			statusData, err := client.request(ctx, http.MethodGet, "/system/status", nil)
			if err != nil {
				return fmt.Errorf("fetch system status: %w", err)
			}
			var payload struct {
				BusFanout map[string]struct {
					OK    float64 `json:"ok"`
					Error float64 `json:"error"`
				} `json:"bus_fanout"`
				BusFanoutRecent map[string]struct {
					OK    float64 `json:"ok"`
					Error float64 `json:"error"`
				} `json:"bus_fanout_recent"`
				BusFanoutRecentWindow float64 `json:"bus_fanout_recent_window_seconds"`
				BusMaxBytes           float64 `json:"bus_max_bytes"`
			}
			if err := json.Unmarshal(statusData, &payload); err != nil {
				return fmt.Errorf("decode status: %w", err)
			}
			if len(payload.BusFanout) == 0 {
				fmt.Println("Bus fan-out totals not available (bus_fanout missing in /system/status).")
				return nil
			}
			fmt.Println("Bus fan-out totals (since process start):")
			statusMap := make(map[string]struct {
				OK  float64
				Err float64
			}, len(payload.BusFanout))
			if payload.BusMaxBytes > 0 {
				fmt.Printf("Bus payload cap: %.0f bytes\n", payload.BusMaxBytes)
			}
			for k, v := range payload.BusFanout {
				statusMap[k] = struct {
					OK  float64
					Err float64
				}{OK: v.OK, Err: v.Error}
			}
			printBusFanoutTable(statusMap)
			if len(payload.BusFanoutRecent) > 0 {
				window := payload.BusFanoutRecentWindow
				if window <= 0 {
					window = 300
				}
				recent := make(map[string]struct {
					OK  float64
					Err float64
				}, len(payload.BusFanoutRecent))
				for k, v := range payload.BusFanoutRecent {
					recent[k] = struct {
						OK  float64
						Err float64
					}{OK: v.OK, Err: v.Error}
				}
				fmt.Printf("Bus fan-out (last %.0fs):\n", window)
				printBusFanoutTable(recent)
			}
			return nil
		}
		dur := strings.TrimSpace(*rng)
		if dur == "" {
			dur = "5m"
		}
		query := fmt.Sprintf("sum(increase(service_layer_engine_bus_fanout_total[%s])) by (kind,result)", dur)
		samples, err := queryPrometheus(ctx, strings.TrimSpace(*promURL), strings.TrimSpace(*promToken), query)
		if err != nil {
			return fmt.Errorf("query prom: %w", err)
		}
		if len(samples) == 0 {
			fmt.Println("No fan-out metrics found.")
			return nil
		}
		byKind := reduceFanoutSamples(samples)
		fmt.Printf("Bus fan-out counts over %s (Prom: %s)\n", dur, *promURL)
		printBusFanoutTable(byKind)
		return nil
	}

	fmt.Println(`Usage:
  slctl bus events --event <name> [--payload JSON] [--payload-file path]
  slctl bus data --topic <topic> [--payload JSON] [--payload-file path]
  slctl bus compute [--payload JSON] [--payload-file path]
  slctl bus stats --prom-url <http://prom:9090> [--token <prom-token>] [--range 5m]`)
	return fmt.Errorf("unknown bus subcommand %q", args[0])
}
