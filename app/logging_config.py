import logging
from pathlib import Path
from rich.console import Console
from rich.logging import RichHandler
from rich.traceback import install

# Install rich traceback handler
install(show_locals=True)

# Create console instance
console = Console()


def setup_logging(log_level=logging.INFO):
    """Configure logging with file and line information for all outputs."""
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # Single format for all outputs including file and line
    log_format = "%(asctime)s [%(filename)s:%(lineno)d] %(levelname)s: %(message)s"
    formatter = logging.Formatter(log_format)

    # Configure root logger
    logger = logging.getLogger()
    logger.setLevel(log_level)

    try:
        # File handler with rotation
        file_handler = logging.handlers.RotatingFileHandler(
            filename=log_dir / "app.log",
            maxBytes=10_000_000,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        console.print(f"[red]Failed to setup file logging: {e}[/red]")

    # Console handler with rich formatting
    console_handler = RichHandler(
        console=console, rich_tracebacks=True, show_time=True, show_path=True
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger


setup_logging()


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the specified name."""
    return logging.getLogger(name)
