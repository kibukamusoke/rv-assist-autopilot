import 'dotenv/config';
import pino from 'pino';
import { createApp } from './api/app.js';
import { createWorkflowEngine } from './config/container.js';
import { loadEnvironment } from './config/environment.js';

const environment = loadEnvironment();
const logger = pino({ level: environment.LOG_LEVEL });
const app = createApp(createWorkflowEngine(environment));

app.listen(environment.PORT, '0.0.0.0', () => {
  logger.info({ port: environment.PORT }, 'RV Assist Autopilot listening');
});
