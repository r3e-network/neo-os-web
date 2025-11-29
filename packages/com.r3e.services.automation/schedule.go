package automation

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

const cronSearchWindowMinutes = 5 * 365 * 24 * 60 // search up to five years ahead

func nextRunFromSpec(spec string, from time.Time) (time.Time, error) {
	trimmed := strings.TrimSpace(spec)
	if trimmed == "" {
		return time.Time{}, fmt.Errorf("schedule is required")
	}

	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "@every") {
		durationSpec := strings.TrimSpace(lower[len("@every"):])
		if durationSpec == "" {
			return time.Time{}, fmt.Errorf("schedule %q missing duration", spec)
		}
		dur, err := time.ParseDuration(durationSpec)
		if err != nil {
			return time.Time{}, fmt.Errorf("parse duration %q: %w", durationSpec, err)
		}
		if dur <= 0 {
			return time.Time{}, fmt.Errorf("duration must be positive in schedule %q", spec)
		}
		return from.Add(dur).UTC(), nil
	}

	switch lower {
	case "@hourly":
		return nextCronTime("0 * * * *", from)
	case "@daily", "@midnight":
		return nextCronTime("0 0 * * *", from)
	case "@weekly":
		return nextCronTime("0 0 * * 0", from)
	case "@monthly":
		return nextCronTime("0 0 1 * *", from)
	case "@annually", "@yearly":
		return nextCronTime("0 0 1 1 *", from)
	default:
		return nextCronTime(trimmed, from)
	}
}

func nextCronTime(spec string, from time.Time) (time.Time, error) {
	fields := strings.Fields(spec)
	if len(fields) != 5 {
		return time.Time{}, fmt.Errorf("cron schedule %q must contain 5 fields", spec)
	}

	minutes, err := parseCronField(fields[0], 0, 59, nil)
	if err != nil {
		return time.Time{}, fmt.Errorf("minute field: %w", err)
	}
	hours, err := parseCronField(fields[1], 0, 23, nil)
	if err != nil {
		return time.Time{}, fmt.Errorf("hour field: %w", err)
	}
	dom, err := parseCronField(fields[2], 1, 31, nil)
	if err != nil {
		return time.Time{}, fmt.Errorf("day-of-month field: %w", err)
	}
	months, err := parseCronField(fields[3], 1, 12, nil)
	if err != nil {
		return time.Time{}, fmt.Errorf("month field: %w", err)
	}
	dow, err := parseCronField(fields[4], 0, 6, normalizeWeekday)
	if err != nil {
		return time.Time{}, fmt.Errorf("day-of-week field: %w", err)
	}

	specification := cronSpec{
		minute: minutes,
		hour:   hours,
		month:  months,
		dom:    dom,
		dow:    dow,
	}

	cursor := from.Truncate(time.Minute).Add(time.Minute)
	for i := 0; i < cronSearchWindowMinutes; i++ {
		if specification.matches(cursor) {
			return cursor.UTC(), nil
		}
		cursor = cursor.Add(time.Minute)
	}
	return time.Time{}, fmt.Errorf("unable to find next run for schedule %q within search window", spec)
}

type cronSpec struct {
	minute cronField
	hour   cronField
	dom    cronField
	month  cronField
	dow    cronField
}

func (c cronSpec) matches(t time.Time) bool {
	if !c.month.match(int(t.Month())) {
		return false
	}
	if !c.hour.match(t.Hour()) {
		return false
	}
	if !c.minute.match(t.Minute()) {
		return false
	}

	domMatches := c.dom.match(t.Day())
	dowMatches := c.dow.match(int(t.Weekday()))

	switch {
	case c.dom.isAny() && c.dow.isAny():
		return true
	case c.dom.isAny():
		return dowMatches
	case c.dow.isAny():
		return domMatches
	default:
		return domMatches || dowMatches
	}
}

type cronField struct {
	any     bool
	values  map[int]struct{}
	min     int
	max     int
	spanLen int
}

func (f cronField) match(v int) bool {
	if f.any {
		return true
	}
	_, ok := f.values[v]
	return ok
}

func (f cronField) isAny() bool {
	return f.any
}

func parseCronField(expr string, min, max int, normalize func(int) (int, error)) (cronField, error) {
	token := strings.TrimSpace(expr)
	if token == "" {
		return cronField{}, fmt.Errorf("field is empty")
	}
	if token == "*" || token == "?" {
		return cronField{any: true, min: min, max: max, spanLen: max - min + 1}, nil
	}

	values := make(map[int]struct{})
	parts := strings.Split(token, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return cronField{}, fmt.Errorf("empty component in %q", expr)
		}

		step := 1
		base := part
		if strings.Contains(part, "/") {
			stepParts := strings.SplitN(part, "/", 2)
			base = strings.TrimSpace(stepParts[0])
			if stepParts[1] == "" {
				return cronField{}, fmt.Errorf("invalid step in %q", part)
			}
			parsedStep, err := strconv.Atoi(stepParts[1])
			if err != nil || parsedStep <= 0 {
				return cronField{}, fmt.Errorf("invalid step in %q", part)
			}
			step = parsedStep
		}

		var start, end int
		var err error
		switch {
		case base == "" || base == "*":
			start = min
			end = max
		case strings.Contains(base, "-"):
			bounds := strings.SplitN(base, "-", 2)
			if bounds[0] == "" || bounds[1] == "" {
				return cronField{}, fmt.Errorf("invalid range %q", base)
			}
			start, err = strconv.Atoi(bounds[0])
			if err != nil {
				return cronField{}, fmt.Errorf("invalid range %q", base)
			}
			end, err = strconv.Atoi(bounds[1])
			if err != nil {
				return cronField{}, fmt.Errorf("invalid range %q", base)
			}
			if end < start {
				start, end = end, start
			}
		default:
			start, err = strconv.Atoi(base)
			if err != nil {
				return cronField{}, fmt.Errorf("invalid value %q", base)
			}
			end = start
		}

		if strings.Contains(part, "/") && start == end && base != "*" && !strings.Contains(base, "-") {
			// Expressions like "5/15" mean every 15 units starting from 5.
			for v := start; v <= max; v += step {
				if err := addCronValue(values, v, min, max, normalize); err != nil {
					return cronField{}, err
				}
			}
			continue
		}

		for v := start; v <= end; v += step {
			if err := addCronValue(values, v, min, max, normalize); err != nil {
				return cronField{}, err
			}
		}
	}

	if len(values) == 0 {
		return cronField{}, fmt.Errorf("no values parsed from %q", expr)
	}
	if len(values) == (max - min + 1) {
		return cronField{any: true, min: min, max: max, spanLen: max - min + 1}, nil
	}
	return cronField{values: values, min: min, max: max, spanLen: max - min + 1}, nil
}

func addCronValue(values map[int]struct{}, raw, min, max int, normalize func(int) (int, error)) error {
	val := raw
	var err error
	if normalize != nil {
		val, err = normalize(raw)
		if err != nil {
			return err
		}
	}
	if val < min || val > max {
		return fmt.Errorf("value %d is out of bounds [%d,%d]", val, min, max)
	}
	values[val] = struct{}{}
	return nil
}

func normalizeWeekday(v int) (int, error) {
	switch {
	case v == 7:
		return 0, nil
	case v >= 0 && v <= 6:
		return v, nil
	default:
		return 0, fmt.Errorf("weekday %d is invalid", v)
	}
}
