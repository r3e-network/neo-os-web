package logger

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/sirupsen/logrus"
)

// Logger is a wrapper around logrus.Logger
type Logger struct {
	*logrus.Logger
}

// LoggingConfig contains logging configuration
type LoggingConfig struct {
	Level      string `mapstructure:"level"`
	Format     string `mapstructure:"format"`
	Output     string `mapstructure:"output"`
	FilePrefix string `mapstructure:"file_prefix"`
}

// New creates a new logger instance
func New(cfg LoggingConfig) *Logger {
	// Create logger
	logger := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set log format
	switch strings.ToLower(cfg.Format) {
	case "json":
		logger.SetFormatter(&logrus.JSONFormatter{})
	default:
		logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
		})
	}

	// Set log output
	switch strings.ToLower(cfg.Output) {
	case "file":
		if cfg.FilePrefix == "" {
			cfg.FilePrefix = "service_layer"
		}
		// Ensure the logs directory exists
		logDir := "logs"
		err := os.MkdirAll(logDir, 0755)
		if err != nil {
			logger.Errorf("Failed to create logs directory: %v", err)
		} else {
			logPath := filepath.Join(logDir, cfg.FilePrefix+".log")
			file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err != nil {
				logger.Errorf("Failed to open log file: %v", err)
			} else {
				logger.SetOutput(io.MultiWriter(os.Stdout, file))
			}
		}
	default:
		// Use stdout by default
		logger.SetOutput(os.Stdout)
	}

	return &Logger{
		Logger: logger,
	}
}

// New creates a new logger instance with default configuration
func NewDefault(name string) *Logger {
	// Create logger with default configuration
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})
	logger.SetOutput(os.Stdout)

	return &Logger{
		Logger: logger,
	}
}

// WithField returns a new log entry with a field
func (l *Logger) WithField(key string, value interface{}) *logrus.Entry {
	return l.Logger.WithField(key, value)
}

// WithFields returns a new log entry with multiple fields
func (l *Logger) WithFields(fields logrus.Fields) *logrus.Entry {
	return l.Logger.WithFields(fields)
}
