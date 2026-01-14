#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AnimationReviewerStack } from '../lib/animation-reviewer-stack';

const app = new cdk.App();

const tags = {
  Team: 'AGSN',
  Product: 'AGSN',
  Environment: 'Staging',
  CostCenter: 'AGSN',
  BillingAccount: 'MKISCORE',
  Owner: 'sean@agsn.ai',
  LaunchDate: '2026-01',
};

new AnimationReviewerStack(app, 'AnimationReviewerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
  },
  tags,
});
