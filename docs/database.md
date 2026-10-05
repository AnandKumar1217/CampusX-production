# CampusX Database Guide

CampusX uses MongoDB for its primary data storage.

## Environments

### Production Database
- **Name**: `campusx`
- **Variable**: `MONGODB_URI`
- **Usage**: Used for the active production and development API.

### Integration Test Database
- **Name**: `test_campusx`
- **Variable**: `MONGODB_TEST_URI`
- **Usage**: Exclusively for automated integration testing.

## CRITICAL RULES
- **Never mix production and test data.** Tests should always run against `test_campusx`.
- **Never commit credentials.** Ensure all `.env` files remain ignored and secrets are provisioned securely via Render or EAS.
