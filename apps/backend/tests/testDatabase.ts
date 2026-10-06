import "dotenv/config";
import mongoose from "mongoose";

const TEST_DATABASE_NAME_PATTERN = /(?:^|[-_])test(?:ing)?(?:[-_]|$)/i;

function getRequiredTestDatabaseUri(): string {
  const uri = process.env.MONGODB_TEST_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_TEST_URI is required for integration tests.");
  }

  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?#]+)(?:[?#].*)?$/i.exec(uri);
  if (!match) {
    throw new Error(
      "MONGODB_TEST_URI must be a valid MongoDB URI with an explicit database name.",
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(match[1]);
  } catch {
    throw new Error("MONGODB_TEST_URI contains an invalid database name.");
  }

  if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      'MONGODB_TEST_URI must name a database with a dedicated "test" marker.',
    );
  }

  return uri;
}

export async function connectToTestDatabase(): Promise<void> {
  const uri = getRequiredTestDatabaseUri();

  if (
    mongoose.connection.readyState !== 0 &&
    !TEST_DATABASE_NAME_PATTERN.test(mongoose.connection.name ?? "")
  ) {
    throw new Error(
      "Refusing to run integration tests with an active non-test database connection.",
    );
  }

  mongoose.set('autoIndex', false);
  await mongoose.connect(uri);
}
