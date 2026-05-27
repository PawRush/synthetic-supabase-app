import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Retrieve the deploymentId from CDK context for namespacing resources
    const deploymentId: string = this.node.tryGetContext('deploymentId') ?? 'default';

    // S3 bucket — private, destroyed with the stack
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `frontend-${deploymentId}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Function for SPA URL rewriting (append /index.html)
    const spaRewriteFunction = new cloudfront.Function(this, 'SpaRewriteFunction', {
      functionName: `spa-rewrite-${deploymentId}`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  // If the URI has no extension, rewrite to /index.html
  if (!uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // Origin Access Control (OAC) for S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: spaRewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      exportName: `${id}-BucketName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      exportName: `${id}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      exportName: `${id}-DistributionDomainName`,
    });
  }
}
