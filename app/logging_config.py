from rich.console import Console
from rich.logging import RichHandler
from rich.traceback import install
import logging
import sys

# Install rich traceback handler
install(show_locals=True)

# Create console instance
console = Console()

# Configure logging with rich
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[
            RichHandler(
                console=console,
                rich_tracebacks=True,
                tracebacks_show_locals=True,
                markup=True
            )
        ]
    )

    # Get logger
    logger = logging.getLogger("rich")
    
    return logger
