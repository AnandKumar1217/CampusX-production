# Security history

## September 2026: historical MongoDB credential exposure

A MongoDB connection credential was previously present in this private repository's
history. The credential was rotated and invalidated before production deployment.

The current application reads the MongoDB connection string only from the
server-side `MONGODB_URI` environment variable. No credential value is stored in
the current source tree. The invalidated historical credential must not be restored.
