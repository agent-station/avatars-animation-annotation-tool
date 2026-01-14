import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class AnimationReviewerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for annotations
    const annotationsTable = new dynamodb.Table(this, 'AnnotationsTable', {
      tableName: 'animation-reviewer-annotations',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'animationPath', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Global Secondary Index for querying all annotations by user
    annotationsTable.addGlobalSecondaryIndex({
      indexName: 'UserAnnotationsIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'annotatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda function for API
    // Note: Run `npm install && npm run build` in infra/lambda before deploying
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      functionName: 'animation-reviewer-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
        exclude: ['src', 'tsconfig.json', '*.ts', 'node_modules/.bin'],
        // Follow symlinks to avoid issues with .bin directory
        followSymlinks: cdk.SymlinkFollowMode.NEVER,
      }),
      environment: {
        TABLE_NAME: annotationsTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant Lambda permissions to DynamoDB
    annotationsTable.grantReadWriteData(apiHandler);

    // API Gateway REST API
    const api = new apigateway.RestApi(this, 'AnnotationsApi', {
      restApiName: 'Animation Reviewer API',
      description: 'API for animation annotation CRUD operations',
      // Enable gzip compression for responses > 1KB (reduces payload by ~70-80%)
      minCompressionSize: cdk.Size.bytes(1024),
      deployOptions: {
        stageName: 'v1',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-User-Id',
        ],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiHandler, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API Resources
    const annotations = api.root.addResource('annotations');
    const userAnnotations = annotations.addResource('{userId}');
    const singleAnnotation = userAnnotations.addResource('{animationPath+}');

    // GET /annotations/{userId} - Get all annotations for a user
    userAnnotations.addMethod('GET', lambdaIntegration);

    // GET /annotations/{userId}/{animationPath} - Get single annotation
    singleAnnotation.addMethod('GET', lambdaIntegration);

    // PUT /annotations/{userId}/{animationPath} - Create/update annotation
    singleAnnotation.addMethod('PUT', lambdaIntegration);

    // DELETE /annotations/{userId}/{animationPath} - Delete annotation
    singleAnnotation.addMethod('DELETE', lambdaIntegration);

    // Batch operations
    const batch = annotations.addResource('batch');
    const batchUser = batch.addResource('{userId}');

    // POST /annotations/batch/{userId} - Batch import annotations
    batchUser.addMethod('POST', lambdaIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'AnimationReviewerApiEndpoint',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: annotationsTable.tableName,
      description: 'DynamoDB table name',
      exportName: 'AnimationReviewerTableName',
    });
  }
}
