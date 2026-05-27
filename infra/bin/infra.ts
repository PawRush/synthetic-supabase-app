#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();
const deploymentId: string = app.node.tryGetContext('deploymentId') ?? 'default';

new FrontendStack(app, `FrontendStack-${deploymentId}`, {
  stackName: `FrontendStack-${deploymentId}`,
});
