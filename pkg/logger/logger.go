package logger

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/sirupsen/logrus"
)

// Logger is a wrapper around logrus.Logger
type Logger struct {
	*logrus.Logger
}

// New creates a new logger instance
func New(cfg config.LoggingConfig) *Logger {
	// Create logger
	logger := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set log format
	if strings.ToLower(cfg.Format) == "json" {
		logger.SetFormatter(&logrus.JSONFormatter{})
	} else {
		logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
		})
	}

	// Set log output
	var output io.Writer
	switch strings.ToLower(cfg.Output) {
	case "stdout":
		output = os.Stdout
	case "stderr":
		output = os.Stderr
	case "file":
		if cfg.FilePath != "" {
			// Create directory if it doesn't exist
			dir := filepath.Dir(cfg.FilePath)
			if err := os.MkdirAll(dir, 0755); err != nil {
				logger.Errorf("Failed to create log directory: %v", err)
				output = os.Stdout
			} else {
				file, err := os.OpenFile(cfg.FilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
				if err != nil {
					logger.Errorf("Failed to open log file: %v", err)
					output = os.Stdout
				} else {
					output = file
				}
			}
		} else {
			output = os.Stdout
		}
	default:
		output = os.Stdout
	}
	logger.SetOutput(output)

	return &Logger{logger}
}

// WithField adds a field to the logger
func (l *Logger) WithField(key string, value interface{}) *logrus.Entry {
	return l.Logger.WithField(key, value)
}

// WithFields adds multiple fields to the logger
func (l *Logger) WithFields(fields logrus.Fields) *logrus.Entry {
	return l.Logger.WithFields(fields)
}
