"""
Schema validation module for PTA outputs.

Validates JSON outputs against their schemas before writing to ensure
contract compliance.

CRITICAL: All schemas MUST be in shared/schemas directory.
This is enforced with a fail-fast check on module load to prevent
schema drift and ensure consistency across the system.
"""
import json
from pathlib import Path
from typing import Any, Dict, List
import jsonschema
from jsonschema import validate, ValidationError, Draft7Validator

# SINGLE SOURCE OF TRUTH: All schemas must be in shared/schemas
SCHEMAS_DIR = Path(__file__).resolve().parents[3] / "shared" / "schemas"

# SECURITY CHECK: Fail-fast if deprecated schema directory exists
# This prevents schema drift by ensuring there's only one canonical location
# Check multiple possible deprecated locations
DEPRECATED_1 = Path(__file__).resolve().parents[1] / "schemas"      # server/analyzer/src/../schemas
DEPRECATED_2 = Path(__file__).resolve().parents[2] / "schemas"      # server/analyzer/../schemas
DEPRECATED_3 = Path(__file__).resolve().parents[2] / "analyzer" / "schemas"  # server/analyzer/schemas

for deprecated_dir in [DEPRECATED_1, DEPRECATED_2, DEPRECATED_3]:
    if deprecated_dir.exists():
        raise RuntimeError(
            f"SCHEMA DRIFT ERROR: Deprecated schema directory exists at {deprecated_dir}. "
            f"All schemas must be in {SCHEMAS_DIR}. Remove the deprecated directory to proceed. "
            f"This is intentional fail-fast behavior to prevent inconsistent outputs."
        )


def load_schema(schema_name: str) -> Dict[str, Any]:
    """Load a JSON schema from the canonical schemas directory."""
    schema_path = SCHEMAS_DIR / schema_name
    if not schema_path.exists():
        raise FileNotFoundError(
            f"Schema not found: {schema_path}. "
            f"Expected schema directory: {SCHEMAS_DIR}"
        )
    
    with open(schema_path, "r") as f:
        return json.load(f)


def validate_against_schema(data: Dict[str, Any], schema_name: str) -> List[str]:
    """
    Validate data against a schema.
    
    Returns:
        List of validation errors (empty if valid)
    """
    try:
        schema = load_schema(schema_name)
        validator = Draft7Validator(schema)
        errors = []
        
        for error in validator.iter_errors(data):
            path = ".".join(str(p) for p in error.path) if error.path else "root"
            errors.append(f"{path}: {error.message}")
        
        return errors
    except FileNotFoundError as e:
        return [f"Schema error: {e}"]
    except Exception as e:
        return [f"Validation error: {e}"]


def validate_operate_json(data: Dict[str, Any]) -> List[str]:
    """Validate operate.json against its schema."""
    return validate_against_schema(data, "operate.schema.json")


def validate_target_howto_json(data: Dict[str, Any]) -> List[str]:
    """Validate target_howto.json against its schema."""
    return validate_against_schema(data, "target_howto.schema.json")
