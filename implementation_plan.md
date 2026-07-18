# Transition to Official Moss SDK

Since the Python environment issue is resolved and the official `moss` pip package is now successfully installed, we need to completely remove the local mock and transition the codebase to use the real cloud SDK.

## Proposed Changes

### 1. Remove the Mock 
- **`agent/moss.py`**: [DELETE] 
  - I have already deleted this file so it doesn't shadow the official pip package.

### 2. Update Imports in `agent/tools.py`
- **[MODIFY] `agent/tools.py`**:
  - Remove the `sys.path.append(os.path.dirname(__file__))` hack that was loading the local mock.
  - Update the `MossClient` initialization to import directly from the installed `moss` package.
  - Since the mock was built to perfectly mirror the official SDK's `DocumentInfo`, `QueryOptions`, and `MutationOptions` data structures, the core indexing and querying logic will work out-of-the-box with the real SDK!

### 3. Update Imports in `scripts/index_to_moss.py`
- **[MODIFY] `scripts/index_to_moss.py`**:
  - Remove the `sys.path.append(...)` hack for the mock here as well.
  - Update the imports to use the real SDK.

## Verification Plan
1. Apply the import changes.
2. Run `scripts/index_to_moss.py` with a keyword (e.g., `Sprite`) to verify that the real Moss Cloud index is successfully created and loaded with Bright Data scrape results.
3. Ask the user to run the app, type "Sprite" in the new chat bar, and verify that it hits the real Moss semantic cache successfully!
