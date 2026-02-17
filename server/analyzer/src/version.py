"""
Version information for PTA.

Single source of truth for version numbers, read from pyproject.toml.
"""
import re
from pathlib import Path
from typing import Optional


def get_tool_version() -> str:
    """
    Get the PTA tool version from pyproject.toml.
    
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


def get_schema_version() -> str:
    """
    Get the schema version for operate.json and target_howto.json.
    
    This is separate from the tool version as it represents the
    output contract version, not the implementation version.
    
    Returns:
        Schema version string (e.g., "1.0")
    """
    return "1.0"


# Module-level constants for backward compatibility
TOOL_VERSION = get_tool_version()
OPERATE_SCHEMA_VERSION = get_schema_version()
TARGET_HOWTO_SCHEMA_VERSION = get_schema_version()
