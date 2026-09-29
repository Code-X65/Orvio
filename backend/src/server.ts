import 'dotenv/config';

import { buildApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { createCapturedMailSender, createCapturedSmsSender } from './testing/delivery-capture.js';

const env = parseEnvironment();
const app = await buildApp({
  env,
  ...(env.E2E_TEST_MODE ? { mailer: createCapturedMailSender(env), sms: createCapturedSmsSender() } : {}),
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal(error, 'Unable to start server');
  process.exitCode = 1;
  await app.close();
}
