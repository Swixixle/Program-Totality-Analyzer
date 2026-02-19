"""
Version information for Repository Reconnaissance.

Single source of truth for version numbers, read from pyproject.toml.
All outputs emit tool_version as "rr-{version}" for consistency.
"""
import re
from pathlib import Path
from typing import Optional


def get_raw_version() -> str:
    """
    Get the raw version from pyproject.toml.
    
    Returns:
        Version string (e.g., "0.1.0")
    """
    try:
        pyproject_path = Path(__file__).resolve().parents[4] / "pyproject.toml"
        if not pyproject_path.exists():
            return "0.1.0"  # fallback
        
        content = pyproject_path.read_text()
        match = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
        if match:
            return match.group(1)
    except Exception:
        pass
    
    return "0.1.0"  # fallback


def get_tool_version() -> str:
    """
    Get the Repository Reconnaissance tool version with rr- prefix for all outputs.
    
    Returns:
        Version string with prefix (e.g., "rr-0.1.0")
    """
    return f"rr-{get_raw_version()}"


# Schema version constants - single source of truth
OPERATE_SCHEMA_VERSION = "1.0"
TARGET_HOWTO_SCHEMA_VERSION = "1.0"
CLAIMS_SCHEMA_VERSION = "1.0"
COVERAGE_SCHEMA_VERSION = "1.0"

# Module-level constants for backward compatibility
TOOL_VERSION = get_raw_version()  # Keep for internal use
PTA_VERSION = get_tool_version()  # Use this in all outputs
